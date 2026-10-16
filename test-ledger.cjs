const assert=require('node:assert/strict'),C=require('./core.cjs'),L=C.Matrix;
let passed=0;const test=(n,fn)=>{fn();passed++;console.log('PASS',n);};
const seed=()=>{const s=C.initial();s.matrix=L.initial(2026,true);return s;};
test('reference has 44 rows including school subtotal with complete matching annual sums',()=>{
 const r=L.reference();
 for(const row of Object.values(r.rows))assert.ok(Math.abs(row.values.reduce((n,x)=>n+(x??0),0)-(row.total??0))<.01);
 assert.equal(Object.keys(r.rows).length,44);assert.equal(r.rows['16'].total,1210502232);
});
test('seeded working reproduces every original numeric cell except intentionally computed unpaid row',()=>{
 const report=L.compute(seed()),ref=L.Ref;
 for(const [key,row] of Object.entries(ref.rows)){
  if(key==='11')continue;
  for(let i=0;i<12;i++){
   const got=report.rows[key].values[i],expected=row.values[i];
   if(got===null||expected===null)assert.equal(got,expected,`${key}:${L.M[i]}`);
   else assert.ok(Math.abs(got-expected)<.01,`${key}:${L.M[i]}`);
  }
  assert.ok(Math.abs(report.rows[key].total-row.total)<.01,`total ${key}`);
 }
});
test('reference income excludes duplicate expected/charged/received rows',()=>{
 const r=L.reference();for(let i=0;i<12;i++)assert.equal(r.rows['16'].values[i],r.rows['7'].values[i]+r.rows['15'].values[i]);
});
test('support balance excludes separately funded school expenses',()=>{
 const t=L.totals(L.compute(seed()));assert.equal(t.balance,7987692);assert.equal(t.schoolExpenses,12725320);
});
test('zero cell override recalculates subtotals and balances',()=>{
 const s=seed();s.matrix.overrides['26:3']={value:0,reason:'취소'};
 const r=L.compute(s);assert.equal(r.rows['26'].values[0],0);assert.equal(r.rows['36'].values[0],2932670-681000);assert.equal(r.rows['37'].values[0],7168030+681000);assert.equal(L.totals(r).balance,7987692+681000);
});
test('clearing override restores original derived value',()=>{
 const s=seed();s.matrix.overrides['26:3']={value:0,reason:'취소'};delete s.matrix.overrides['26:3'];assert.equal(L.compute(s).rows['26'].values[0],681000);
});
test('matrix cell settlement overrides monthly funding correction',()=>{
 const s=seed();s.calculation.corrections.food.months['3']={value:100,reason:'월정산'};s.matrix.overrides['4:3']={value:0,reason:'최종수정'};
 assert.equal(L.compute(s).rows['4'].values[0],0);
});
test('quarter corrections are counted once and not fabricated as monthly receipts',()=>{
 const s=seed();s.calculation.corrections.food.mode='quarter';s.calculation.corrections.food.quarters[0]={value:200000000,reason:'분기정산'};
 const r=L.compute(s);assert.equal(r.rows['4'].values[0],null);assert.equal(r.rows['4'].total,734614350-(80398720+82752400+70339540)+200000000);assert.equal(r.rows['41'].total,1202514540);assert.equal(r.rows['25'].values[0],null);
});
test('new settled month never treats original forecast expenses as actual',()=>{
 const s=seed();s.matrix.expenseStatus[6]='정산';const r=L.compute(s);
 assert.equal(r.rows['19'].values[6],null);assert.equal(r.rows['41'].total,null);assert.equal(L.totals(r).balance,null);
});
test('labor annual amount is not multiplied across months',()=>{
 const s=seed();s.calculation.corrections.labor={value:300000000,reason:'총액변경'};const r=L.compute(s);
 assert.equal(r.rows['6'].total,300000000);assert.equal(r.laborAllocation,318588000);assert.ok(r.warnings.some(x=>x.includes('일치하지')));
});
test('staff rate/rice changes are correctly linked to benefit rows',()=>{
 const s=seed();s.calculation.meals['3'].staff=100;const r=L.compute(s);
 assert.equal(r.rows['8'].values[0],623000);assert.equal(r.rows['12'].values[0],473300);assert.equal(r.rows['13'].values[0],54000);assert.equal(r.rows['14'].values[0],95700);
});
test('invalid/derived cells and missing reasons rejected',()=>{
 const s=seed();s.matrix.overrides['16:3']={value:0,reason:'합계'};assert.throws(()=>L.validate(s.matrix,2026));
 const x=seed();x.matrix.overrides['26:3']={value:0,reason:''};assert.throws(()=>L.validate(x.matrix,2026));
});
test('old backups migrate to matrix null; new overrides survive roundtrip',()=>{
 const s=C.initial();delete s.matrix;assert.equal(C.validateState(s).matrix,null);
 const x=seed();x.matrix.overrides['26:3']={value:0,reason:'취소'};assert.deepEqual(C.validateState(JSON.parse(JSON.stringify(x))),x);
});
test('reference data cannot be transplanted to other school years',()=>assert.throws(()=>L.validate(L.initial(2026,true),2027)));
console.log(`${passed} ledger tests passed.`);