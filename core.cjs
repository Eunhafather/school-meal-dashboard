(function(root) {
  'use strict';
  const MAX = 9_000_000_000_000;
  const MONTHS = [3,4,5,6,7,8,9,10,11,12,1,2];
  const Funding=typeof module!=='undefined'&&module.exports?require('./funding.cjs'):root.MealFunding;
  const Matrix=typeof module!=='undefined'&&module.exports?require('./ledger-matrix.cjs'):root.LedgerMatrix;
  function amount(value) {
    const text = String(value ?? '').trim().replace(/,/g, '');
    if (text === '') return null;
    if (!/^\d+$/.test(text)) throw new Error('금액은 0 이상의 정수로 입력해주세요.');
    const n = Number(text);
    if (!Number.isSafeInteger(n) || n > MAX) throw new Error('금액이 허용 범위를 벗어났습니다.');
    return n;
  }
  function money(n) {
    return n === null || n === undefined ? '미입력' : n.toLocaleString('ko-KR') + '원';
  }
  function effective(entry) {
    if (!entry) return {value:null, source:'미입력'};
    if (entry.revised !== null && entry.revised !== undefined) return {value:entry.revised, source:'정산 변경액'};
    if (entry.original !== null && entry.original !== undefined) return {value:entry.original, source:'최초 입력액'};
    return {value:null, source:'미입력'};
  }
  function emptyEntry() { return {original:null, revised:null, reason:''}; }
  function emptyPeriod() {
    return {mode:'quarter', quarter:emptyEntry(), months:Object.fromEntries(MONTHS.map(m=>[String(m),emptyEntry()]))};
  }
  function initial(year = 2026) {
    return {
      version:1, year, ends:[2,5,8,11], updatedAt:null, history:[],
      funds:[
        {id:'food-edu', name:'식재료비 · 교육청', category:'식재료비'},
        {id:'food-city', name:'식재료비 · 안산시', category:'식재료비'},
        {id:'operations', name:'운영비 · 교육청', category:'운영비'},
        {id:'labor', name:'인건비', category:'인건비'}
      ],
      records:{}, calculation:Funding.initial(year),matrix:null,grantIntegration:{version:1,archive:[],manualArchive:{},conflicts:[]}
    };
  }
  function ranges(state) {
    let from = 0;
    return state.ends.map((end,i)=> {
      const list = MONTHS.slice(from,end+1); from=end+1;
      return {index:i, months:list, label:`${i+1}분기`, span:list.map(m=>m+'월').join(' · ')};
    });
  }
  function period(state, fundId, index) {
    return state.records[fundId]?.[String(index)] ?? emptyPeriod();
  }
  function entries(state, fundId, index, override) {
    const p = override ?? period(state,fundId,index);
    if(p.mode === 'quarter') return [{label:ranges(state)[index].label, entry:p.quarter}];
    return ranges(state)[index].months.map(m=>({label:m+'월', entry:p.months[String(m)]}));
  }
  function summarize(state, selectedFund = null) {
    state=integrateGrants(state);
    let original = 0, total = 0, overridden=0, missing=0, active=0,conflicts=0;
    const byQuarter = [0,0,0,0];
    const byCategory = {};
    for(const fund of state.funds.filter(x=>!selectedFund||x.id===selectedFund)) {
      byCategory[fund.category] ??= 0;
      for(let q=0;q<4;q++) {
        if(grantStatus(state,fund.id,q)==='conflict'){conflicts++;continue;}
        if(grantStatus(state,fund.id,q)==='excluded')continue;
        for(const {entry} of entries(state,fund.id,q)) {
        const e=effective(entry);
        if(e.value===null) { missing++; continue; }
        active++;
        original+=entry.original??0;
        total+=e.value; byQuarter[q]+=e.value; byCategory[fund.category]+=e.value;
        if(entry.revised!==null && entry.revised!==undefined) overridden++;
      }}
    }
    return {original,total,difference:total-original,overridden,missing,active,byQuarter,byCategory,conflicts};
  }
  function validateEntry(entry) {
    if(!entry || typeof entry!=='object') throw new Error('입력 항목 형식이 올바르지 않습니다.');
    for(const k of ['original','revised']) if(entry[k]!==null) {
      if(typeof entry[k]!=='number'||!Number.isSafeInteger(entry[k])||entry[k]<0||entry[k]>MAX) throw new Error('백업의 금액이 올바르지 않습니다.');
    }
    if(typeof entry.reason!=='string'||entry.reason.length>500) throw new Error('변경 사유는 500자 이내로 입력해주세요.');
    if(entry.revised!==null && !entry.reason.trim()) throw new Error('정산 변경액을 입력했다면 변경 사유도 적어주세요.');
    return {original:entry.original,revised:entry.revised,reason:entry.reason};
  }
  function validatePeriod(p) {
    if(!p||!['quarter','monthly'].includes(p.mode)) throw new Error('입력 방식이 올바르지 않습니다.');
    if(!p.months||typeof p.months!=='object') throw new Error('월별 항목이 없습니다.');
    return {mode:p.mode,quarter:validateEntry(p.quarter), months:Object.fromEntries(MONTHS.map(m=>[String(m),validateEntry(p.months[String(m)])]))};
  }
  function cleanText(s, max) {return typeof s==='string'?s.slice(0,max):'';}
  function validateState(obj) {
    if(!obj||obj.version!==1||!Number.isInteger(obj.year)||obj.year<2000||obj.year>2100) throw new Error('지원하지 않는 백업 형식 또는 학년도입니다.');
    if(!Array.isArray(obj.ends)||obj.ends.length!==4||obj.ends[3]!==11||obj.ends.some((x,i)=>!Number.isInteger(x)||x<0||x>11||(i>0&&x<=obj.ends[i-1]))) throw new Error('분기 구간이 올바르지 않습니다.');
    if(!Array.isArray(obj.funds)||obj.funds.length<1||obj.funds.length>20) throw new Error('지원 항목은 1~20개여야 합니다.');
    if(obj.calculation?.planning?.enabled&&obj.ends.join(',')!=='2,5,8,11')throw new Error('학생수 신청 기능은 학년도 고정 분기를 사용합니다.');
    const ids=new Set();
    const funds=obj.funds.map(f=>{
      if(!f||typeof f.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(f.id)||ids.has(f.id)) throw new Error('지원 항목 ID가 올바르지 않습니다.');
      if(!['식재료비','운영비','인건비','기타'].includes(f.category)||typeof f.name!=='string'||!f.name.trim()||f.name.length>60) throw new Error('지원 항목 이름·분류가 올바르지 않습니다.');
      ids.add(f.id); return {id:f.id,name:f.name,category:f.category};
    });
    const records={};
    for(const f of funds) {
      const periods={};
      for(let q=0;q<4;q++) if(obj.records?.[f.id]?.[String(q)]) periods[String(q)]=validatePeriod(obj.records[f.id][String(q)]);
      if(Object.keys(periods).length) records[f.id]=periods;
    }
    const history=Array.isArray(obj.history)?obj.history.slice(-500).map(h=>{
      // Re-validate history as well: imported audit text is not executable markup.
      if(!h||typeof h!=='object') throw new Error('변경 이력 형식이 올바르지 않습니다.');
      const out={at:cleanText(h.at,40),action:cleanText(h.action,80),fund:cleanText(h.fund,60),quarter:cleanText(h.quarter,20)};
      if(h.before && h.after) {out.before=validatePeriod(h.before);out.after=validatePeriod(h.after);}
      if(h.detail) out.detail=cleanText(h.detail,500);
      return out;
    }):[];
    return integrateGrants({version:1,year:obj.year,ends:[...obj.ends],funds,records,history,updatedAt:cleanText(obj.updatedAt,40)||null,calculation:Funding.validate(obj.calculation,obj.year),matrix:Matrix.validate(obj.matrix,obj.year),grantIntegration:obj.grantIntegration});
  }
  function savePeriod(state,fundId,index,next,now=new Date().toISOString()) {
    const clean=validatePeriod(next);
    const before=period(state,fundId,index);
    if(JSON.stringify(before)===JSON.stringify(clean)) return state;
    const out=structuredClone(state);
    out.records[fundId]??={}; out.records[fundId][String(index)]=clean;
    out.updatedAt=now;
    out.history.push({at:now,action:'지원금 입력·변경',fund:state.funds.find(f=>f.id===fundId).name,quarter:(index+1)+'분기',before:structuredClone(before),after:structuredClone(clean)});
    out.history=out.history.slice(-500); return integrateGrants(out);
  }
  function hasData(state) {
    if(state.grantIntegration?.conflicts.length||state.grantIntegration?.archive.some(q=>[q.food,q.operations,...Object.values(q.grants)].some(e=>e.original!==null||e.revised!==null||e.reason!=='')))return true;
    return state.funds.some(f=>[0,1,2,3].some(q=>{
      const p=period(state,f.id,q);
      return [p.quarter,...Object.values(p.months)].some(e=>e.original!==null||e.revised!==null||e.reason!=='');
    }));
  }

  // One authoritative grant book. Planning grant fields below are derived views only.
  const GRANT_MAP={'food-edu':'educationFood','food-city':'cityFood','operations':'educationOperations'};
  const GRANT_NAMES={'food-edu':['식재료비 · 교육청','식재료비'],'food-city':['식재료비 · 안산시','식재료비'],'operations':['운영비 · 교육청','운영비'],'legacy-food':['식재료비 · 기존 재원 미분리','식재료비']};
  const hasEntry=e=>e.original!==null||e.revised!==null||e.reason!=='';
  function grantStatus(s,id,q){
    if(s.grantIntegration?.conflicts.some(c=>c.fundId===id&&c.quarter===q))return 'conflict';
    if(id==='legacy-food'&&['food-edu','food-city'].some(f=>entries(s,f,q).some(x=>hasEntry(x.entry))||s.grantIntegration?.conflicts.some(c=>c.fundId===f&&c.quarter===q)))return 'excluded';
    return 'active';
  }
  function grantAggregate(s,id,q){
    if(grantStatus(s,id,q)!=='active')return emptyEntry();
    const p=period(s,id,q);if(p.mode==='quarter')return structuredClone(p.quarter);
    const list=entries(s,id,q).map(x=>x.entry),all=list.every(e=>effective(e).value!==null),changed=list.some(e=>e.revised!==null);
    if(list.reduce((a,e)=>a+(e.original??0),0)>MAX||list.reduce((a,e)=>a+(effective(e).value??0),0)>MAX)throw Error('월별 교부액의 분기 합계가 허용 범위를 넘었습니다.');
    return {original:list.every(e=>e.original!==null)?list.reduce((a,e)=>a+e.original,0):null,revised:all&&changed?list.reduce((a,e)=>a+effective(e).value,0):null,reason:all&&changed?'월별 교부액 합계 · 개별 변경 사유는 통합 교부표 참조':''};
  }
  function syncGrants(s){
    const fixed=s.ends.join(',')==='2,5,8,11';
    s.calculation.planning.quarters.forEach((q,i)=>{
      q.grants=Object.fromEntries(Object.entries(GRANT_MAP).map(([id,k])=>[k,fixed?grantAggregate(s,id,i):emptyEntry()]));
      q.food=fixed?grantAggregate(s,'legacy-food',i):emptyEntry();q.operations=emptyEntry();
    });
    return s;
  }
  function integrateGrants(input){
    const s=structuredClone(input),meta=s.grantIntegration;
    for(const id of Object.keys(GRANT_MAP)){if(!s.funds.some(f=>f.id===id)){if(s.funds.length>=20)throw Error('기본 교부 재원을 복원하려면 빈 지원 항목을 정리한 후 백업을 다시 불러오세요.');s.funds.push({id,name:GRANT_NAMES[id][0],category:GRANT_NAMES[id][1]});}}
    for(const f of s.funds){if(f.id==='food-city'&&f.name==='식재료비 · 지자체')f.name='식재료비 · 안산시';if(f.id==='operations'&&f.name==='운영비')f.name='운영비 · 교육청';}
    if(meta!==undefined){
      if(!meta||meta.version!==1||!Array.isArray(meta.archive)||![0,4].includes(meta.archive.length)||!Array.isArray(meta.conflicts)||meta.conflicts.length>16)throw Error('통합 교부 기록 형식을 확인하세요.');
      s.grantIntegration={version:1,manualArchive:Object.fromEntries(Object.entries(meta.manualArchive??{}).map(([id,qs])=>{if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)||!qs||Object.keys(qs).some(q=>!['0','1','2','3'].includes(q)))throw Error('통합 전 수기 원본 형식을 확인하세요.');return [id,Object.fromEntries(Object.entries(qs).map(([q,p])=>[q,validatePeriod(p)]))];})),archive:meta.archive.map(q=>({grants:Object.fromEntries(Object.values(GRANT_MAP).map(k=>[k,validateEntry(q.grants?.[k])])),food:validateEntry(q.food),operations:validateEntry(q.operations)})),conflicts:[]};
      const seen=new Set();
      for(const c of meta.conflicts){const key=c.fundId+':'+c.quarter;if(!GRANT_NAMES[c.fundId]||!s.funds.some(f=>f.id===c.fundId)||!Number.isInteger(c.quarter)||c.quarter<0||c.quarter>3||seen.has(key))throw Error('교부액 대조 기록을 확인하세요.');seen.add(key);s.grantIntegration.conflicts.push({fundId:c.fundId,quarter:c.quarter,entry:validateEntry(c.entry)});}
      return syncGrants(s);
    }
    const archive=s.calculation.planning.quarters.map(q=>({grants:structuredClone(q.grants),food:structuredClone(q.food),operations:structuredClone(q.operations)}));
    s.grantIntegration={version:1,archive,manualArchive:structuredClone(s.records),conflicts:[]};
    function migrate(id,q,entry){
      if(!hasEntry(entry))return;
      if(!s.funds.some(f=>f.id===id)){if(s.funds.length>=20)throw Error('기존 교부 재원을 보존하려면 빈 지원 항목을 정리한 후 백업을 다시 불러오세요.');s.funds.push({id,name:GRANT_NAMES[id][0],category:GRANT_NAMES[id][1]});}
      const current=period(s,id,q),active=entries(s,id,q).some(x=>hasEntry(x.entry));
      // Different quarter boundaries cannot silently reinterpret the old student grant.
      if(s.ends.join(',')!=='2,5,8,11'||((active||hasEntry(current.quarter))&&(current.mode!=='quarter'||JSON.stringify(current.quarter)!==JSON.stringify(entry))))s.grantIntegration.conflicts.push({fundId:id,quarter:q,entry:structuredClone(entry)});
      else if(!active){s.records[id]??={};s.records[id][q]={...structuredClone(current),mode:'quarter',quarter:structuredClone(entry)};}
    }
    archive.forEach((q,i)=>{
      for(const [id,k] of Object.entries(GRANT_MAP))migrate(id,i,k==='educationOperations'&&!hasEntry(q.grants[k])?q.operations:q.grants[k]);
      if(!['educationFood','cityFood'].some(k=>hasEntry(q.grants[k])))migrate('legacy-food',i,q.food);
    });
    return syncGrants(s);
  }
  function saveGrantBook(state,draft,now=new Date().toISOString()){
    // Validate as one transaction; failures never mutate the original state.
    let out=integrateGrants(state);
    const before=structuredClone(out);out.records=structuredClone(draft.records);
    const choices=draft.choices??{};
    out.grantIntegration.conflicts=out.grantIntegration.conflicts.filter(c=>{
      const choice=choices[c.fundId+':'+c.quarter];if(!choice)return true;
      if(!['manual','planning'].includes(choice))throw Error('기존 교부액 중 사용할 기록을 선택하세요.');
      if(choice==='planning'){const p=period(out,c.fundId,c.quarter);out.records[c.fundId]??={};out.records[c.fundId][c.quarter]={...structuredClone(p),mode:'quarter',quarter:structuredClone(c.entry)};}
      out.history.push({at:now,action:'교부액 중복 대조 확정',fund:out.funds.find(f=>f.id===c.fundId).name,quarter:(c.quarter+1)+'분기',detail:(choice==='manual'?'기존 수기 입력 기록':'기존 학생수 탭 교부 기록')+'을 적용. 다른 원본은 통합 전 기록 및 변경 이력에 보존. 수기 원본: '+JSON.stringify(period(before,c.fundId,c.quarter))});return false;
    });
    if(draft.useReceived)out.calculation.planning.quarters.forEach((q,i)=>q.useReceived=draft.useReceived[i]===true);
    out=validateState(out);
    out.calculation.planning.quarters.forEach((q,i)=>{if(q.useReceived!==before.calculation.planning.quarters[i].useReceived)out.history.push({at:now,action:'분기 교부 비교 설정',fund:'통합 교부내역',quarter:(i+1)+'분기',detail:q.useReceived?'교부 비교 적용':'교부 비교 해제'});});
    for(const f of out.funds)for(let q=0;q<4;q++){
      const a=period(before,f.id,q),b=period(out,f.id,q);if(JSON.stringify(a)!==JSON.stringify(b))out.history.push({at:now,action:'통합 교부내역 변경',fund:f.name,quarter:(q+1)+'분기',before:structuredClone(a),after:structuredClone(b)});
    }
    if(JSON.stringify(before.records)!==JSON.stringify(out.records)||JSON.stringify(before.grantIntegration.conflicts)!==JSON.stringify(out.grantIntegration.conflicts)||JSON.stringify(before.calculation.planning)!==JSON.stringify(out.calculation.planning))out.updatedAt=now;
    out.history=out.history.slice(-500);return out;
  }
  const api={MAX,MONTHS,amount,money,effective,emptyEntry,emptyPeriod,initial,ranges,period,entries,summarize,validateEntry,validatePeriod,validateState,savePeriod,hasData,Funding,Matrix,GRANT_MAP,integrateGrants,grantStatus,grantAggregate,saveGrantBook};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.MealGrant=api;
})(typeof window!=='undefined'?window:globalThis);