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
        {id:'food-city', name:'식재료비 · 지자체', category:'식재료비'},
        {id:'operations', name:'운영비', category:'운영비'},
        {id:'labor', name:'인건비', category:'인건비'}
      ],
      records:{}, calculation:Funding.initial(year),matrix:null
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
    let original = 0, total = 0, overridden=0, missing=0, active=0;
    const byQuarter = [0,0,0,0];
    const byCategory = {};
    for(const fund of state.funds.filter(x=>!selectedFund||x.id===selectedFund)) {
      byCategory[fund.category] ??= 0;
      for(let q=0;q<4;q++) for(const {entry} of entries(state,fund.id,q)) {
        const e=effective(entry);
        if(e.value===null) { missing++; continue; }
        active++;
        original+=entry.original??0;
        total+=e.value; byQuarter[q]+=e.value; byCategory[fund.category]+=e.value;
        if(entry.revised!==null && entry.revised!==undefined) overridden++;
      }
    }
    return {original,total,difference:total-original,overridden,missing,active,byQuarter,byCategory};
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
    return {version:1,year:obj.year,ends:[...obj.ends],funds,records,history,updatedAt:cleanText(obj.updatedAt,40)||null,calculation:Funding.validate(obj.calculation,obj.year),matrix:Matrix.validate(obj.matrix,obj.year)};
  }
  function savePeriod(state,fundId,index,next,now=new Date().toISOString()) {
    const clean=validatePeriod(next);
    const before=period(state,fundId,index);
    if(JSON.stringify(before)===JSON.stringify(clean)) return state;
    const out=structuredClone(state);
    out.records[fundId]??={}; out.records[fundId][String(index)]=clean;
    out.updatedAt=now;
    out.history.push({at:now,action:'지원금 입력·변경',fund:state.funds.find(f=>f.id===fundId).name,quarter:(index+1)+'분기',before:structuredClone(before),after:structuredClone(clean)});
    out.history=out.history.slice(-500); return out;
  }
  function hasData(state) {
    return state.funds.some(f=>[0,1,2,3].some(q=>{
      const p=period(state,f.id,q);
      return [p.quarter,...Object.values(p.months)].some(e=>e.original!==null||e.revised!==null||e.reason!=='');
    }));
  }
  const api={MAX,MONTHS,amount,money,effective,emptyEntry,emptyPeriod,initial,ranges,period,entries,summarize,validateEntry,validatePeriod,validateState,savePeriod,hasData,Funding,Matrix};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.MealGrant=api;
})(typeof window!=='undefined'?window:globalThis);