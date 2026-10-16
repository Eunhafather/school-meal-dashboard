(function(root){
'use strict';
const REF=typeof module!=='undefined'&&module.exports?require('./calendar-reference.cjs'):root.MealCalendarReference;
const M=[3,4,5,6,7,8,9,10,11,12,1,2];
function actualYear(year,m){return m<3?year+1:year;}
function length(year,m){return new Date(Date.UTC(actualYear(year,m),m,0)).getUTCDate();}
function initial(year=2026){return {year,months:Object.fromEntries(M.map(m=>[m,{use:[false,false,false],grades:[0,1,2].map(i=>Array.from({length:length(year,m)},(_,d)=>year===2026&&REF[m].grades[i].includes(d+1)?1:0)),notes:{}}]))};}
function validate(x,year=2026){if(x===undefined||x===null)return initial(year);if(!Number.isSafeInteger(year)||year<1900||year>2200||x.year!==year||!x.months||typeof x.months!=='object'||Array.isArray(x.months)||Object.keys(x.months).some(m=>!M.includes(Number(m))))throw Error('학사일정 학년도·월 형식이 올바르지 않습니다.');
const months=Object.fromEntries(M.map(m=>{const n=length(year,m),v=x.months[m],out=cleanMonth(v,n,m);if(v.bulkUndo!==undefined)out.bulkUndo=cleanUndo(v.bulkUndo,n,m);return [m,out];}));return {year,months};}
function cleanMonth(v,n,m){if(!v||!Array.isArray(v.use)||v.use.length!==3||v.use.some(a=>typeof a!=='boolean')||!Array.isArray(v.grades)||v.grades.length!==3||v.grades.some(a=>!Array.isArray(a)||a.length!==n||a.some(b=>b!==0&&b!==1)))throw Error(m+'월 학년별 일정은 실제 날짜별 0 또는 1이어야 합니다.');
if(!v.notes||typeof v.notes!=='object'||Array.isArray(v.notes)||Object.entries(v.notes).some(([d,t])=>!/^([1-9]|[12][0-9]|3[01])$/.test(d)||+d>n||typeof t!=='string'||t.length>120))throw Error(m+'월 학사일정 메모를 확인하세요 (날짜별 120자 이내).');return {use:[...v.use],grades:v.grades.map(a=>[...a]),notes:Object.fromEntries(Object.entries(v.notes).filter(([,t])=>t.trim()))};}
function checkPeriod(n,grade,from,to,value,note){if((grade!=='all'&&(!Number.isInteger(grade)||grade<0||grade>2))||!Number.isInteger(from)||!Number.isInteger(to)||from<1||to>n||from>to||![0,1,'keep'].includes(value)||typeof note!=='string'||note.length>120)throw Error('학사일정 학년·날짜·급식 여부·메모를 확인하세요.');}
function applyMonth(v,grade,from,to,value,note){if(value!=='keep')v.grades.forEach((g,i)=>{if(grade==='all'||grade===i){for(let d=from;d<=to;d++)g[d-1]=value;v.use[i]=true;}});if(note)for(let d=from;d<=to;d++)v.notes[d]=note;}
function cleanUndo(u,n,m){if(!u||typeof u!=='object'||Array.isArray(u))throw Error(m+'월 기간 반영 취소 기록을 확인하세요.');const {grade,from,to,value,note}=u;checkPeriod(n,grade,from,to,value,note);const before=cleanMonth(u.before,n,m),after=cleanMonth(u.after,n,m),expected=cleanMonth(before,n,m);applyMonth(expected,grade,from,to,value,note);if(JSON.stringify(expected)!==JSON.stringify(after))throw Error(m+'월 기간 반영 취소 기록이 일치하지 않습니다.');return {grade,from,to,value,note,before,after};}

function days(calendar,m,i){const v=calendar?.months?.[m];return v?.use?.[i]===true?v.grades[i].reduce((a,b)=>a+b,0):null;}
function totals(calendar,m){return calendar.months[m].grades.map(a=>a.reduce((x,y)=>x+y,0));}
function weekday(year,m,d){return new Date(Date.UTC(actualYear(year,m),m-1,d)).getUTCDay();}
// A date edit is itself the instruction to use the schedule for that month/grade.
// Unedited legacy inputs remain untouched; use[] is retained for backup compatibility.
function setRange(calendar,m,grade,from,to,value){const v=calendar?.months?.[m],n=length(calendar?.year,m);if(!M.includes(m)||!v||value==='keep')throw Error('학사일정 학년·날짜·급식 여부를 확인하세요.');checkPeriod(n,grade,from,to,value,'');applyMonth(v,grade,from,to,value,'');}
function setDay(calendar,m,i,d,value){setRange(calendar,m,i,d,d,value);}
// Save one reversible period operation per month, including the previous linkage flags.
// The record is included in normal saves/backups, never in financial/grant records.
function applyPeriod(calendar,m,grade,from,to,value,note=''){const v=calendar?.months?.[m],n=length(calendar?.year,m);if(!M.includes(m)||!v)throw Error('학사일정 대상 월을 확인하세요.');checkPeriod(n,grade,from,to,value,note);note=note.trim();const before=cleanMonth(v,n,m),after=cleanMonth(v,n,m);applyMonth(after,grade,from,to,value,note);if(JSON.stringify(before)===JSON.stringify(after))return false;Object.assign(v,cleanMonth(after,n,m),{bulkUndo:{grade,from,to,value,note,before,after}});return true;}
function undoPeriod(calendar,m){const v=calendar?.months?.[m],n=length(calendar?.year,m);if(!M.includes(m)||!v?.bulkUndo)throw Error('취소할 기간 반영이 없습니다.');const u=cleanUndo(v.bulkUndo,n,m),target=[0,1,2].filter(i=>u.value!=='keep'&&(u.grade==='all'||u.grade===i)),conflict=()=>{throw Error('기간 반영 후 같은 날짜의 급식 여부나 메모가 다시 수정되었습니다. 이후 입력을 보호하기 위해 취소하지 않았습니다. 해당 날짜를 확인해 직접 수정하세요.');};
// Check the entire reverse patch before touching anything. Other dates/grades stay intact.
for(const i of target)for(let d=u.from;d<=u.to;d++)if(v.grades[i][d-1]!==u.after.grades[i][d-1])conflict();if(u.note)for(let d=u.from;d<=u.to;d++)if((v.notes[d]??null)!==(u.after.notes[d]??null))conflict();
for(const i of target){const unchanged=v.grades[i].every((x,d)=>x===u.after.grades[i][d]);for(let d=u.from;d<=u.to;d++)v.grades[i][d-1]=u.before.grades[i][d-1];if(unchanged)v.use[i]=u.before.use[i];}
if(u.note)for(let d=u.from;d<=u.to;d++){if(u.before.notes[d]!==undefined)v.notes[d]=u.before.notes[d];else delete v.notes[d];}delete v.bulkUndo;return {grade:u.grade,from:u.from,to:u.to};}

const api={M,REF,actualYear,length,initial,validate,days,totals,weekday,setDay,setRange,applyPeriod,undoPeriod};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MealCalendar=api;
})(typeof window!=='undefined'?window:globalThis);
