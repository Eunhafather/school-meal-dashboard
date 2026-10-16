(function(root){
  'use strict';
  const Enrollment=typeof module!=='undefined'&&module.exports?require('./enrollment.cjs'):root.Enrollment;
  const M=[3,4,5,6,7,8,9,10,11,12,1,2];
  const LIMIT=9_000_000_000_000;
  const keys=['studentFood','studentOperations','annualLabor','staffFood','staffOperations','staffLabor','staffVat','staffRice'];
  function initial(year=2026) {
    const known=year===2026;
    const defaults=[4670,540,318588000,4670,540,870,87,63];
    return {
      planning:Enrollment.initial(),
      rates:Object.fromEntries(keys.map((k,i)=>[k,known?defaults[i]:null])),
      meals:Object.fromEntries(M.map(m=>[String(m),{grades:[0,1,2].map(()=>({people:null,days:null})),actualStudent:null,staff:null,external:null}])),
      corrections:{
        food:{mode:'monthly',months:Object.fromEntries(M.map(m=>[String(m),{value:null,reason:''}])),quarters:[0,1,2,3].map(()=>({value:null,reason:''}))},
        operations:{mode:'monthly',months:Object.fromEntries(M.map(m=>[String(m),{value:null,reason:''}])),quarters:[0,1,2,3].map(()=>({value:null,reason:''}))},
        labor:{value:null,reason:''}
      }
    };
  }
  function integer(n,max=LIMIT) {
    if(n!==null&&(typeof n!=='number'||!Number.isSafeInteger(n)||n<0||n>max))throw new Error('입력값은 허용 범위 안의 0 이상 정수여야 합니다.');
    return n;
  }
  function correction(x) {
    if(!x||typeof x.reason!=='string'||x.reason.length>500)throw new Error('정산 변경 사유는 500자 이내로 입력하세요.');
    integer(x.value);
    if(x.value!==null&&!x.reason.trim())throw new Error('정산 변경액을 입력하면 변경 사유가 필요합니다.');
    return {value:x.value,reason:x.reason};
  }
  function validate(obj,year=2026) {
    if(!obj)return initial(year);
    if(!obj.rates||!obj.meals||!obj.corrections)throw new Error('식수·단가 자료 형식이 올바르지 않습니다.');
    const rates=Object.fromEntries(keys.map(k=>[k,integer(obj.rates[k],k==='annualLabor'?LIMIT:1000000)]));
    const meals=Object.fromEntries(M.map(m=>{
      const r=obj.meals[String(m)];
      if(!r||!Array.isArray(r.grades)||r.grades.length!==3)throw new Error('학년별 인원·일수 자료가 올바르지 않습니다.');
      return [String(m),{
        grades:r.grades.map(g=>({people:integer(g.people,100000),days:integer(g.days,31)})),
        actualStudent:integer(r.actualStudent,10000000),staff:integer(r.staff,10000000),external:integer(r.external,10000000)
      }];
    }));
    const corrections={labor:correction(obj.corrections.labor)};
    for(const type of ['food','operations']){
      const x=obj.corrections[type];
      if(!x||!['monthly','quarter'].includes(x.mode)||!Array.isArray(x.quarters)||x.quarters.length!==4)throw new Error('정산 적용 단위가 올바르지 않습니다.');
      corrections[type]={mode:x.mode,months:Object.fromEntries(M.map(m=>[String(m),correction(x.months[String(m)])])),quarters:x.quarters.map(correction)};
    }
    return {rates,meals,corrections,planning:Enrollment.validate(obj.planning)};
  }
  function product(a,b){return a===null||b===null?null:a*b;}
  function sum(values) {
    const known=values.filter(x=>x!==null);
    return {value:known.length?known.reduce((a,b)=>a+b,0):null,missing:values.length-known.length};
  }
  function compute(calc,ends=[2,5,8,11]) {
    const data=validate(calc);
    const rates=data.rates;
    const resolved=Enrollment.resolve(data);
    const planning=Enrollment.compute(data);
    const staffRate=sum(['staffFood','staffOperations','staffLabor','staffVat','staffRice'].map(k=>rates[k]));
    const monthly=M.map(m=>{
      const r=resolved[String(m)];
      const planned=sum(r.grades.map(g=>product(g.people,g.days)));
      const plannedValue=planned.missing?null:planned.value;
      const studentMeals=r.actualStudent!==null?r.actualStudent:plannedValue;
      const staffFoodRate=rates.staffFood!==null&&rates.staffRice!==null?rates.staffFood+rates.staffRice:null;
      return {month:m,plannedStudent:plannedValue,studentMeals,studentSource:r.actualStudent!==null?'실제 식수':'인원 × 급식일수',
        food:product(studentMeals,rates.studentFood),operations:product(studentMeals,rates.studentOperations),
        staffMeals:r.staff,externalMeals:r.external,
        staff:{food:product(r.staff,staffFoodRate),operations:product(r.staff,rates.staffOperations),labor:product(r.staff,rates.staffLabor),vat:product(r.staff,rates.staffVat),rice:product(r.staff,rates.staffRice),total:product(r.staff,staffRate.missing?null:staffRate.value)}
      };
    });
    let start=0;
    const quarters=ends.map((last,q)=>{
      const rows=monthly.slice(start,last+1);start=last+1;
      const out={index:q,months:rows.map(r=>r.month)};
      for(const type of ['food','operations']){
        const c=data.corrections[type];
        const base=sum(rows.map(r=>r[type]));
        const receipt=data.planning.enabled&&data.planning.quarters[q].useReceived?Enrollment.effective(data.planning.quarters[q][type]):null;
        if(receipt!==null&&!(c.mode==='quarter'&&c.quarters[q].value!==null)&&!(c.mode==='monthly'&&rows.some(r=>c.months[r.month].value!==null))){
          out[type]={base:base.missing?null:base.value,baseKnown:base.value,applied:receipt,missing:0,changed:false,mode:'received',source:'실제 교부액 · 분기 미배분',rows:rows.map(r=>({month:r.month,base:r[type],applied:null,source:'실제 교부액 · 월별 미배분'}))};
        }else if(c.mode==='quarter'){
          const changed=c.quarters[q].value;
          out[type]={base:base.missing?null:base.value,baseKnown:base.value,applied:changed!==null?changed:base.value,
            missing:changed!==null?0:base.missing,changed:changed!==null,mode:'quarter',
            source:changed!==null?'분기 정산 변경액':'식수 × 단가',rows:rows.map(r=>({month:r.month,base:r[type],applied:null,source:'분기 합계 · 월별 미배분'}))};
        }else{
          const applied=rows.map(r=>{
            const override=c.months[String(r.month)].value;
            return {month:r.month,base:r[type],applied:override!==null?override:r[type],source:override!==null?'월별 정산 변경액':'식수 × 단가'};
          });
          const ag=sum(applied.map(r=>r.applied));
          out[type]={base:base.missing?null:base.value,baseKnown:base.value,applied:ag.value,missing:ag.missing,
            changed:rows.some(r=>c.months[String(r.month)].value!==null),mode:'monthly',source:'월별 적용액 합산',rows:applied};
        }
      }
      return out;
    });
    const categories={};
    for(const type of ['food','operations']){
      const vals=quarters.map(q=>q[type]);
      const ag=sum(vals.map(x=>x.applied));
      categories[type]={base:sum(monthly.map(r=>r[type])),applied:ag.value,missing:vals.reduce((n,x)=>n+x.missing,0)};
    }
    categories.labor={base:rates.annualLabor,applied:data.corrections.labor.value??rates.annualLabor,changed:data.corrections.labor.value!==null,missing:(data.corrections.labor.value??rates.annualLabor)===null?1:0};
    const aggregate=sum(Object.values(categories).map(x=>x.applied));
    const staffSummary={};
    for(const k of ['food','operations','labor','vat','rice','total'])staffSummary[k]=sum(monthly.map(r=>r.staff[k]));
    const staffCombined=staffSummary.labor.value!==null&&staffSummary.vat.value!==null?staffSummary.labor.value+staffSummary.vat.value:null;
    return {monthly,quarters,categories,planning,total:aggregate.value,missing:Object.values(categories).reduce((n,x)=>n+x.missing,0),
      staffRate:staffRate.missing?null:staffRate.value,staffSummary,staffLaborVat:staffCombined,
      foodStaffRate:rates.staffFood!==null&&rates.staffRice!==null?rates.staffFood+rates.staffRice:null};
  }
  function changes(a,b,prefix=''){
    const out=[];
    for(const k of Object.keys(b)){
      const key=prefix?prefix+'.'+k:k;
      if(b[k]!==null&&typeof b[k]==='object')out.push(...changes(a?.[k],b[k],key));
      else if(a?.[k]!==b[k])out.push({key,before:a?.[k]??null,after:b[k]});
    }
    return out;
  }
  const api={M,keys,initial,validate,compute,changes};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MealFunding=api;
})(typeof window!=='undefined'?window:globalThis);