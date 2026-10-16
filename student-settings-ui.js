(() => {
  'use strict';
  let page='rates', month=3, kind='food', qindex=0, dirty=false;
  const F=window.MealFunding;
  const rateLabels={studentFood:'학생 식재료비 / 식',studentOperations:'학생 운영비 / 식',annualLabor:'지원금 인건비 / 연간 총액',staffFood:'교직원 재료비 / 식',staffOperations:'교직원 운영비 / 식',staffLabor:'교직원 인건비 / 식',staffVat:'교직원 부가세 / 식',staffRice:'교직원 쌀지원금 / 식'};
  const names={food:'식재료비',operations:'운영비',labor:'인건비'};
  function render(options){
    dirty=false;
    const {$,esc,money,C,notify,getState,persist,setDirty}=options;
    setDirty(false);
    const state=getState(),calc=state.calculation,result=F.compute(F.withBaseline(calc,state.year),state.ends);
    const text=n=>n===null?'':String(n);
    const count=n=>n===null?'미입력':n.toLocaleString('ko-KR')+'식';
    function mark(v){dirty=v;setDirty(v);}
    function previewMoney(value,missing=0){return money(value)+(value!==null&&missing?' · 입력분':'');}
    $('#enroll-body').innerHTML=`
      <div class="panel">
        <div class="section-head"><div><h2>학생 지원금 기준·금액 정산</h2><p>학생 지원금의 단가·연간 기준과 금액 정산 변경을 관리합니다. 아래는 입금액이 아닌 산정·정산 비교 기준입니다. 분기 교부액·분기 총액 변경은 이 비교 화면에 적용하며, 통합 대장의 월별 산정행은 원본 수식을 유지합니다.</p></div><span class="badge blue">${state.year}학년도</span></div>
        <div class="funding-metrics">
          <div><label>학생 식재료비 적용액</label><strong id="calc-food">${previewMoney(result.categories.food.applied,result.categories.food.missing)}</strong><p>식수 × ${money(calc.rates.studentFood)}${result.categories.food.missing?' · 미완료 '+result.categories.food.missing+'개월':''}</p></div>
          <div><label>학생 운영비 적용액</label><strong id="calc-operations">${previewMoney(result.categories.operations.applied,result.categories.operations.missing)}</strong><p>식수 × ${money(calc.rates.studentOperations)}${result.categories.operations.missing?' · 미완료 '+result.categories.operations.missing+'개월':''}</p></div>
          <div><label>연간 인건비 적용액</label><strong id="calc-labor">${money(result.categories.labor.applied)}</strong><p>${result.categories.labor.changed?'연간 정산 변경액 우선 적용':'연간 총액 · 식수와 무관 · 1회만 합산'}</p></div>
        </div>
        <div class="rules" style="margin-top:20px"><span class="step">우선순위</span><span><b>정산 변경액 → 식수 × 단가</b> 순서로 계산합니다. 인건비는 연간 총액을 기준으로 하며, 교직원 급식비는 학생 지원금에 합산하지 않습니다.</span></div>
        <div class="mode" role="group" aria-label="산정 설정 메뉴"><button data-calc-page="corrections" aria-pressed="${page==='corrections'}">정산 변경</button><button data-calc-page="rates" aria-pressed="${page==='rates'}">단가·총액 설정</button></div>
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
    if(page==='rates'){
      $('#funding-form').innerHTML=`<h3>학생 지원금 기준</h3><p class="hint">사용자가 제공한 2026학년도 기준을 기본값으로 반영했습니다. 다른 학년도의 값은 직접 확인해 입력하세요. 변경 시 해당 학년도의 전체 산정에 적용되며 기존 정산 변경액은 유지됩니다.</p>
        <div class="grade-grid">${['studentFood','studentOperations','annualLabor'].map(k=>`<div><label for="rate-${k}">${rateLabels[k]} (원)</label><input id="rate-${k}" inputmode="numeric" value="${text(calc.rates[k])}" placeholder="단가·총액 입력"></div>`).join('')}</div>
        <p class="hint">교직원·외부인 단가는 ‘식수·지원금 산정’에서 관리합니다.</p>${actions}`;
      $('#funding-save').onclick=()=>{
        try{const next=structuredClone(calc);for(const k of ['studentFood','studentOperations','annualLabor'])next.rates[k]=C.amount($('#rate-'+k).value);save(next,'단가·연간 총액 변경');}catch(e){report(e.message);}
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

  }
  window.StudentFundingUI={render};
})();