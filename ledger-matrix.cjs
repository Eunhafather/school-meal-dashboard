(function(root){
  'use strict';
  const Ref=typeof module!=='undefined'&&module.exports?require('./ledger-reference.cjs'):root.LedgerReference;
  const F=typeof module!=='undefined'&&module.exports?require('./funding.cjs'):root.MealFunding;
  const M=Ref.months;
  const groups=[
    {id:'income',name:'수입·징수',rows:[4,5,6,7,8,9,10,11,12,13,14,15,16]},
    {id:'expenses',name:'지출 · 지원금 / 수익자부담',rows:Array.from({length:23},(_,i)=>i+19)},
    {id:'school',name:'지출 · 학교 자체부담',rows:[43,44,45,46,47,48,49]}
  ];
  const derived=new Set([7,11,15,16,24,25,36,37,40,41]);
  const optional=new Set([21,23,33,34,35,43,47,49]);
  const editable=groups.flatMap(g=>g.rows).filter(r=>!derived.has(r));
  const sum=a=>a.every(x=>x===null)?null:a.reduce((n,x)=>n+(x??0),0);
  const strict=a=>a.some(x=>x===null)?null:a.reduce((n,x)=>n+x,0);
  const minus=(a,b)=>a===null||b===null?null:a-b;
  function initial(year,seeded=false){
    return {seeded:seeded&&year===Ref.year,incomeStatus:M.map((m,i)=>seeded&&year===Ref.year?Ref.incomeStatus[i]:'예상'),
      expenseStatus:M.map((m,i)=>seeded&&year===Ref.year?Ref.expenseStatus[i]:'예상'),
      overrides:{},legacyRound10:seeded&&year===Ref.year,foodShareConfirmed:false};
  }
  function validate(obj,year){
    if(obj===null||obj===undefined)return null;
    if(typeof obj.seeded!=='boolean'||typeof obj.legacyRound10!=='boolean')throw new Error('관리대장 설정 형식이 올바르지 않습니다.');
    if(obj.seeded&&year!==Ref.year)throw new Error('첨부 기준값은 2026학년도에서만 사용할 수 있습니다.');
    const out=initial(year,obj.seeded);
    for(const k of ['incomeStatus','expenseStatus']){
      if(!Array.isArray(obj[k])||obj[k].length!==12||obj[k].some(x=>!['정산','예상'].includes(x)))throw new Error('월별 정산·예상 상태가 올바르지 않습니다.');
      out[k]=[...obj[k]];
    }
    out.legacyRound10=obj.legacyRound10;
    out.foodShareConfirmed=obj.foodShareConfirmed===true;
    if(!obj.overrides||typeof obj.overrides!=='object'||Array.isArray(obj.overrides))throw new Error('관리대장 변경액 형식이 올바르지 않습니다.');
    if(Object.keys(obj.overrides).length>600)throw new Error('변경 항목이 너무 많습니다.');
    for(const [k,c] of Object.entries(obj.overrides)){
      const match=/^(\d+):(\d+)$/.exec(k);
      if(!match||!editable.includes(Number(match[1]))||!M.includes(Number(match[2])))throw new Error('변경할 수 없는 관리대장 셀입니다.');
      if(!c||!Number.isFinite(c.value)||Math.abs(c.value)>9e12||typeof c.reason!=='string'||!c.reason.trim()||c.reason.length>500)throw new Error('셀 변경액과 사유를 확인하세요.');
      out.overrides[k]={value:c.value,reason:c.reason};
    }
    return out;
  }
  function reference(){
    return {mode:'reference',rows:structuredClone(Ref.rows),incomeStatus:[...Ref.incomeStatus],expenseStatus:[...Ref.expenseStatus],
      annualLabor:Ref.rows['6'].total,laborAllocation:sum(Ref.rows['6'].values),warnings:[...Ref.notes],sources:{}};
  }
  function compute(state){
    const config=validate(state.matrix,state.year)??initial(state.year);
    const cal=F.validate(state.calculation,state.year),fund=F.compute(cal,state.ends);
    const seeded=config.seeded,base=Ref.baseline;
    const rows=Object.fromEntries(groups.flatMap(g=>g.rows).map(r=>[String(r),{label:Ref.rows[String(r)].label,values:Array(12).fill(null),total:null}]));
    const sources={},warnings=[];
    const original=(r,i)=>seeded?Ref.rows[String(r)].values[i]:null;
    const set=(r,i,n,why)=>{rows[String(r)].values[i]=n;sources[r+':'+M[i]]=why;};
    const get=(r,i)=>rows[String(r)].values[i];
    const over=(r,i)=>config.overrides[r+':'+M[i]];
    const corr=(type,i)=>{
      const c=cal.corrections[type],q=state.ends.findIndex(end=>i<=end);
      if(c.mode==='quarter'&&c.quarters[q].value!==null)return {quarter:c.quarters[q].value,why:'분기 정산 변경액 · 월별 미배분'};
      if(cal.planning.enabled&&fund.quarters[q][type].mode==='received')return {quarter:fund.quarters[q][type].applied,why:'실제 교부액 · 월별 미배분'};
      return {month:c.mode==='monthly'?c.months[String(M[i])].value:null};
    };
    const actual=(r,i)=>{
      if(seeded&&Ref.expenseStatus[i]==='정산')return original(r,i);
      return optional.has(r)?null:null;
    };
    const fore=(r,i)=>seeded?(Ref.forecasts[String(r)]?.[i]??original(r,i)):null;
    for(let i=0;i<12;i++){
      const m=M[i],row=fund.monthly[i];
      const student=row.studentMeals??(seeded&&!cal.planning.enabled?base.studentMeals[i]:null);
      const teacher=row.staffMeals??(seeded?base.staffMeals[i]:null);
      for(const [r,type,rate,adjust] of [[4,'food',cal.rates.studentFood,base.foodAdjustments[i]],[5,'operations',cal.rates.studentOperations,base.operationAdjustments[i]]]){
        const c=corr(type,i);
        let value=student===null||rate===null?null:student*rate+(seeded&&!cal.planning.enabled?adjust:0),why=seeded?'식수 × 단가 + 원본 보정액':'식수 × 단가';
        if(c.quarter!==undefined){value=null;why=c.why;}
        else if(c.month!==null&&c.month!==undefined){value=c.month;why='식수·지원금 산정의 월별 정산 변경액';}
        if(c.quarter===undefined&&over(r,i)){value=over(r,i).value;why='대장 셀 변경액 우선 · '+over(r,i).reason;}
        set(r,i,value,why);
      }
      set(6,i,over(6,i)?.value??(seeded?base.laborAllocation[i]:null),over(6,i)?'인건비 월별 계획배분 변경액':'원본 인건비 월별 계획배분 · 실제 교부시점 아님');
      set(8,i,over(8,i)?.value??(teacher===null||fund.staffRate===null?null:teacher*fund.staffRate),over(8,i)?'셀 변경액':'교직원 식수 × 1식 합계 · 수납액 아님');
      let charges=config.incomeStatus[i]==='예상'?get(8,i):(seeded&&Ref.incomeStatus[i]==='정산'?original(9,i):null);
      set(9,i,over(9,i)?.value??charges,over(9,i)?'셀 변경액':config.incomeStatus[i]==='예상'?'예상: 교직원 징수예상액':'정산: 첨부 대장 징수액 · 신규 정산월은 입력 필요');
      set(10,i,over(10,i)?.value??original(10,i),over(10,i)?'셀 변경액':'첨부 대장 수납액 · 실제 신규 수납자료 미연결');
      set(11,i,config.incomeStatus[i]==='정산'?minus(get(9,i),get(10,i)):null,'정산월 징수액 - 수납액 · 예상월 미납액은 미확정');
      const tf=teacher===null||fund.foodStaffRate===null?null:teacher*fund.foodStaffRate;
      const to=teacher===null||cal.rates.staffOperations===null?null:teacher*cal.rates.staffOperations;
      let tl=teacher===null||cal.rates.staffLabor===null||cal.rates.staffVat===null?null:teacher*(cal.rates.staffLabor+cal.rates.staffVat);
      if(tl!==null&&config.legacyRound10&&Ref.baseline.teacherLaborRound10[i])tl=Math.floor(tl/10)*10;
      for(const [r,value] of [[12,tf],[13,to],[14,tl]])set(r,i,over(r,i)?.value??value,over(r,i)?'셀 변경액':r===14?'교직원 인건비 + 부가세 · 원본 절사 옵션 반영':'교직원 식수별 배분 · 쌀지원금은 식재료비에 포함');
      set(7,i,strict([get(4,i),get(5,i),get(6,i)]),'무상급식 재료비 + 운영비 + 인건비');
      set(15,i,strict([get(12,i),get(13,i),get(14,i)]),'수익자 식재료비 + 운영비 + 인건비(부가세 포함)');
      set(16,i,strict([get(7,i),get(15,i)]),'지원금 소계 + 수익자 배분 소계 · 징수/수납행 중복 합산 안 함');
      for(const r of [19,20,21,22,23,26,27,28,29,30,31,32,33,34,35,38,39,43,44,45,46,47,48,49]){
        let value=null,why='';
        if(r===39){value=get(14,i);why='원본 방식: 수익자인건비 배분액';}
        else if(config.expenseStatus[i]==='정산'){value=actual(r,i);why='첨부 대장 정산월 집계값 · 신규 정산월은 입력 필요';}
        else{
          if(r===19||r===20){
            // Original forecast split, not a newly asserted funding policy.
            value=seeded&&get(4,i)!==null?get(4,i)*(r===19?Ref.foodExpenseShare.province:Ref.foodExpenseShare.city):null;
            why='원본 예상 수식의 '+(r===19?'72%':'28%')+' 분담비율 · 현행 기준 확인 필요';
          }else if(r===22){value=get(12,i);why='예상: 수익자 식재료비 배분액';}
          else if(r===38){value=get(6,i);why='예상: 인건비 월별 계획배분액';}
          else{value=fore(r,i);why='원본 예상 지출 가정값 · 정산 실적 아님';}
        }
        if(over(r,i)){value=over(r,i).value;why='대장 셀 변경액 우선 · '+over(r,i).reason;}
        set(r,i,value,why);
      }
      // Optional blank lines keep their visible blank state but participate like Excel SUM.
      const subtotal=(list)=>list.some(r=>!optional.has(r)&&get(r,i)===null)?null:list.reduce((n,r)=>n+(get(r,i)??0),0);
      set(24,i,subtotal([19,20,21,22,23]),'식재료비 지출 소계 · 선택항목 빈칸은 원본 SUM 방식');
      set(25,i,minus(strict([get(4,i),get(12,i)]),get(24,i)),'무상급식 재료비 + 수익자 식재료비 - 식재료비 지출 소계');
      set(36,i,subtotal([26,27,28,29,30,31,32,33,34,35]),'운영비 지출 소계');
      set(37,i,minus(strict([get(5,i),get(13,i)]),get(36,i)),'무상급식 운영비 + 수익자 운영비 - 운영비 지출 소계');
      set(40,i,strict([get(38,i),get(39,i)]),'인건비 지출 소계');
      set(41,i,strict([get(24,i),get(36,i),get(40,i)]),'식재료비 + 운영비 + 인건비 지출 소계');
    }
    for(const [r,data] of Object.entries(rows)){
      data.total=sum(data.values);
      if(seeded&&optional.has(Number(r))&&data.total===null)data.total=0;
    }
    // Quarterly overrides remain unallocated in monthly cells; count them once in annual totals.
    for(const [r,type] of [[4,'food'],[5,'operations']]){
      if(cal.corrections[type].mode==='quarter'||fund.quarters.some(q=>q[type].mode==='received')){
        let start=0,parts=[];
        state.ends.forEach((end,q)=>{
          const changed=fund.quarters[q][type].mode==='received'?fund.quarters[q][type].applied:cal.corrections[type].mode==='quarter'?cal.corrections[type].quarters[q].value:null;
          parts.push(changed!==null?changed:sum(rows[String(r)].values.slice(start,end+1)));
          start=end+1;
        });
        rows[String(r)].total=sum(parts);
      }
    }
    const labor=fund.categories.labor.applied;
    rows['6'].total=labor;
    const total=r=>rows[String(r)].total;
    rows['7'].total=strict([total(4),total(5),total(6)]);
    rows['15'].total=strict([total(12),total(13),total(14)]);
    rows['16'].total=strict([total(7),total(15)]);
    for(const r of [24,36,40,41])if(rows[String(r)].values.some(x=>x===null))rows[String(r)].total=null;
    rows['25'].total=minus(strict([total(4),total(12)]),total(24));
    rows['37'].total=minus(strict([total(5),total(13)]),total(36));
    const allocation=sum(rows['6'].values);
    if(labor!==null&&allocation!==labor)warnings.push('인건비 연간 기준 '+labor.toLocaleString('ko-KR')+'원과 월별 계획배분 '+(allocation===null?'미입력':allocation.toLocaleString('ko-KR')+'원')+'이 일치하지 않습니다. 실제 교부로 간주하지 말고 계획배분을 확인하세요.');
    if(seeded&&!config.foodShareConfirmed)warnings.push('예상 식재료비의 도/시 72%·28%는 원본 수식에서 가져온 가정입니다. 현행 교부 기준이 확인된 비율로 단정하지 않습니다.');
    if(Object.values(cal.corrections).some(c=>c.mode==='quarter'&&c.quarters.some(x=>x.value!==null)))warnings.push('분기 정산액은 합계에 한 번 반영하고 월별로 임의 배분하지 않았습니다. 해당 월의 파생 잔액은 확정할 수 없습니다.');
    if(rows['41'].total===null)warnings.push('지출에 미입력·미배분 월이 있어 연간 지출 합계와 관리 잔액을 확정하지 않았습니다. 정산으로 전환한 월의 실적을 입력하세요.');
    if(cal.planning.enabled&&fund.missing>0)warnings.push('학생수 신청·산정에 미입력 기간이 있습니다. 표시된 지원금 연간 합계는 입력분만 포함하므로 전체 학년도 확정액이 아닙니다.');
    if(fund.quarters.some(q=>q.food.mode==='received'||q.operations.mode==='received'))warnings.push('실제 교부액은 분기 합계로 1회 적용했습니다. 해당 월은 미배분이며 월별 잔액을 확정하지 않습니다.');
    warnings.push('관리 잔액은 산정·예상액을 포함합니다. 실제 입금·통장 잔액이 아닙니다. 학교 자체부담 지출은 지원금 잔액에서 별도 분리합니다.');
    return {mode:'working',rows,incomeStatus:config.incomeStatus,expenseStatus:config.expenseStatus,annualLabor:labor,laborAllocation:allocation,warnings,sources};
  }
  function totals(report){
    return {income:report.rows['16'].total,supportExpenses:report.rows['41'].total,
      foodBalance:report.rows['25'].total,operationsBalance:report.rows['37'].total,
      balance:minus(report.rows['16'].total,report.rows['41'].total),
      schoolExpenses:sum([43,44,45,46,47,48,49].map(r=>report.rows[String(r)].total))};
  }
  const api={Ref,M,groups,editable,derived,initial,validate,reference,compute,totals};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LedgerMatrix=api;
})(typeof window!=='undefined'?window:globalThis);