(() => {
  'use strict';
  const C=window.MealGrant;
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KEY='meal-grant-prototype-v1-';
  let year=2026, state, tab='ledger', fundId='food-edu', quarter=0, draft, dirty=false, storageOK=true, recoveryBlocked=false, toastTimer;
  function read(y) {
    try {
      const raw=localStorage.getItem(KEY+y);
      if(raw) {
        const loaded=C.validateState(JSON.parse(raw));
        if(loaded.year!==y) throw new Error('저장 학년도가 다릅니다.');
        return loaded;
      }
    } catch(e) {
      storageOK=false;
      // Do not silently overwrite a corrupted saved state.
      try { if(localStorage.getItem(KEY+y)) recoveryBlocked=true; } catch(_) {}
    }
    return C.validateState(C.initial(y));
  }
  function persist(next) {
    if(recoveryBlocked) throw new Error('기존 저장자료를 읽지 못했습니다. 백업을 확인한 뒤 초기화하거나 백업을 불러와주세요.');
    next=C.validateState(next);
    try {localStorage.setItem(KEY+next.year,JSON.stringify(next));storageOK=true;}
    catch(e) { storageOK=false;updateTop();throw Error('브라우저 저장에 실패했습니다. 입력을 보존한 채 백업·저장 공간을 확인하세요.'); }
    state=next;
    updateTop();
  }
  function notify(text) {
    clearTimeout(toastTimer); $('#toast').textContent=text; $('#toast').hidden=false;
    toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);
  }
  function confirmLeave() {return !dirty||confirm('저장하지 않은 입력이 있습니다. 변경을 버리고 이동할까요?');}
  function dateText(value) {
    const d=new Date(value);
    return Number.isNaN(d.getTime())?'기록 시각 없음':d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
  }
  function updateTop() {
    const sum=C.summarize(state);
    $('#stat-original').textContent=sum.active?C.money(sum.original):'미입력';
    $('#stat-total').textContent=sum.active?C.money(sum.total):'미입력';
    $('#stat-difference').textContent=sum.active?'최초 대비 '+(sum.difference>0?'+':'')+C.money(sum.difference):'저장한 값이 여기에 반영됩니다.';
    $('#stat-overrides').textContent=sum.overridden+'건';
    $('#stat-missing').textContent='현재 방식 기준 미입력 '+sum.missing+'건'+(sum.conflicts?' · 기존 값 대조 필요 '+sum.conflicts+'건 (집계 제외)':'')+' · 빈칸은 0원과 다릅니다.';
    $('#storage-status').textContent=recoveryBlocked?'저장자료를 읽지 못해 보호 모드입니다. 초기화 또는 정상 백업 복원이 필요합니다.':!storageOK?'브라우저 저장을 사용할 수 없습니다. 현재 화면에서만 유지되므로 백업을 내려받으세요.':'현재 브라우저 저장 · '+(state.updatedAt?'마지막 변경 '+dateText(state.updatedAt):'아직 입력된 자료가 없습니다.');
  }
  function changeTab(next) {
    if(!confirmLeave()) return;
    tab=next; dirty=false;
    $$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));
    $('#content').setAttribute('aria-labelledby','tab-'+tab); render();
  }
  function summaryView() {
    const rows=[];
    for(let q=0;q<4;q++) for(const f of state.funds) {
      const p=C.period(state,f.id,q),status=C.grantStatus(state,f.id,q),list=status==='active'?C.entries(state,f.id,q):[];
      const base=list.reduce((a,x)=>a+(x.entry.original??0),0);
      const active=list.filter(x=>C.effective(x.entry).value!==null);
      const total=active.reduce((a,x)=>a+C.effective(x.entry).value,0);
      rows.push(`<tr><td>${q+1}분기<br><span class="muted">${escape(C.ranges(state)[q].span)}</span></td><td>${escape(f.name)}</td><td>${p.mode==='quarter'?'분기 합계<br><span class="muted">월별 미배분</span>':'월별 합산'}</td><td class="num">${active.length?C.money(base):'미입력'}</td><td class="num">${active.length?C.money(total):'미입력'}</td><td>${status==='conflict'?'기존 값 대조 필요 · 집계 제외':status==='excluded'?'재원별 기록 우선 · 합산액 제외':list.map(x=>escape(x.label)+' · '+escape(C.effective(x.entry).source)).join('<br>')}</td></tr>`);
    }
    const s=C.summarize(state);
    $('#content').innerHTML=`<div class="panel"><div class="section-head"><div><h2>실제 교부내역 집계</h2><p>학생수·분기 신청의 통합 교부표와 같은 저장 기록입니다. 분기·월별 중 선택한 방식만 합산하며, 학생수 산정액·월별 관리대장 수입액과는 별도입니다. 미입력은 0원 확정이 아닙니다.</p></div></div><div class="table-wrap"><table><caption class="sr-only">저장된 분기별 지원금과 적용 기준</caption><thead><tr><th>기간</th><th>항목</th><th>입력 방식</th><th class="num">최초 입력액</th><th class="num">적용 금액</th><th>적용 근거</th></tr></thead><tbody>${rows.join('')}</tbody><tfoot><tr><td colspan="3">학년도 합계 · 입력된 금액만</td><td class="num">${s.active?C.money(s.original):'미입력'}</td><td class="num">${s.active?C.money(s.total):'미입력'}</td><td>미입력 ${s.missing}건${s.conflicts?' · 대조 필요 '+s.conflicts+'건 (집계 제외)':''}</td></tr></tfoot></table></div></div>`;
  }
  function changeDetails(h) {
    if(!h.before||!h.after) return escape(h.detail||'');
    const result=[];
    if(h.before.mode!==h.after.mode) result.push('입력 방식: '+(h.before.mode==='quarter'?'분기 합계':'월별')+' → '+(h.after.mode==='quarter'?'분기 합계':'월별')+' (이전 방식의 금액은 보존·계산 제외)');
    for(const key of ['q',...C.MONTHS.map(String)]) {
      const a=key==='q'?h.before.quarter:h.before.months[key];
      const b=key==='q'?h.after.quarter:h.after.months[key];
      if(JSON.stringify(a)===JSON.stringify(b)) continue;
      const label=key==='q'?'분기 합계':key+'월';
      result.push(`${label}: 최초 ${C.money(a.original)} → ${C.money(b.original)} / 변경 ${C.money(a.revised)} → ${C.money(b.revised)} / 적용 ${C.money(C.effective(a).value)} → ${C.money(C.effective(b).value)}`);
      if(a.reason!==b.reason||b.reason) result.push('사유: '+(b.reason||'(없음)'));
    }
    return '<ul>'+result.map(x=>'<li>'+escape(x)+'</li>').join('')+'</ul>';
  }
  function historyView() {
    $('#content').innerHTML=`<div class="panel"><div class="section-head"><div><h2>변경 이력</h2><p>이 브라우저에 저장된 최근 500건입니다. 로그인 기반의 수정자 인증은 아직 연결되지 않았습니다.</p></div></div><div class="list">${state.history.length?[...state.history].reverse().map(h=>`<article class="history-item"><header><strong>${escape(h.fund||h.action)} ${escape(h.quarter)}</strong><span class="small muted">${escape(dateText(h.at))}</span></header><details open><summary>${escape(h.action)}</summary>${changeDetails(h)}</details></article>`).join(''):'<div class="empty">아직 변경 이력이 없습니다.<br>지원금을 입력·저장하면 변경 전후 값이 기록됩니다.</div>'}</div></div>`;
  }
  function settingsView() {
    const locked=C.hasData(state)||dirty||C.Funding.changes(C.Funding.initial(state.year),state.calculation).length>0;
    $('#content').innerHTML=`<div class="panel"><h2>학년도·분기 구간</h2><p class="hint">관리 기간: ${state.year}년 3월 ~ ${state.year+1}년 2월. 기본 분기는 학년도 기준이며, 실제 교부 구간에 맞게 경계를 조정할 수 있습니다.</p>
      <div class="settings-fields">${[0,1,2].map(i=>`<div><label for="end-${i}">${i+1}분기 마지막 월</label><select id="end-${i}" ${locked?'disabled':''}>${C.MONTHS.slice(0,11).map((m,n)=>`<option value="${n}" ${state.ends[i]===n?'selected':''}>${m<3?state.year+1:state.year}년 ${m}월</option>`).join('')}</select></div>`).join('')}</div>
      <button id="save-boundaries" ${locked?'disabled':''}>분기 구간 저장</button><p class="hint">${locked?'금액 또는 사유 입력 이력이 있는 학년도는 분기 구간을 바꿀 수 없습니다. 먼저 백업 후 초기화하거나 다른 학년도에서 설정하세요.':'4분기는 마지막 구간부터 다음 해 2월까지입니다. 각 분기는 겹치거나 빈 달이 없도록 연결됩니다.'}</p><div id="settings-error" role="alert"></div></div>
      <div class="panel"><h2>지원 항목</h2><p class="hint">아래 항목명은 입력을 돕는 기본 분류이며, 실제 교부 재원을 확정한 것이 아닙니다.</p><div class="fund-list">${state.funds.map(f=>`<div class="fund-row"><span><strong>${escape(f.name)}</strong><br><span class="small muted">${escape(f.category)}</span></span><button data-delete-fund="${f.id}" class="danger">항목 삭제</button></div>`).join('')}</div>
      <div class="selectors" style="margin-top:20px"><div><label for="fund-name">추가할 항목명</label><input id="fund-name" maxlength="60" placeholder="예: 추가 교부 식재료비"></div><div><label for="fund-category">비용 구분</label><select id="fund-category"><option>식재료비</option><option>운영비</option><option>인건비</option><option>기타</option></select></div></div><button id="add-fund" style="margin-top:16px">지원 항목 추가</button></div>
      <div class="panel"><h2>저장·계산 안내</h2><ul class="help-list"><li>정산 변경액은 차액이 아닌 <b>변경 후 총액</b>입니다.</li><li>최초 10,000,000원 → 변경 9,000,000원이면 적용 금액은 9,000,000원입니다.</li><li>변경 0원은 취소·감액 확정으로 처리합니다. 빈칸과 구분합니다.</li><li>월별로 입력된 상태에서 분기 입력으로 바꾸면 월 금액은 보존하지만 합계에서 제외합니다. 반대도 같습니다.</li><li>두 방식이 모두 비어 있으면 미입력입니다. 분기 총액을 월별로 임의 분할하지 않습니다.</li><li>데이터는 이 브라우저에만 저장되므로 백업 파일을 보관하세요. 다른 기기·다른 사람과 자동으로 동기화되지 않습니다.</li><li>브라우저 데이터 삭제·초기화 전 백업이 필요합니다. 변경 이력은 위·변조 방지 감사기록이 아닙니다.</li></ul></div>`;
    $('#save-boundaries').onclick=()=>{
      const ends=[0,1,2].map(i=>Number($('#end-'+i).value)).concat(11);
      try {
        const next=C.validateState({...state,ends});
        next.updatedAt=new Date().toISOString();next.history.push({at:next.updatedAt,action:'분기 구간 설정',fund:'',quarter:'',detail:C.ranges(next).map(x=>x.label+': '+x.span).join(' / ')});
        persist(next);settingsView();notify('분기 구간을 저장했습니다.');
      }catch(e){$('#settings-error').className='error';$('#settings-error').textContent=e.message;}
    };
    $('#add-fund').onclick=()=>{
      const name=$('#fund-name').value.trim();
      if(!name){notify('지원 항목명을 입력해주세요.');return;}
      if(state.funds.some(f=>f.name===name)){notify('같은 이름의 지원 항목이 있습니다.');return;}
      if(state.funds.length>=20){notify('지원 항목은 최대 20개입니다.');return;}
      const next=structuredClone(state);next.funds.push({id:'fund-'+Date.now().toString(36),name,category:$('#fund-category').value});
      next.updatedAt=new Date().toISOString();next.history.push({at:next.updatedAt,action:'지원 항목 추가',fund:name,quarter:'',detail:'새 지원 항목을 추가했습니다.'});
      try{persist(next);settingsView();notify('지원 항목을 추가했습니다.');}catch(e){notify(e.message);}
    };
    $$('[data-delete-fund]').forEach(btn=>btn.onclick=()=>{
      const id=btn.dataset.deleteFund;
      if(state.funds.length===1){notify('지원 항목은 최소 1개 필요합니다.');return;}
      const only=structuredClone(state);only.funds=only.funds.filter(f=>f.id===id);
      only.funds=state.funds.filter(f=>f.id===id);
      if(C.GRANT_MAP[id]){notify('학생수·교부 비교에 연결된 기본 재원은 삭제할 수 없습니다.');return;}
      delete only.grantIntegration;
      if(C.hasData(only)||state.grantIntegration?.conflicts.some(c=>c.fundId===id)){notify('입력값이 있는 항목은 삭제할 수 없습니다. 금액·사유를 모두 비운 뒤 저장하세요.');return;}
      if(!confirm('빈 지원 항목을 삭제할까요?'))return;
      const next=structuredClone(state),name=next.funds.find(f=>f.id===id).name;
      next.funds=next.funds.filter(f=>f.id!==id);delete next.records[id];
      next.updatedAt=new Date().toISOString();next.history.push({at:next.updatedAt,action:'빈 지원 항목 삭제',fund:name,quarter:'',detail:'입력 금액이 없는 지원 항목을 삭제했습니다.'});
      try{persist(next);settingsView();notify('빈 항목을 삭제했습니다.');}catch(e){notify(e.message);}
    });
  }
  function render() {
    updateTop();
    $('.stats').hidden=tab==='calculation'||tab==='ledger'||tab==='enrollment';
    document.body.classList.toggle('matrix-page',tab==='ledger');
    if(tab==='ledger')window.LedgerUI.render({$,esc:escape,money:C.money,C,notify,getState:()=>state,persist});
    if(tab==='enrollment')window.EnrollmentUI.render({$,esc:escape,money:C.money,C,notify,getState:()=>state,persist,setDirty:value=>{dirty=value;}});
    if(tab==='calculation') window.FundingUI.render({$,esc:escape,money:C.money,C,notify,getState:()=>state,persist,setDirty:value=>{dirty=value;}});
    if(tab==='summary') summaryView();
    if(tab==='history') historyView();
    if(tab==='settings') settingsView();
  }
  function download() {
    if(dirty&&!confirm('현재 미저장 입력은 백업에 포함되지 않습니다. 저장된 값만 백업할까요?')) return;
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`급식지원금_${state.year}학년도_백업_${new Date().toISOString().slice(0,10)}.json`;
    a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function sample() {
    if(!confirmLeave())return;
    if(C.hasData(state)||state.history.length||C.Funding.changes(C.Funding.initial(state.year),state.calculation).length) {notify('현재 학년도 자료를 보호하기 위해 예제를 덮어쓰지 않았습니다. 빈 학년도에서 예제를 사용하세요.');return;}
    let next=C.initial(year);
    next.calculation.meals['3']={grades:[{people:300,days:20},{people:280,days:20},{people:290,days:20}],actualStudent:null,staff:1000,external:10};
    let p=C.emptyPeriod();p.quarter={original:90000000,revised:84000000,reason:'[가상 예제] 최종 정산으로 지원액 감액'};
    next=C.savePeriod(next,'food-edu',0,p);
    p=C.emptyPeriod();p.mode='monthly';
    p.months['3']={original:10000000,revised:null,reason:''};
    p.months['4']={original:10000000,revised:0,reason:'[가상 예제] 해당 월 교부 취소'};
    p.months['5']={original:10000000,revised:8500000,reason:'[가상 예제] 정산 변경'};
    next=C.savePeriod(next,'operations',0,p);
    try{persist(next);fundId='food-edu';quarter=0;dirty=false;render();notify('실제 자료가 아닌 가상 예제를 불러왔습니다.');}catch(e){notify(e.message);}
  }
  function reset() {
    if(!confirm(`${year}학년도의 입력값·설정·변경 이력을 모두 삭제할까요? 백업하지 않은 자료는 복구할 수 없습니다.`))return;
    try{localStorage.removeItem(KEY+year);recoveryBlocked=false;storageOK=true;}catch(e){storageOK=false;}
    state=C.initial(year);dirty=false;fundId='food-edu';quarter=0;render();notify('현재 학년도를 초기화했습니다.');
  }
  // Warn rather than overwrite when another tab saves to the same local browser.
  window.addEventListener('storage',e=>{
    if(e.key===KEY+year) {
      if(dirty) {recoveryBlocked=true;updateTop();notify('다른 탭에서 값이 바뀌었습니다. 현재 입력을 별도로 기록한 뒤 새로고침하세요.');}
      else {state=read(year);render();notify('다른 탭의 저장 내용을 반영했습니다.');}
    }
  });
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  $('#year').innerHTML=Array.from({length:11},(_,i)=>2024+i).map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}학년도</option>`).join('');
  $('#year').onchange=e=>{
    if(!confirmLeave()){e.target.value=year;return;}
    year=Number(e.target.value);storageOK=true;recoveryBlocked=false;state=read(year);dirty=false;quarter=0;render();
  };
  $$('.tabs button').forEach(b=>b.onclick=()=>changeTab(b.dataset.tab));
  $('#export').onclick=download;$('#sample').onclick=sample;$('#clear').onclick=reset;
  $('#import').onclick=()=>$('#import-file').click();
  $('#import-file').onchange=async e=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    try{
      if(file.size>2_000_000)throw new Error('백업 파일은 2MB 이내여야 합니다.');
      const next=C.validateState(JSON.parse(await file.text()));
      const existing=next.year===year?state:read(next.year);
      if(!confirmLeave())return;
      if(!confirm(`${next.year}학년도 백업을 불러옵니다. ${C.hasData(existing)?'해당 학년도에 저장된 자료를 덮어씁니다.':'백업 내용으로 저장합니다.'} 계속할까요?`))return;
      recoveryBlocked=false;year=next.year;
      if(![...$('#year').options].some(o=>Number(o.value)===year))$('#year').add(new Option(year+'학년도',year));
      $('#year').value=year;persist(next);dirty=false;fundId=state.funds[0].id;quarter=0;render();notify('백업을 복원했습니다.');
    }catch(err){notify('불러오기 실패: '+err.message);}
  };
  state=read(year); render();
})();