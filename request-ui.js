(()=>{'use strict';
const OUTPUTS=['educationFood','cityFood','educationOperations','educationTotal','cityTotal','total'];
const SOURCES=[['educationFood','교육청','식재료비 72%'],['cityFood','안산시','식재료비 28%'],['educationOperations','교육청','운영비 100%']];
function render(o){
  const {$,E,C,state,calc,p,esc,year,mark,save}=o;
  const defaults=state.year===C.Matrix.Data.year?C.Matrix.Data.days:{};
  const text=n=>n===null?'':String(n),amount=n=>n===null?'—':n.toLocaleString('ko-KR',{maximumFractionDigits:2});
  const key=(q,k)=>q+'-'+k,blank=()=>({original:null,revised:null,reason:''});
  const fields=(id,label,value,extra='')=>`<input id="${id}" aria-label="${esc(label)}" inputmode="numeric" value="${text(value)}" autocomplete="off" ${extra}>`;
  const outputs=(prefix,tag='td')=>OUTPUTS.map(k=>`<${tag} class="num ${k==='educationTotal'||k==='cityTotal'?'request-funder-total':''} ${k==='total'?'request-grand':''}"><output id="${prefix}-${k}">—</output></${tag}>`).join('');
  const legacy=p.quarters.map((q,i)=>({q,i})).filter(({q})=>['food','operations'].some(k=>q[k].original!==null||q[k].revised!==null||q[k].reason));
  $('#enroll-body').innerHTML=`<div class="request-layout">
    <div class="request-heading"><div><h3>분기별 학생수 입력 · 월별 지원금 자동 계산</h3><p class="hint">분기당 1·2·3학년 인원을 한 번 입력하세요. 월별 일수는 관리대장 기준을 기본 적용하며 수정할 수 있습니다.</p></div><span class="badge blue">금액은 자동 산정</span></div>
    <div class="request-policy"><span><b>교육청</b> 식재료비 72% + 운영비 100%</span><span><b>안산시</b> 식재료비 28% · 운영비 0%</span></div>
    <p class="hint">학생수와 일수는 엑셀에서 여러 셀을 복사해 표에 붙여넣을 수 있습니다. 학생수는 4행×3열, 일수는 12행×3열 순서입니다. 빈 학생수는 미입력, 0은 실제 0명입니다.</p>
    <div class="request-scroll" tabindex="0" role="region" aria-label="분기별 학생수와 월별 재원별 지원금 입력 표">
      <table class="request-table"><caption class="sr-only">${state.year}학년도 분기별 신청 인원과 월별 지원금 · 금액 단위 원</caption><colgroup><col class="request-quarter-col"><col span="3" class="request-input-col"><col class="request-month-col"><col span="3" class="request-days-col"><col class="request-meals-col"><col span="6" class="request-money-col"></colgroup>
        <thead><tr><th rowspan="2">분기·신청 기준</th><th colspan="3">신청 학생수 (명) · 분기 공통</th><th rowspan="2">대상 월</th><th colspan="3">급식일수 (일) · 월별</th><th rowspan="2">학생 식수<br>자동 계산</th><th colspan="3">지원금 항목별 자동 산정 (원)</th><th colspan="3">재원별 합계 (원)</th></tr><tr><th>1학년</th><th>2학년</th><th>3학년</th><th>1학년</th><th>2학년</th><th>3학년</th><th>교육청 식재료비<br>72%</th><th>안산시 식재료비<br>28%</th><th>교육청 운영비<br>100%</th><th>교육청 합계</th><th>안산시 합계</th><th>지원금 총계</th></tr></thead>
        ${E.QM.map((months,q)=>`<tbody data-request-quarter="${q}">${months.map((m,mi)=>`<tr>${mi===0?`<th rowspan="3" scope="rowgroup">${q+1}분기<small>${state.year}년 ${E.BASE[q]}월 기준</small></th>${p.quarters[q].people.map((n,i)=>`<td rowspan="3" class="request-input">${fields(`request-people-${q}-${i}`,`${q+1}분기 ${i+1}학년 신청 학생수`,n,`data-grid="people" data-row="${q}" data-col="${i}" placeholder="입력"`)}</td>`).join('')}`:''}<th scope="row" class="request-month">${m}월${m<3?`<small>${year(m)}년</small>`:''}</th>${[0,1,2].map(i=>`<td class="request-input">${fields(`request-days-${m}-${i}`,`${q+1}분기 ${year(m)}년 ${m}월 ${i+1}학년 급식일수`,p.quarters[q].days[m][i],`data-grid="days" data-row="${E.M.indexOf(m)}" data-col="${i}" placeholder="${defaults[m]?.[i]??'일수'}"`)}</td>`).join('')}<td class="num"><output id="request-meals-${m}">—</output></td>${outputs(`request-out-m-${m}`)}</tr>`).join('')}<tr class="request-subtotal"><th colspan="9" scope="row">${q+1}분기 신청 산정 합계</th>${outputs(`request-out-q-${q}`)}</tr></tbody>`).join('')}
        <tfoot><tr><th colspan="9" scope="row">학년도 전체 신청 산정 합계</th>${outputs('request-out-annual')}</tr></tfoot>
      </table>
    </div>
    <p class="hint">금액 = 학년별 학생수×급식일수 합계×단가. 현재 식재료비 ${amount(calc.rates.studentFood)}원/식, 운영비 ${amount(calc.rates.studentOperations)}원/식입니다. 원 미만은 소수 둘째 자리까지 표시하며 임의로 원 단위 절사하지 않습니다. 신청 인원은 실제 월별 인원·정산 수정과 구분해 보존합니다. 인건비는 이 학생수 산정표에 중복 합산하지 않습니다.</p>
    <div id="request-preview-status" class="request-preview-status" role="status" aria-live="polite">입력 즉시 계산됩니다.</div>
    <div class="request-heading request-grants-heading"><div><h3>실제 교부액 · 교육청 / 안산시 구분 입력</h3><p class="hint">위 표의 지원금은 자동 계산됩니다. 아래 실제 교부액만 교부 통지서대로 입력하세요. 빈칸은 미확인, 0원은 실제 0원입니다.</p></div></div>
    <div class="request-scroll" tabindex="0" role="region" aria-label="분기별 교육청 안산시 실제 교부액 입력 표">
      <table class="request-grants-table"><thead><tr><th>분기</th><th>재원</th><th>항목</th><th>신청 산정액<br>자동 계산</th><th>최초 실제 교부액</th><th>변경 후 총액</th><th>변경 사유</th><th>현재 적용 교부액</th><th>교부−신청 차이</th><th>비교 적용</th></tr></thead>
      ${E.QM.map((ms,q)=>`<tbody>${SOURCES.map(([k,funder,label],i)=>{const v=p.quarters[q].grants?.[k]??blank();return `<tr>${i===0?`<th rowspan="3" scope="rowgroup">${q+1}분기<small>${ms.map(m=>m+'월').join('·')}</small></th>`:''}<td>${funder}</td><th scope="row">${label}</th><td class="num"><output id="request-grant-expected-${key(q,k)}">—</output></td><td>${fields(`request-grant-original-${key(q,k)}`,`${q+1}분기 ${funder} ${label} 최초 실제 교부액`,v.original,`data-grid="grant-original" data-row="${q*3+i}" data-col="0" placeholder="미확인"`)}</td><td>${fields(`request-grant-revised-${key(q,k)}`,`${q+1}분기 ${funder} ${label} 변경 후 교부 총액`,v.revised,`data-grid="grant-revised" data-row="${q*3+i}" data-col="0" placeholder="변경 시 입력"`)}</td><td><input id="request-grant-reason-${key(q,k)}" aria-label="${q+1}분기 ${funder} ${label} 교부 변경 사유" value="${esc(v.reason)}" maxlength="500" placeholder="변경 시 사유 필수"></td><td class="num"><output id="request-grant-effective-${key(q,k)}">—</output></td><td class="num"><output id="request-grant-diff-${key(q,k)}">—</output></td>${i===0?`<td rowspan="3" class="request-check"><label><input type="checkbox" id="request-grant-apply-${q}" ${p.quarters[q].useReceived?'checked':''}>분기 교부 비교에 사용</label></td>`:''}</tr>`;}).join('')}</tbody>`).join('')}
      </table>
    </div>
    <p class="hint">변경 후 총액은 증감액이 아닙니다. 식재료비의 교육청·안산시 실제 교부액 중 하나가 미확인이면 합산 교부액도 미확정으로 유지합니다. 교부 차이는 공식 반납액이 아닙니다. 분기 교부액을 월별 지원금에 중복 합산하거나 월별로 임의 배분하지 않습니다.</p>
    ${legacy.length?`<details class="request-legacy"><summary>기존 합산 교부액 보존 · 재원 미분리 ${legacy.length}개 분기</summary><p class="hint">이전 합산액을 72%·28%로 임의 분할하지 않았습니다. 재원별 교부액을 입력하면 재원별 기록을 우선 비교하고, 합산 원본은 계속 보존합니다.</p><div class="request-scroll"><table class="request-legacy-table"><thead><tr><th>분기</th><th>기존 합산 항목</th><th>최초 교부액</th><th>변경 후 총액</th><th>변경 사유</th></tr></thead><tbody>${legacy.map(({q,i})=>['food','operations'].map(k=>`<tr><th>${i+1}분기</th><td>${k==='food'?'식재료비 · 교육청+안산시 미분리':'운영비 합산'}</td><td>${fields(`request-legacy-original-${i}-${k}`,`${i+1}분기 기존 ${k==='food'?'식재료비':'운영비'} 최초 교부액`,q[k].original)}</td><td>${fields(`request-legacy-revised-${i}-${k}`,`${i+1}분기 기존 ${k==='food'?'식재료비':'운영비'} 변경 총액`,q[k].revised)}</td><td><input id="request-legacy-reason-${i}-${k}" aria-label="${i+1}분기 기존 ${k} 변경 사유" value="${esc(q[k].reason)}" maxlength="500"></td></tr>`).join('')).join('')}</tbody></table></div></details>`:''}
    <div class="savebar request-savebar"><p>미리보기는 즉시 계산 · 저장하면 4개 분기의 입력·교부내역을 함께 보존합니다.</p><button class="primary" id="enroll-save">분기 표 전체 저장</button></div>
  </div>`;
  function readDraft(snapshot=false){
    const next=structuredClone(calc);next.planning=structuredClone(p);next.planning.enabled=true;
    E.QM.forEach((ms,q)=>{const x=next.planning.quarters[q];x.people=[0,1,2].map(i=>C.amount($(`#request-people-${q}-${i}`).value));
      ms.forEach(m=>x.days[m]=[0,1,2].map(i=>{const v=C.amount($(`#request-days-${m}-${i}`).value);return snapshot?v??defaults[m]?.[i]??null:v;}));
      x.grants=Object.fromEntries(SOURCES.map(([k])=>[k,{original:C.amount($(`#request-grant-original-${key(q,k)}`).value),revised:C.amount($(`#request-grant-revised-${key(q,k)}`).value),reason:$(`#request-grant-reason-${key(q,k)}`).value.trim()}]));
      x.useReceived=$(`#request-grant-apply-${q}`).checked;
    });
    legacy.forEach(({i})=>['food','operations'].forEach(k=>next.planning.quarters[i][k]={original:C.amount($(`#request-legacy-original-${i}-${k}`).value),revised:C.amount($(`#request-legacy-revised-${i}-${k}`).value),reason:$(`#request-legacy-reason-${i}-${k}`).value.trim()}));
    return next;
  }
  function showError(e){$('#enroll-error').className='error';$('#enroll-error').textContent=e.message;}
  function refresh(){try{
    const draft=readDraft(),r=E.requestSummary(draft,defaults);
    const set=(id,n)=>{$('#'+id).textContent=amount(n);};
    r.monthly.forEach(row=>{set(`request-meals-${row.month}`,row.meals);OUTPUTS.forEach(k=>set(`request-out-m-${row.month}-${k}`,row[k]));});
    r.quarters.forEach(row=>{OUTPUTS.forEach(k=>set(`request-out-q-${row.index}-${k}`,row[k]));SOURCES.forEach(([k])=>{const v=E.effective(draft.planning.quarters[row.index].grants[k]);set(`request-grant-expected-${key(row.index,k)}`,row[k]);set(`request-grant-effective-${key(row.index,k)}`,v);set(`request-grant-diff-${key(row.index,k)}`,v===null||row[k]===null?null:v-row[k]);});});
    OUTPUTS.forEach(k=>set('request-out-annual-'+k,r.annual[k]));
    const ready=r.monthly.filter(x=>x.total!==null).length;
    $('#request-preview-status').textContent=`${ready}/12개월 자동 계산 완료 · ${dirtyHint()}`;
    $('#enroll-error').className='';$('#enroll-error').textContent='';
  }catch(e){document.querySelectorAll('.request-layout output').forEach(x=>x.textContent='—');$('#request-preview-status').textContent='입력 오류를 수정하면 다시 계산됩니다.';showError(e);}}
  let modified=false;function dirtyHint(){return modified?'저장 전 미리보기':'저장된 값 / 기본 일수 기준';}
  document.querySelectorAll('.request-layout input').forEach(input=>{input.addEventListener('input',()=>{modified=true;mark();refresh();});if(input.type==='checkbox')input.addEventListener('change',()=>{modified=true;mark();refresh();});});
  document.querySelectorAll('.request-layout input[data-grid]').forEach(input=>{
    input.addEventListener('paste',e=>{const raw=e.clipboardData?.getData('text/plain');if(!raw||!/[\t\n]/.test(raw))return;e.preventDefault();try{const rows=raw.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(r=>r.split('\t'));const changes=[];rows.forEach((row,ri)=>row.forEach((value,ci)=>{const target=document.querySelector(`.request-layout input[data-grid="${input.dataset.grid}"][data-row="${+input.dataset.row+ri}"][data-col="${+input.dataset.col+ci}"]`);if(!target)throw Error('붙여넣기 범위가 입력 표를 벗어났습니다. 학생수는 4행×3열, 일수는 12행×3열입니다.');const n=C.amount(value.trim());if(n!==null&&(n<0||n>(input.dataset.grid==='days'?31:input.dataset.grid==='people'?100000:9e12)))throw Error('붙여넣은 학생수·일수·금액 범위를 확인하세요.');changes.push([target,value.trim()]);}));changes.forEach(([target,value])=>target.value=value);modified=true;mark();refresh();}catch(error){showError(error);}});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){const next=document.querySelector(`.request-layout input[data-grid="${input.dataset.grid}"][data-row="${+input.dataset.row+1}"][data-col="${input.dataset.col}"]`);if(next){e.preventDefault();next.focus();next.select();}}});
  });
  $('#enroll-save').onclick=()=>{try{save(readDraft(true));}catch(e){showError(e);}};
  refresh();
}
window.RequestUI={render};})();
