const assert=require('node:assert/strict');
const C=require('./core.cjs');
let count=0;
const test=(name,fn)=>{fn();count++;console.log('PASS',name);};
test('blank differs from zero',()=>{assert.equal(C.amount(''),null);assert.equal(C.amount('  '),null);assert.equal(C.amount('0'),0);assert.equal(C.amount('1,000'),1000);});
test('original used when change empty',()=>assert.deepEqual(C.effective({original:100,revised:null}),{value:100,source:'최초 입력액'}));
test('changed total overrides original, not added',()=>assert.equal(C.effective({original:100,revised:80}).value,80));
test('changed zero is a valid override',()=>assert.equal(C.effective({original:100,revised:0}).value,0));
test('override can exist without original',()=>assert.equal(C.effective({original:null,revised:12}).value,12));
test('clearing override restores original',()=>{const e={original:100,revised:80};e.revised=null;assert.equal(C.effective(e).value,100);});
test('both empty are unentered',()=>assert.equal(C.effective(C.emptyEntry()).value,null));
test('negative decimals, NaN, exponent rejected',()=>['-1','1.5','abc','Infinity','1e3'].forEach(x=>assert.throws(()=>C.amount(x))));
test('large values rejected',()=>assert.throws(()=>C.amount(String(C.MAX+1))));
test('quarter mode excludes stored months',()=>{
  let s=C.initial(),p=C.emptyPeriod();p.quarter.original=90;p.months['3'].original=100;s=C.savePeriod(s,'food-edu',0,p);
  assert.equal(C.summarize(s).total,90);
});
test('monthly mode excludes preserved quarter and uses monthly override',()=>{
  let s=C.initial(),p=C.emptyPeriod();p.mode='monthly';p.quarter.original=90;p.months['3'].original=100;p.months['4']={original:50,revised:0,reason:'취소'};p.months['5']={original:60,revised:40,reason:'감액'};
  s=C.savePeriod(s,'food-edu',0,p);assert.equal(C.summarize(s).total,140);assert.equal(C.summarize(s).overridden,2);
});
test('year rollover quarter covers December-January-February',()=>assert.deepEqual(C.ranges(C.initial())[3].months,[12,1,2]));
test('editable quarter boundaries cover every month once',()=>{
  const s=C.initial();s.ends=[0,4,8,11];assert.deepEqual(C.ranges(s).flatMap(q=>q.months),C.MONTHS);C.validateState(s);
});
test('overlapping or unordered quarters rejected',()=>{const s=C.initial();s.ends=[5,2,8,11];assert.throws(()=>C.validateState(s));});
test('audit preserves before and after and does not mutate input',()=>{
  const s=C.initial();let p=C.emptyPeriod();p.quarter.original=100;const s2=C.savePeriod(s,'food-edu',0,p,'2026-10-16T00:00:00Z');
  p=structuredClone(p);p.quarter.revised=70;p.quarter.reason='정산';const s3=C.savePeriod(s2,'food-edu',0,p);
  assert.equal(C.summarize(s).total,0);assert.equal(C.summarize(s2).total,100);assert.equal(C.summarize(s3).total,70);
  assert.equal(s3.history[1].before.quarter.revised,null);assert.equal(s3.history[1].after.quarter.revised,70);
});
test('empty reason for zero override rejected',()=>{let p=C.emptyPeriod();p.quarter.revised=0;assert.throws(()=>C.validatePeriod(p));});
test('save no-op creates no history',()=>{const s=C.initial();assert.equal(C.savePeriod(s,'food-edu',0,C.emptyPeriod()),s);});
test('backup roundtrip retains values and history',()=>{
  let s=C.initial(),p=C.emptyPeriod();p.quarter={original:100,revised:0,reason:'취소'};s=C.savePeriod(s,'food-edu',0,p);
  assert.deepEqual(C.validateState(JSON.parse(JSON.stringify(s))),s);
});
test('bad versions and duplicate IDs rejected',()=>{
  assert.throws(()=>C.validateState({...C.initial(),version:3}));const s=C.initial();s.funds.push(s.funds[0]);assert.throws(()=>C.validateState(s));
});
test('prototype-polluting IDs and negative backup values rejected',()=>{
  let s=C.initial();s.funds[0].id='__proto__';assert.throws(()=>C.validateState(s));
  s=C.initial();let p=C.emptyPeriod();p.quarter.original=-2;s.records['food-edu']={'0':p};assert.throws(()=>C.validateState(s));
});
test('preserved inactive values survive input mode changes',()=>{
  let s=C.initial(),p=C.emptyPeriod();p.quarter.original=90;p.months['3'].original=30;s=C.savePeriod(s,'food-edu',0,p);
  p=structuredClone(p);p.mode='monthly';s=C.savePeriod(s,'food-edu',0,p);assert.equal(C.summarize(s).total,30);
  p.mode='quarter';s=C.savePeriod(s,'food-edu',0,p);assert.equal(C.summarize(s).total,90);
});
test('2026 support rates and annual labor use confirmed values',()=>{
 const x=C.Funding.initial();assert.equal(x.rates.studentFood,4670);assert.equal(x.rates.studentOperations,540);assert.equal(C.Funding.compute(x).categories.labor.applied,318588000);
});
test('unconfirmed future years have no invented subsidy rates',()=>assert.equal(C.Funding.initial(2027).rates.studentFood,null));
test('student grade headcounts multiply days and sum',()=>{
 const x=C.Funding.initial();x.meals['3'].grades=[{people:300,days:20},{people:280,days:18},{people:290,days:20}];
 const r=C.Funding.compute(x).monthly[0];assert.equal(r.studentMeals,16840);assert.equal(r.food,16840*4670);assert.equal(r.operations,16840*540);
});
test('student actual zero overrides planned meals',()=>{
 const x=C.Funding.initial();x.meals['3'].grades=[{people:300,days:20},{people:280,days:18},{people:290,days:20}];x.meals['3'].actualStudent=0;
 assert.equal(C.Funding.compute(x).monthly[0].food,0);
});
test('staff meal split includes rice in food exactly once',()=>{
 const x=C.Funding.initial();x.meals['3'].staff=100;
 const r=C.Funding.compute(x);assert.equal(r.staffRate,6230);assert.equal(r.foodStaffRate,4733);
 const z=r.monthly[0].staff;assert.equal(z.food,473300);assert.equal(z.operations,54000);assert.equal(z.labor,87000);assert.equal(z.vat,8700);assert.equal(z.total,623000);assert.equal(z.food+z.operations+z.labor+z.vat,z.total);
});
test('staff and external amounts never added to student subsidy',()=>{
 const x=C.Funding.initial();const a=C.Funding.compute(x).total;x.meals['3'].staff=100;x.meals['3'].external=100;
 assert.equal(C.Funding.compute(x).total,a);
});
test('annual labor is counted once, unrelated to student meals',()=>{
 const x=C.Funding.initial();for(const m of C.MONTHS)x.meals[String(m)].actualStudent=0;
 const r=C.Funding.compute(x);assert.equal(r.total,318588000);assert.equal(r.categories.labor.applied,318588000);assert.equal(r.missing,0);
});
test('monthly settlement overrides formula including zero',()=>{
 const x=C.Funding.initial();x.meals['3'].actualStudent=100;x.corrections.food.months['3']={value:0,reason:'취소'};
 const r=C.Funding.compute(x);assert.equal(r.quarters[0].food.rows[0].base,467000);assert.equal(r.quarters[0].food.rows[0].applied,0);
});
test('quarter correction overrides entire quarter, not monthly correction sum',()=>{
 const x=C.Funding.initial();for(const m of [3,4,5])x.meals[String(m)].actualStudent=100;
 x.corrections.food.months['3']={value:0,reason:'월 보정'};x.corrections.food.mode='quarter';x.corrections.food.quarters[0]={value:1000000,reason:'분기 정산'};
 const r=C.Funding.compute(x);assert.equal(r.quarters[0].food.applied,1000000);assert.equal(r.quarters[0].food.rows[0].applied,null);assert.equal(x.corrections.food.months['3'].value,0);
});
test('clearing quarter correction returns to formula in quarter mode',()=>{
 const x=C.Funding.initial();for(const m of [3,4,5])x.meals[String(m)].actualStudent=100;
 x.corrections.food.mode='quarter';x.corrections.food.quarters[0]={value:null,reason:''};
 assert.equal(C.Funding.compute(x).quarters[0].food.applied,1401000);
});
test('changing rates does not overwrite saved settlement corrections',()=>{
 const x=C.Funding.initial();x.meals['3'].actualStudent=100;x.corrections.food.months['3']={value:42,reason:'확정'};x.rates.studentFood=5000;
 const r=C.Funding.compute(x);assert.equal(r.quarters[0].food.rows[0].base,500000);assert.equal(r.quarters[0].food.rows[0].applied,42);
});
test('annual labor settlement zero overrides annual base',()=>{
 const x=C.Funding.initial();x.corrections.labor={value:0,reason:'전액 감액'};assert.equal(C.Funding.compute(x).categories.labor.applied,0);
});
test('new data validates and survives backup roundtrip',()=>{
 const s=C.initial();s.calculation.meals['3'].staff=100;assert.deepEqual(C.validateState(JSON.parse(JSON.stringify(s))),s);
});
test('legacy backup without calculation is migrated without losing grant records',()=>{
 const s=C.initial();delete s.calculation;const r=C.validateState(s);assert.deepEqual(r.records,s.records);assert.equal(r.calculation.rates.annualLabor,318588000);
});
test('invalid meal days and unexplained corrections rejected',()=>{
 const x=C.Funding.initial();x.meals['3'].grades[0].days=32;assert.throws(()=>C.Funding.validate(x));
 const y=C.Funding.initial();y.corrections.labor={value:0,reason:''};assert.throws(()=>C.Funding.validate(y));
});
console.log(`${count} tests passed.`);