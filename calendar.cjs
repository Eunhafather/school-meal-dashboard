(function(root){
'use strict';
const REF=typeof module!=='undefined'&&module.exports?require('./calendar-reference.cjs'):root.MealCalendarReference;
const M=[3,4,5,6,7,8,9,10,11,12,1,2];
function actualYear(year,m){return m<3?year+1:year;}
function length(year,m){return new Date(Date.UTC(actualYear(year,m),m,0)).getUTCDate();}
function initial(year=2026){return {year,months:Object.fromEntries(M.map(m=>[m,{use:[false,false,false],grades:[0,1,2].map(i=>Array.from({length:length(year,m)},(_,d)=>year===2026&&REF[m].grades[i].includes(d+1)?1:0)),notes:{}}]))};}
function validate(x,year=2026){if(x===undefined||x===null)return initial(year);if(!Number.isSafeInteger(year)||year<1900||year>2200||x.year!==year||!x.months||typeof x.months!=='object'||Array.isArray(x.months)||Object.keys(x.months).some(m=>!M.includes(Number(m))))throw Error('학사일정 학년도·월 형식이 올바르지 않습니다.');
const months=Object.fromEntries(M.map(m=>{const v=x.months[m],n=length(year,m);if(!v||!Array.isArray(v.use)||v.use.length!==3||v.use.some(a=>typeof a!=='boolean')||!Array.isArray(v.grades)||v.grades.length!==3||v.grades.some(a=>!Array.isArray(a)||a.length!==n||a.some(b=>b!==0&&b!==1)))throw Error(m+'월 학년별 일정은 실제 날짜별 0 또는 1이어야 합니다.');
if(!v.notes||typeof v.notes!=='object'||Array.isArray(v.notes)||Object.entries(v.notes).some(([d,t])=>!/^([1-9]|[12][0-9]|3[01])$/.test(d)||+d>n||typeof t!=='string'||t.length>120))throw Error(m+'월 학사일정 메모를 확인하세요 (날짜별 120자 이내).');return [m,{use:[...v.use],grades:v.grades.map(a=>[...a]),notes:Object.fromEntries(Object.entries(v.notes).filter(([,t])=>t.trim()))}];}));return {year,months};}
function days(calendar,m,i){const v=calendar?.months?.[m];return v?.use?.[i]===true?v.grades[i].reduce((a,b)=>a+b,0):null;}
function totals(calendar,m){return calendar.months[m].grades.map(a=>a.reduce((x,y)=>x+y,0));}
function weekday(year,m,d){return new Date(Date.UTC(actualYear(year,m),m-1,d)).getUTCDay();}
// A date edit is itself the instruction to use the schedule for that month/grade.
// Unedited legacy inputs remain untouched; use[] is retained for backup compatibility.
function setRange(calendar,m,grade,from,to,value){const v=calendar?.months?.[m],n=length(calendar?.year,m);if(!M.includes(m)||!v||(grade!=='all'&&(!Number.isInteger(grade)||grade<0||grade>2))||!Number.isInteger(from)||!Number.isInteger(to)||from<1||to>n||from>to||(value!==0&&value!==1))throw Error('학사일정 학년·날짜·급식 여부를 확인하세요.');v.grades.forEach((g,i)=>{if(grade==='all'||grade===i){for(let d=from;d<=to;d++)g[d-1]=value;v.use[i]=true;}});}
function setDay(calendar,m,i,d,value){setRange(calendar,m,i,d,d,value);}
const api={M,REF,actualYear,length,initial,validate,days,totals,weekday,setDay,setRange};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MealCalendar=api;
})(typeof window!=='undefined'?window:globalThis);
