(function(root){
'use strict';
// Verified, offline civil-year dates. Do not infer substitute/temporary holidays.
// Calendar-year keys are independent of the academic-year data classification.
const SOURCES=Object.freeze([
 {name:'2026년 월력요항 · 한국천문연구원',url:'https://www.kasi.re.kr/kor/publication/post/newsMaterial/32031'},
 {name:'2027년 월력요항 · 우주항공청',url:'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431'},
 {name:'노동절·제헌절 공휴일 지정 · 인사혁신처',url:'https://www.mpm.go.kr/mpm/comm/newsPress/newsPressRelease?boardId=bbs_0000000000000029&cntId=4250&mode=view'},
 {name:'2027년 부처님오신날 날짜 교차 확인',url:'https://publicholidays.co.kr/ko/buddhas-birthday'}
].map(Object.freeze));
const RAW={
 2026:[
 ['01-01','1월 1일'],['02-16','설 연휴'],['02-17','설날'],['02-18','설 연휴'],
 ['03-01','3·1절'],['03-02','대체공휴일 (3·1절)','substitute'],
 ['05-01','노동절'],['05-05','어린이날'],['05-24','부처님오신날'],['05-25','대체공휴일 (부처님오신날)','substitute'],
 ['06-03','제9회 전국동시지방선거','election'],['06-06','현충일'],['07-17','제헌절'],
 ['08-15','광복절'],['08-17','대체공휴일 (광복절)','substitute'],
 ['09-24','추석 연휴'],['09-25','추석'],['09-26','추석 연휴'],
 ['10-03','개천절'],['10-05','대체공휴일 (개천절)','substitute'],['10-09','한글날'],['12-25','성탄절']
 ],
 2027:[
 ['01-01','1월 1일'],['02-06','설 연휴'],['02-07','설날'],['02-08','설 연휴'],['02-09','대체공휴일 (설날)','substitute'],
 ['03-01','3·1절'],['05-01','노동절'],['05-03','대체공휴일 (노동절)','substitute'],['05-05','어린이날'],['05-13','부처님오신날'],
 ['06-06','현충일'],['07-17','제헌절'],['07-19','대체공휴일 (제헌절)','substitute'],
 ['08-15','광복절'],['08-16','대체공휴일 (광복절)','substitute'],
 ['09-14','추석 연휴'],['09-15','추석'],['09-16','추석 연휴'],
 ['10-03','개천절'],['10-04','대체공휴일 (개천절)','substitute'],['10-09','한글날'],['10-11','대체공휴일 (한글날)','substitute'],
 ['12-25','성탄절'],['12-27','대체공휴일 (성탄절)','substitute']
 ]
};
const DATA=Object.freeze(Object.fromEntries(Object.entries(RAW).map(([year,rows])=>[year,Object.freeze(Object.fromEntries(rows.map(([md,name,type='public'])=>[md,Object.freeze({date:year+'-'+md,name,type})])))])));
function supports(year){return Object.hasOwn(DATA,year);}
function month(year,m){if(!Number.isInteger(year)||!Number.isInteger(m)||m<1||m>12)return [];const prefix=String(m).padStart(2,'0')+'-';return Object.entries(DATA[year]??{}).filter(([md])=>md.startsWith(prefix)).map(([,h])=>h);}
function at(year,m,d){if(!Number.isInteger(year)||!Number.isInteger(m)||!Number.isInteger(d)||m<1||m>12||d<1||d>31)return null;return DATA[year]?.[String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')]??null;}
const api=Object.freeze({years:Object.freeze([2026,2027]),SOURCES,supports,month,at});
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MealHolidays=api;
})(typeof window!=='undefined'?window:globalThis);
