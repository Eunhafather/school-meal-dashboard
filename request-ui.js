(()=>{'use strict';
const OUTPUTS=['educationFood','cityFood','educationOperations','educationTotal','cityTotal','total'];
function render(o){
  const {$,E,C,state,calc,p,esc,year,mark,save}=o,A=window.MealCalendar;
  const manualDays=Object.fromEntries(E.M.map(m=>[m,E.managementMonth(calc,m).days.map(n=>n===null?'':String(n))]));
  const defaults=state.year===C.Matrix.Data.year?C.Matrix.Data.days:{};
  const initial=Object.fromEntries(E.M.map(m=>[m,E.managementMonth(calc,m)])),initialApplied=E.appliedSummary(C.Funding.withBaseline(calc,state.year));
  const text=n=>n===null?'':String(n),amount=n=>n===null?'—':n.toLocaleString('ko-KR',{maximumFractionDigits:2});
  const fields=(id,label,value,extra='')=>`<input id="${id}" aria-label="${esc(label)}" inputmode="numeric" value="${text(value)}" autocomplete="off" ${extra}>`;
  const outputs=(prefix,tag='td')=>OUTPUTS.map(k=>`<${tag} class="num ${k==='educationTotal'||k==='cityTotal'?'request-funder-total':''} ${k==='total'?'request-grand':''}"><output id="${prefix}-${k}">—</output></${tag}>`).join('');
  $('#enroll-body').innerHTML=`<div class="request-layout">
    <div class="request-heading"><div><h3>월별 학생수·정산 통합 관리 · 지원금 자동 계산</h3><p class="hint">학생수와 일수는 아래 표에서 한 번만 입력하세요. 정산 수정은 표 오른쪽 해당 월의 펼침 영역에서 처리합니다.</p></div><span class="badge blue">금액은 자동 산정</span></div>
    <div class="request-policy"><span><b>교육청</b> 식재료비 72% + 운영비 100%</span><span><b>안산시</b> 식재료비 28% · 운영비 0%</span></div>
    <div id="academic-calendar"></div>
    <p class="hint">학생수와 일수는 엑셀에서 여러 셀을 복사해 표에 붙여넣을 수 있습니다. 학생수·일수 모두 3월부터 다음 해 2월까지 12행×3열 순서입니다. 빈 학생수는 최근 인원·관리대장 기준으로 자동 예상하며 실제 입력값으로 복사 저장하지 않습니다. 0은 실제 0명입니다. 기존 신청·월별 입력·정산 값은 보존됩니다. 저장 시 직접 입력된 신청 인원·일수도 월별 공통 입력에 연결합니다.</p>
    <div class="request-scroll" tabindex="0" role="region" aria-label="분기별 학생수와 월별 재원별 지원금 입력 표">
      <table class="request-table"><caption class="sr-only">${state.year}학년도 월별 학생수·정산과 지원금 · 금액 단위 원</caption><colgroup><col class="request-quarter-col"><col class="request-month-col"><col span="3" class="request-input-col"><col span="3" class="request-days-col"><col class="request-meals-col"><col span="6" class="request-money-col"><col class="request-settlement-col"></colgroup>
        <thead><tr><th rowspan="2">분기·신청 기준</th><th rowspan="2">대상 월</th><th colspan="3">학생수 (명) · 월별 공통 입력</th><th colspan="3">급식일수 (일) · 월별</th><th rowspan="2">적용 식수<br>실제 식수 우선</th><th colspan="3">지원금 항목별 자동 산정 (원)</th><th colspan="3">재원별 합계 (원)</th><th rowspan="2">정산 수정<br>필요한 달만</th></tr><tr><th>1학년</th><th>2학년</th><th>3학년</th><th>1학년</th><th>2학년</th><th>3학년</th><th>교육청 식재료비<br>72%</th><th>안산시 식재료비<br>28%</th><th>교육청 운영비<br>100%</th><th>교육청 합계</th><th>안산시 합계</th><th>지원금 총계</th></tr></thead>
        ${E.QM.map((months,q)=>`<tbody data-request-quarter="${q}">${months.map((m,mi)=>`<tr>${mi===0?`<th rowspan="3" scope="rowgroup">${q+1}분기<small>${state.year}년 ${E.BASE[q]}월 기준</small></th>`:''}<th scope="row" class="request-month">${m}월${m<3?`<small>${year(m)}년</small>`:''}<button type="button" class="calendar-jump" data-calendar-jump="${m}" aria-label="${m}월 학사일정 보기">일정</button></th>${initial[m].people.map((n,i)=>`<td class="request-input">${fields(`request-people-${m}-${i}`,`${q+1}분기 ${year(m)}년 ${m}월 ${i+1}학년 학생수`,n,`data-grid="people" data-row="${E.M.indexOf(m)}" data-col="${i}" placeholder="${initialApplied.monthly.find(x=>x.month===m).people[i]===null?'미입력':'자동'}"`)}<small id="request-basis-${m}-${i}" class="request-count-basis"></small></td>`).join('')}${[0,1,2].map(i=>`<td class="request-input">${fields(`request-days-${m}-${i}`,`${q+1}분기 ${year(m)}년 ${m}월 ${i+1}학년 급식일수`,initial[m].days[i],`data-grid="days" data-row="${E.M.indexOf(m)}" data-col="${i}" placeholder="${defaults[m]?.[i]??'일수'}"`)}<small id="request-days-source-${m}-${i}" class="request-days-source"></small></td>`).join('')}<td class="num"><output id="request-meals-${m}">—</output><small id="request-meal-source-${m}"></small></td>${outputs(`request-out-m-${m}`)}<td class="request-settlement-cell">${settlementEditor(m)}</td></tr>`).join('')}<tr class="request-subtotal"><th colspan="9" scope="row">${q+1}분기 인원 반영 산정 합계</th>${outputs(`request-out-q-${q}`)}<td></td></tr></tbody>`).join('')}
        <tfoot><tr><th colspan="9" scope="row">학년도 전체 인원 반영 산정 합계</th>${outputs('request-out-annual')}<td></td></tr></tfoot>
      </table>
    </div>
    <p class="hint">금액 = 학년별 학생수×급식일수 합계×단가. 현재 식재료비 ${amount(calc.rates.studentFood)}원/식, 운영비 ${amount(calc.rates.studentOperations)}원/식입니다. 원 미만은 소수 둘째 자리까지 표시하며 임의로 원 단위 절사하지 않습니다. 정산 인원이 있으면 우선 적용하며, 기존 신청 기준은 보존합니다. 실제 정산 식수나 금액 정산 변경액은 기존 우선순위를 유지합니다. 이 표는 인원·식수 산정액이며 금액 정산액은 관리대장에서 확인하세요. 인건비는 이 학생수 산정표에 중복 합산하지 않습니다.</p>
    <div id="request-preview-status" class="request-preview-status" role="status" aria-live="polite">입력 즉시 계산됩니다.</div>
    <div id="unified-grants"></div>
    ${savedRequestHistory()}
    <div class="savebar request-savebar"><p>미리보기는 즉시 계산 · 저장하면 학사일정·월별 입력·정산 사유·분기 교부내역을 함께 보존합니다.</p><button class="primary" id="enroll-save">통합 표 전체 저장</button></div>
  </div>`;
  function settlementEditor(m){const s=initial[m].settlement;return `<details class="request-settlement"><summary id="request-settlement-summary-${m}">정산 수정</summary><p class="hint">${m}월 정산 확정 인원만 입력합니다. 빈칸이면 위 공통 입력·자동 예상을 적용합니다.</p>${[0,1,2].map(i=>`<label for="request-settled-${m}-${i}">${i+1}학년 정산 인원</label>${fields(`request-settled-${m}-${i}`,`${year(m)}년 ${m}월 ${i+1}학년 정산 수정 학생수`,s.people[i],`placeholder="수정 시 입력"`)}`).join('')}<label for="request-actual-meals-${m}">학생 실제 정산 총식수</label>${fields(`request-actual-meals-${m}`,`${year(m)}년 ${m}월 학생 실제 정산 총식수`,calc.meals[m].actualStudent,`placeholder="빈칸이면 인원 × 일수"`)}<label for="request-settlement-reason-${m}">정산 변경 사유</label><input id="request-settlement-reason-${m}" aria-label="${year(m)}년 ${m}월 정산 변경 사유" value="${esc(s.reason)}" maxlength="500" placeholder="정산 인원 입력 시 필수"></details>`;}
  function savedRequestHistory(){const rows=E.M.filter(m=>initial[m].people.some((n,i)=>n!==initial[m].requestPeople[i])||initial[m].days.some((n,i)=>n!==initial[m].requestDays[i]));if(!rows.length)return '';return `<details class="request-history"><summary>기존 신청 기준 확인 · ${rows.length}개월 (읽기 전용)</summary><p class="hint">월별 실제 입력과 다른 이전 신청 기준입니다. 중복 입력 없이 원본을 보존합니다. 위 표의 공통 값을 변경하면 해당 항목의 신청·월별 값을 함께 갱신하며 변경 전 값은 변경 이력에 남깁니다.</p><div class="request-scroll"><table><thead><tr><th>월</th><th>기존 신청 인원 · 1/2/3학년</th><th>기존 신청 일수 · 1/2/3학년</th></tr></thead><tbody>${rows.map(m=>`<tr><th>${year(m)}년 ${m}월</th><td>${initial[m].requestPeople.map(amount).join(' / ')}</td><td>${initial[m].requestDays.map(amount).join(' / ')}</td></tr>`).join('')}</tbody></table></div></details>`;}
  function readDraft(){
    const next=structuredClone(calc);next.planning=structuredClone(p);next.planning.enabled=true;next.calendar=calendarEditor.collect();
    E.QM.forEach((ms,q)=>{const x=next.planning.quarters[q];
      ms.forEach(m=>{const item=next.meals[m];[0,1,2].forEach(i=>{const people=C.amount($(`#request-people-${m}-${i}`).value),days=C.amount(A.days(next.calendar,m,i)!==null?manualDays[m][i]:$(`#request-days-${m}-${i}`).value);
        item.grades[i].people=people;item.grades[i].days=days;
        if(people!==initial[m].people[i]){x.monthlyPeople??={};x.monthlyPeople[m]??=[...E.requestPeople(p.quarters[q],m)];x.monthlyPeople[m][i]=people;}
        if(days!==initial[m].days[i]){x.days[m][i]=days;}
      });next.meals[m].actualStudent=C.amount($(`#request-actual-meals-${m}`).value);next.planning.settlement[m]={people:[0,1,2].map(i=>C.amount($(`#request-settled-${m}-${i}`).value)),reason:$(`#request-settlement-reason-${m}`).value.trim()};});
    });
    return next;
  }
  function showError(e){$('#enroll-error').className='error';$('#enroll-error').textContent=e.message;}
  function refresh(){try{
    const draft=readDraft(),r=E.appliedSummary(C.Funding.withBaseline(draft,state.year));
    const set=(id,n)=>{$('#'+id).textContent=amount(n);};
    r.monthly.forEach(row=>{row.people.forEach((n,i)=>{const basis=$(`#request-basis-${row.month}-${i}`),s=draft.planning.settlement[row.month].people[i];basis.textContent=s!==null?'정산 '+amount(n)+'명':row.peopleBasis[i].kind==='자동 예상'?'예상 '+amount(n)+'명':n!==null&&C.amount($(`#request-people-${row.month}-${i}`).value)!==n?'기준 '+amount(n)+'명':'';});$(`#request-settlement-summary-${row.month}`).textContent=draft.planning.settlement[row.month].people.some(n=>n!==null)?row.month+'월 정산 적용 중':row.month+'월 정산 수정';set(`request-meals-${row.month}`,row.meals);$(`#request-meal-source-${row.month}`).textContent=draft.meals[row.month].actualStudent!==null?'실제 정산 식수':'인원 × 일수';OUTPUTS.forEach(k=>set(`request-out-m-${row.month}-${k}`,row[k]));});
    r.quarters.forEach(row=>{OUTPUTS.forEach(k=>set(`request-out-q-${row.index}-${k}`,row[k]));});
    grantEditor.refresh(r);
    OUTPUTS.forEach(k=>set('request-out-annual-'+k,r.annual[k]));
    const ready=r.monthly.filter(x=>x.total!==null).length;
    $('#request-preview-status').textContent=`${ready}/12개월 자동 계산 완료 · ${dirtyHint()}`;
    $('#enroll-error').className='';$('#enroll-error').textContent='';
  }catch(e){document.querySelectorAll('.request-layout output').forEach(x=>x.textContent='—');$('#request-preview-status').textContent='입력 오류를 수정하면 다시 계산됩니다.';showError(e);}}
  const grantEditor=window.GrantUI.render({$,C,state,esc,mark,error:showError});
  let modified=false;
  const calendarEditor=window.CalendarUI.render({host:$('#academic-calendar'),calendar:calc.calendar,year:state.year,esc,onChange(){modified=true;mark();syncDays();refresh();}});
  function syncDays(){const calendar=calendarEditor.collect();E.M.forEach(m=>[0,1,2].forEach(i=>{const input=$(`#request-days-${m}-${i}`),n=A.days(calendar,m,i);if(!input.disabled)manualDays[m][i]=input.value;input.disabled=n!==null;input.value=n!==null?String(n):manualDays[m][i];$(`#request-days-source-${m}-${i}`).textContent=n!==null?'일정 '+n+'일':'';}));}
  syncDays();document.querySelectorAll('[data-calendar-jump]').forEach(b=>b.onclick=()=>calendarEditor.show(+b.dataset.calendarJump));
  function dirtyHint(){return modified?'저장 전 미리보기':'저장된 값 / 자동 예상 기준';}
  document.querySelectorAll('.request-layout input:not(#unified-grants input):not(#academic-calendar input)').forEach(input=>{input.addEventListener('input',()=>{modified=true;mark();refresh();});if(input.type==='checkbox')input.addEventListener('change',()=>{modified=true;mark();refresh();});});
  document.querySelectorAll('.request-layout input[data-grid]').forEach(input=>{
    input.addEventListener('paste',e=>{const raw=e.clipboardData?.getData('text/plain');if(!raw||!/[\t\n]/.test(raw))return;e.preventDefault();try{const rows=raw.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(r=>r.split('\t'));const changes=[];rows.forEach((row,ri)=>row.forEach((value,ci)=>{const target=document.querySelector(`.request-layout input[data-grid="${input.dataset.grid}"][data-row="${+input.dataset.row+ri}"][data-col="${+input.dataset.col+ci}"]`);if(target?.disabled)throw Error('일정 적용 중인 일수는 날짜별 일정표에서 수정하거나 일수 적용을 해제하세요.');if(!target)throw Error('붙여넣기 범위가 입력 표를 벗어났습니다. 학생수·일수 모두 12행×3열입니다.');const n=C.amount(value.trim());if(n!==null&&(n<0||n>(input.dataset.grid==='days'?31:input.dataset.grid==='people'?100000:9e12)))throw Error('붙여넣은 학생수·일수·금액 범위를 확인하세요.');changes.push([target,value.trim()]);}));changes.forEach(([target,value])=>target.value=value);modified=true;mark();refresh();}catch(error){showError(error);}});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){const next=document.querySelector(`.request-layout input[data-grid="${input.dataset.grid}"][data-row="${+input.dataset.row+1}"][data-col="${input.dataset.col}"]`);if(next){e.preventDefault();next.focus();next.select();}}});
  });
  $('#enroll-save').onclick=()=>{try{save(readDraft(),grantEditor.collect());}catch(e){showError(e);}};
  refresh();
}
window.RequestUI={render};})();
