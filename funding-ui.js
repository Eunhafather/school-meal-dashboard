(() => {
  'use strict';
  let page='meals', month=3, kind='food', qindex=0, dirty=false;
  const F=window.MealFunding;
  const rateLabels={studentFood:'학생 식재료비 / 식',studentOperations:'학생 운영비 / 식',annualLabor:'지원금 인건비 / 연간 총액',staffFood:'교직원 재료비 / 식',staffOperations:'교직원 운영비 / 식',staffLabor:'교직원 인건비 / 식',staffVat:'교직원 부가세 / 식',staffRice:'교직원 쌀지원금 / 식'};
  const names={food:'식재료비',operations:'운영비',labor:'인건비'};
  function render(options){
    dirty=false;
    const {$,esc,money,C,notify,getState,persist,setDirty}=options;
    const state=getState(),calc=state.calculation,result=F.compute(calc,state.ends);
    const text=n=>n===null?'':String(n);
    const count=n=>n===null?'미입력':n.toLocaleString('ko-KR')+'식';
    function mark(v){dirty=v;setDirty(v);}
    function previewMoney(value,missing=0){return money(value)+(value!==null&&missing?' · 입력분':'');}
    $('#content').innerHTML=`
      <div class="panel">
        <div class="section-head"><div><h2>식수로 산정하고, 정산값으로 확정</h2><p>학생 지원금과 교직원 급식비를 별도 재원으로 관리합니다. 아래는 입금액이 아닌 산정·정산 기준입니다.</p></div><span class="badge blue">${state.year}학년도</span></div>
        <div class="funding-metrics">
          <div><label>학생 식재료비 적용액</label><strong id="calc-food">${previewMoney(result.categories.food.applied,result.categories.food.missing)}</strong><p>식수 × ${money(calc.rates.studentFood)}${result.categories.food.missing?' · 미완료 '+result.categories.food.missing+'개월':''}</p></div>
          <div><label>학생 운영비 적용액</label><strong id="calc-operations">${previewMoney(result.categories.operations.applied,result.categories.operations.missing)}</strong><p>식수 × ${money(calc.rates.studentOperations)}${result.categories.operations.missing?' · 미완료 '+result.categories.operations.missing+'개월':''}</p></div>
          <div><label>연간 인건비 적용액</label><strong id="calc-labor">${money(result.categories.labor.applied)}</strong><p>${result.categories.labor.changed?'연간 정산 변경액 우선 적용':'연간 총액 · 식수와 무관 · 1회만 합산'}</p></div>
        </div>
        <div class="rules" style="margin-top:20px"><span class="step">우선순위</span><span><b>정산 변경액 → 식수 × 단가</b> 순서로 계산합니다. 인건비는 연간 총액을 기준으로 하며, 교직원 급식비는 학생 지원금에 합산하지 않습니다.</span></div>
        <div class="mode" role="group" aria-label="산정 설정 메뉴"><button data-calc-page="meals" aria-pressed="${page==='meals'}">식수 입력</button><button data-calc-page="corrections" aria-pressed="${page==='corrections'}">정산 변경</button><button data-calc-page="rates" aria-pressed="${page==='rates'}">단가·총액 설정</button><button data-calc-page="review" aria-pressed="${page==='review'}">산정 결과</button></div>
        <div id="funding-form"></div>
      </div>`;
    document.querySelectorAll('[data-calc-page]').forEach(b=>b.onclick=()=>{
      if(dirty&&!confirm('저장하지 않은 산정 입력을 버리고 이동할까요?'))return;
      page=b.dataset.calcPage;mark(false);render(options);
    });
    function report(error){
      const box=$('#funding-error');if(box){box.className=error?'error':'';box.textContent=error;}
      else notify(error);
    }
    function save(next,action){
      try{
        const clean=F.validate(next,state.year);
        const changes=F.changes(calc,clean);
        if(!changes.length){notify('변경된 내용이 없습니다.');return;}
        const out=structuredClone(getState());out.calculation=clean;out.updatedAt=new Date().toISOString();
        for(const d of changes)out.history.push({at:out.updatedAt,action,fund:'산정·정산 설정',quarter:'',
          detail:d.key+' : '+(d.before===null?'빈칸':String(d.before))+' → '+(d.after===null?'빈칸':String(d.after))});
        out.history=out.history.slice(-500);
        persist(out);mark(false);render(options);notify('산정·정산 값을 저장했습니다.');
      }catch(e){report(e.message);}
    }
    const error='<div id="funding-error" role="alert"></div>';
    const actions=`${error}<div class="savebar"><p>저장 후 산정 결과와 변경 이력에 반영됩니다.</p><button id="funding-save" class="primary">산정 입력 저장</button></div>`;
    function listen(){document.querySelectorAll('#funding-form input').forEach(x=>x.addEventListener('input',()=>mark(true)));}
    if(page==='meals'){
      const item=calc.meals[String(month)],row=result.monthly.find(x=>x.month===month);
      $('#funding-form').innerHTML=`
        <div class="selectors"><div><label for="meal-month">입력 월</label><select id="meal-month">${C.MONTHS.map(m=>`<option value="${m}" ${m===month?'selected':''}>${m<3?state.year+1:state.year}년 ${m}월</option>`).join('')}</select></div><div><label>학생 적용 식수 · 저장 기준</label><output class="effective" style="display:block">${count(row.studentMeals)}</output><p class="field-help">${row.studentMeals===null?'학년별 인원·일수 또는 실제 식수를 입력하세요.':esc(row.studentSource)}</p></div></div>
        <h3 style="margin-top:24px">학생 지원 대상 식수</h3><p class="hint">학년별 인원 × 급식일수를 합산합니다. 학생수 빈칸은 이전 달의 최근 입력 인원으로 다음 해 2월까지 자동 예상합니다. 예상인원은 학생수·분기 신청의 학년별 월별 현황에서 확인할 수 있습니다. 실제 정산 식수가 있으면 그 값이 우선합니다. 급식이 없으면 실제 식수에 0을 입력하세요.</p>
        <div class="grade-grid">${item.grades.map((g,i)=>`<div class="entry-card"><strong>${i+1}학년</strong><label for="people-${i}" style="margin-top:12px">지원 대상 인원 (명)</label><input id="people-${i}" inputmode="numeric" value="${text(g.people)}" placeholder="빈칸이면 최근 인원 자동 예상"><label for="days-${i}" style="margin-top:12px">급식일수 (일)</label><input id="days-${i}" inputmode="numeric" value="${text(g.days)}" placeholder="0~31일"></div>`).join('')}</div>
        <div class="selectors" style="margin-top:20px"><div><label for="actual-student">학생 실제 정산 식수 (식)</label><input id="actual-student" inputmode="numeric" value="${text(item.actualStudent)}" placeholder="비우면 인원 × 일수 적용"><p class="field-help">0도 유효합니다. 빈칸이면 학년별 산정값으로 복귀합니다.</p></div></div>
        <h3 style="margin-top:24px">교직원·외부인 실제 식수</h3><div class="selectors" style="margin-top:12px"><div><label for="staff-meals">교직원 실제 식수 (식)</label><input id="staff-meals" inputmode="numeric" value="${text(item.staff)}" placeholder="월별 실제 식수 수기 입력"></div><div><label for="external-meals">외부인 실제 식수 (식)</label><input id="external-meals" inputmode="numeric" value="${text(item.external)}" placeholder="식수만 기록 · 금액은 미산정"></div></div>
        <p class="hint">교직원은 현재 설정된 단가 합계 ${money(result.staffRate)}를 적용합니다. 외부인에게 같은 단가가 적용되는지는 미확인으로, 외부인 금액은 계산에서 제외합니다.</p>${actions}`;
      $('#meal-month').onchange=e=>{
        if(dirty&&!confirm('미저장 식수 입력을 버리고 다른 월로 이동할까요?')){e.target.value=month;return;}
        month=Number(e.target.value);mark(false);render(options);
      };
      $('#funding-save').onclick=()=>{
        try{
          const next=structuredClone(calc),r=next.meals[String(month)];
          r.grades=[0,1,2].map(i=>({people:C.amount($('#people-'+i).value),days:C.amount($('#days-'+i).value)}));
          r.actualStudent=C.amount($('#actual-student').value);r.staff=C.amount($('#staff-meals').value);r.external=C.amount($('#external-meals').value);
          save(next,'월별 식수 변경');
        }catch(e){report(e.message);}
      };
      listen();
    }
    if(page==='rates'){
      $('#funding-form').innerHTML=`<h3>학생 지원금 기준</h3><p class="hint">사용자가 제공한 2026학년도 기준을 기본값으로 반영했습니다. 다른 학년도의 값은 직접 확인해 입력하세요. 변경 시 해당 학년도의 전체 산정에 적용되며 기존 정산 변경액은 유지됩니다.</p>
        <div class="grade-grid">${['studentFood','studentOperations','annualLabor'].map(k=>`<div><label for="rate-${k}">${rateLabels[k]} (원)</label><input id="rate-${k}" inputmode="numeric" value="${text(calc.rates[k])}" placeholder="단가·총액 입력"></div>`).join('')}</div>
        <h3 style="margin-top:24px">교직원 급식비 구성</h3><div class="grade-grid">${['staffFood','staffOperations','staffLabor','staffVat','staffRice'].map(k=>`<div><label for="rate-${k}">${rateLabels[k]} (원)</label><input id="rate-${k}" inputmode="numeric" value="${text(calc.rates[k])}" placeholder="단가 입력"></div>`).join('')}</div>
        <div class="rules" style="margin-top:20px"><span class="step">배분</span><span>교직원 재료비에는 <b>재료비 + 쌀지원금</b>을 합산합니다. 인건비와 부가세는 별도 표시하며, 합산 참고액도 제공합니다. 학생 지원금에는 교직원 급식비를 더하지 않습니다.</span></div>${actions}`;
      $('#funding-save').onclick=()=>{
        try{const next=structuredClone(calc);for(const k of F.keys)next.rates[k]=C.amount($('#rate-'+k).value);save(next,'단가·연간 총액 변경');}catch(e){report(e.message);}
      };listen();
    }
    if(page==='corrections'){
      const labor=kind==='labor',c=labor?calc.corrections.labor:calc.corrections[kind],q=result.quarters[qindex];
      const mode=labor?'annual':c.mode;
      let list;
      if(labor)list=[{key:'annual',label:'연간 인건비',base:calc.rates.annualLabor,entry:c}];
      else if(mode==='quarter')list=[{key:'quarter',label:(qindex+1)+'분기 · '+q.months.map(m=>m+'월').join(' · '),base:q[kind].base,entry:c.quarters[qindex]}];
      else list=q[kind].rows.map(r=>({key:String(r.month),label:r.month+'월',base:r.base,entry:c.months[String(r.month)]}));
      $('#funding-form').innerHTML=`
        <div class="selectors"><div><label for="correction-kind">정산 변경 대상</label><select id="correction-kind">${Object.entries(names).map(([k,v])=>`<option value="${k}" ${k===kind?'selected':''}>${v}${k==='labor'?' · 연간 총액':''}</option>`).join('')}</select></div>${!labor?`<div><label for="correction-quarter">정산 기간</label><select id="correction-quarter">${C.ranges(state).map(r=>`<option value="${r.index}" ${r.index===qindex?'selected':''}>${r.label} · ${r.span}</option>`).join('')}</select></div>`:''}</div>
        ${!labor?`<div class="mode"><button id="correction-monthly" aria-pressed="${mode==='monthly'}">월별 변경액 적용</button><button id="correction-quarterly" aria-pressed="${mode==='quarter'}">분기 변경액 적용</button></div>`:'<p class="hint">연간 인건비는 월별 식수로 산정하거나 분기별로 반복 합산하지 않습니다.</p>'}
        <p class="hint">${mode==='quarter'?'분기 변경액이 우선합니다. 월별 변경액은 보존하지만 계산에서 제외하며, 분기 금액을 월별로 임의 배분하지 않습니다.':'변경액에는 증감액이 아닌 변경 후 총액을 입력합니다. 빈칸은 기준액으로 복귀, 0원은 0원 우선 적용입니다.'}${!labor?' 선택한 월별·분기 적용 방식은 이 항목의 모든 분기에 동일하게 적용됩니다.':''}</p>
        <div class="entry-list" style="margin-top:16px">${list.map(x=>`<article class="entry-card" data-correction="${x.key}"><div class="entry-title"><strong>${esc(x.label)}</strong><span class="badge ${x.entry.value!==null?'blue':''}">${x.entry.value!==null?'정산 변경액 우선':'산정 기준액'}</span></div><div class="fields"><div><label>산정 기준액</label><output class="effective" style="display:block">${money(x.base)}</output></div><div><label for="change-${x.key}">정산 변경 후 총액 (원)</label><input id="change-${x.key}" inputmode="numeric" value="${text(x.entry.value)}" placeholder="변경 없으면 빈칸"></div><div><label>현재 적용액 · 저장 기준</label><output class="effective" style="display:block">${money(x.entry.value??x.base)}</output></div></div><div class="reason"><label for="change-reason-${x.key}">변경 사유</label><input id="change-reason-${x.key}" maxlength="500" value="${esc(x.entry.reason)}" placeholder="변경액 입력 시 사유 필수"></div><button data-clear-correction="${x.key}" style="margin-top:12px">변경액 비우기</button></article>`).join('')}</div>${actions}`;
      const leave=()=>!dirty||confirm('저장하지 않은 정산 변경액을 버릴까요?');
      $('#correction-kind').onchange=e=>{if(!leave()){e.target.value=kind;return;}kind=e.target.value;mark(false);render(options);};
      if(!labor){
        $('#correction-quarter').onchange=e=>{if(!leave()){e.target.value=qindex;return;}qindex=Number(e.target.value);mark(false);render(options);};
        function switchMode(value){
          if(!leave())return;
          const next=structuredClone(calc);next.corrections[kind].mode=value;save(next,'정산 적용 단위 변경');
        }
        $('#correction-monthly').onclick=()=>switchMode('monthly');$('#correction-quarterly').onclick=()=>switchMode('quarter');
      }
      document.querySelectorAll('[data-clear-correction]').forEach(b=>b.onclick=()=>{$('#change-'+b.dataset.clearCorrection).value='';mark(true);});
      $('#funding-save').onclick=()=>{
        try{
          const next=structuredClone(calc);
          for(const x of list){
            const ent={value:C.amount($('#change-'+x.key).value),reason:$('#change-reason-'+x.key).value.trim()};
            if(labor)next.corrections.labor=ent;
            else if(mode==='quarter')next.corrections[kind].quarters[qindex]=ent;
            else next.corrections[kind].months[x.key]=ent;
          }
          save(next,'산정액 정산 변경');
        }catch(e){report(e.message);}
      };listen();
    }
    if(page==='review'){
      const studentRows=result.quarters.map(q=>`<tr><td>${q.index+1}분기<br><span class="muted">${q.months.map(m=>m+'월').join(' · ')}</span></td><td class="num">${previewMoney(q.food.applied,q.food.missing)}<br><span class="muted">${esc(q.food.source)}</span></td><td class="num">${previewMoney(q.operations.applied,q.operations.missing)}<br><span class="muted">${esc(q.operations.source)}</span></td></tr>`).join('');
      const ss=result.staffSummary;
      $('#funding-form').innerHTML=`
        <h3>학생 무상급식 지원금</h3><p class="hint">도·시 부담 비율은 새로 가정하지 않았습니다. 아래는 지원금 전체 산정액이며 실제 교부내역과는 별도입니다.</p>
        <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>기간</th><th class="num">식재료비</th><th class="num">운영비</th></tr></thead><tbody>${studentRows}</tbody><tfoot><tr><td>연간 인건비 · 별도 1회 합산</td><td colspan="2" class="num">${money(result.categories.labor.applied)}</td></tr><tr><td>지원금 입력분 기준 총계</td><td colspan="2" class="num" id="calc-total">${money(result.total)}${result.missing?' · 미완료 항목 있음':''}</td></tr></tfoot></table></div>
        <h3 style="margin-top:28px">교직원 급식비 · 학생 지원금과 별도</h3><p class="hint">1식 합계 ${money(result.staffRate)} / 재료비 배분 단가 ${money(result.foodStaffRate)}. 아래 금액은 식수에 따른 부과·배분 산정액이며 실제 수납액은 아닙니다.</p>
        <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>월</th><th class="num">실제 식수</th><th class="num">식재료비<br>재료비+쌀지원금</th><th class="num">운영비</th><th class="num">인건비</th><th class="num">부가세</th><th class="num">합계</th></tr></thead><tbody>${result.monthly.map(r=>`<tr><td>${r.month}월</td><td class="num">${count(r.staffMeals)}</td>${['food','operations','labor','vat','total'].map(k=>`<td class="num">${money(r.staff[k])}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><td colspan="2">입력분 합계</td>${['food','operations','labor','vat','total'].map(k=>`<td class="num">${money(ss[k].value)}</td>`).join('')}</tr></tfoot></table></div>
        <p class="hint">쌀지원금 ${money(ss.rice.value)}는 위 식재료비에 이미 포함되어 있어 다시 합산하지 않습니다. 인건비+부가세 참고 합계: ${money(result.staffLaborVat)}. 교직원 식수 미입력: ${ss.total.missing}개월.</p>
        <p class="hint">외부인 식수는 별도로 저장하지만 단가·징수 대상 기준이 확인되지 않아 금액 산정에는 포함하지 않았습니다.</p>`;
    }
  }
  window.FundingUI={render};
})();