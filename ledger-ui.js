(() => {
  'use strict';
  let view=null,group='all',period='all';
  const L=window.LedgerMatrix;
  const subtotal=new Set([7,15,24,36,40]),grand=new Set([16,41]),balance=new Set([25,37]);
  const num=n=>n===null?'—':n.toLocaleString('ko-KR',{maximumFractionDigits:0});
  function render(o){
    const {$,esc,money,C,notify,getState,persist}=o,state=getState();
    if(view===null)view=state.matrix?'working':'reference';
    if(state.year!==L.Ref.year)view='working';
    const report=view==='reference'?L.reference():L.compute(state),totals=L.totals(report);
    const canEdit=view==='working'&&state.matrix!==null;
    const indexes=period==='first'?[0,1,2,3,4,5]:period==='second'?[6,7,8,9,10,11]:period.startsWith('month-')?[L.M.indexOf(Number(period.slice(6)))]:L.M.map((_,i)=>i);
    function commit(matrix,action,detail){
      try{
        const next=structuredClone(getState());next.matrix=L.validate(matrix,next.year);next.updatedAt=new Date().toISOString();
        next.history.push({at:next.updatedAt,action,fund:'급식관리대장',quarter:'',detail});next.history=next.history.slice(-500);
        persist(next);render(o);notify('작업 대장에 반영했습니다.');
      }catch(e){notify(e.message);}
    }
    $('#content').innerHTML=`
      <section class="ledger-panel">
        <div class="section-head"><div><h2>월별 급식관리대장</h2><p>첨부하신 관리대장의 행 구성 그대로 · 3월~다음 해 2월 · 원 단위</p></div><span class="badge ${view==='reference'?'orange':'blue'}">${view==='reference'?'첨부 대장 기준 · 읽기 전용':'작업 대장 · '+(canEdit?'수정 가능':'미시작')}</span></div>
        <div class="ledger-controls">
          <div class="mode" role="group" aria-label="대장 자료 선택"><button id="ledger-reference" aria-pressed="${view==='reference'}" ${state.year!==L.Ref.year?'disabled':''}>첨부 대장 기준</button><button id="ledger-working" aria-pressed="${view==='working'}">작업 대장</button></div>
          <div class="ledger-actions">${state.year===L.Ref.year?'<button id="ledger-seed">첨부 대장을 작업용으로 가져오기</button>':''}<button id="ledger-empty">빈 작업 대장 시작</button><button id="ledger-settings">식수·단가 설정</button><button id="ledger-csv">현재 표 CSV 저장</button></div>
        </div>
        <div class="ledger-source"><strong>${view==='reference'?esc(L.Ref.sourceLabel):canEdit&&state.matrix.seeded?'첨부 대장 기준값 + 현재 식수·단가·정산 설정 + 셀 변경액':'현재 입력한 식수·단가·정산 설정'}</strong><br>${view==='reference'?'원본 저장된 계산값을 보존한 비교용 화면입니다. 10월 16일 지출·징수 원본까지 갱신한 자료는 아닙니다.':'합계·잔액은 자동 계산합니다. 숫자 셀을 눌러 변경액과 사유를 저장하거나 변경액을 삭제할 수 있습니다.'}<br><span>집계값만 포함하며 개인별 급여·직원 성명은 제외했습니다. 공개 기준 집계값입니다. 입력값 공동 저장·인증된 변경 이력은 아직 제공하지 않습니다.</span></div>
        <div class="ledger-kpis">
          <div><label>수입·배분 산정 합계</label><strong id="ledger-income">${money(totals.income)}</strong></div>
          <div><label>지원금·수익자부담 지출</label><strong id="ledger-expenses">${money(totals.supportExpenses)}</strong></div>
          <div><label>관리 잔액 · 예상 포함</label><strong id="ledger-balance" class="${totals.balance<0?'negative':''}">${money(totals.balance)}</strong></div>
          <div><label>학교 자체부담 지출 · 별도</label><strong id="ledger-school">${money(totals.schoolExpenses)}</strong></div>
        </div>
        <div class="ledger-filters"><div><label for="ledger-group">표시 구역</label><select id="ledger-group"><option value="all">전체 대장</option>${L.groups.map(g=>`<option value="${g.id}" ${group===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></div><div><label for="ledger-period">표시 기간</label><select id="ledger-period"><option value="all">전체 12개월</option><option value="first" ${period==='first'?'selected':''}>상반기 · 3~8월</option><option value="second" ${period==='second'?'selected':''}>하반기 · 9~2월</option>${L.M.map(m=>`<option value="month-${m}" ${period==='month-'+m?'selected':''}>${m}월만 보기</option>`).join('')}</select></div><p class="ledger-legend"><span class="legend-budget">지원금</span><span class="legend-allocation">수익자·지출</span><span class="legend-change">셀 변경액 우선</span><span class="negative">− 음수 잔액</span></p></div>
        <p class="hint">열 제목과 항목명·합계는 스크롤해도 고정됩니다. 좁은 화면에서는 표 안을 좌우로 이동하거나 월을 선택하세요. 합계 열은 선택한 표시 기간과 무관한 연간 값입니다.</p>
        <div class="ledger-scroll" tabindex="0" role="region" aria-label="월별 급식관리대장 표 · 가로 세로 스크롤">
          <table class="ledger-table ${indexes.length===1?'single':''}"><caption class="sr-only">${state.year}학년도 급식관리대장 · ${view==='reference'?'첨부 대장 기준':'작업 대장'}</caption>
            <thead><tr><th scope="col">구분</th>${indexes.map(i=>`<th scope="col">${L.M[i]}월${L.M[i]<3?'<small>'+(state.year+1)+'년</small>':''}</th>`).join('')}<th scope="col">연간 합계</th></tr></thead>
            ${L.groups.filter(g=>group==='all'||g.id===group).map(g=>`
              <tbody data-ledger-group="${g.id}">
                <tr class="ledger-section"><th scope="row">${esc(g.name)}</th>${indexes.map(i=>`<td>${g.id==='school'?'<span>지원금과 별도</span>':canEdit?`<label class="sr-only" for="status-${g.id}-${L.M[i]}">${L.M[i]}월 ${g.name} 상태</label><select id="status-${g.id}-${L.M[i]}" data-ledger-status="${g.id}:${i}"><option ${report[g.id==='income'?'incomeStatus':'expenseStatus'][i]==='정산'?'selected':''}>정산</option><option ${report[g.id==='income'?'incomeStatus':'expenseStatus'][i]==='예상'?'selected':''}>예상</option></select>`:`<span>${report[g.id==='income'?'incomeStatus':'expenseStatus'][i]}</span>`}</td>`).join('')}<td>정산·예상 포함</td></tr>
                ${g.rows.map(r=>{
                  const row=report.rows[String(r)];
                  const cls=grand.has(r)?'ledger-grand':subtotal.has(r)?'ledger-subtotal':balance.has(r)?'ledger-balance-row':r<=6?'ledger-budget':r<=15?'ledger-allocation':g.id==='expenses'?'ledger-cost':'ledger-own';
                  return `<tr class="${cls}" data-ledger-row="${r}"><th scope="row">${esc(row.label)}${r===6?'<small>월: 계획배분 / 합계: 연간 기준</small>':''}</th>${indexes.map(i=>{
                    const n=row.values[i],change=view==='working'&&state.matrix?.overrides[r+':'+L.M[i]],title=view==='reference'?'원본 기초자료!'+['R','S','T','U','V','W','X','Y','Z','AA','AB','AC'][i]+r+' 저장값':report.sources[r+':'+L.M[i]];
                    return `<td class="${n!==null&&n<0?'negative':''} ${change?'ledger-overridden':''}" data-ledger-cell="${r}:${L.M[i]}" title="${esc(title)}">${canEdit&&L.editable.includes(r)?`<button data-ledger-edit="${r}:${L.M[i]}" aria-label="${esc(row.label)} ${L.M[i]}월 ${num(n)}원 수정">${num(n)}${change?'<span class="cell-dot" aria-hidden="true"> •</span>':''}</button>`:`<span>${num(n)}</span>`}</td>`;
                  }).join('')}<td class="ledger-annual ${row.total!==null&&row.total<0?'negative':''}" data-ledger-total="${r}">${num(row.total)}</td></tr>`;
                }).join('')}
              </tbody>`).join('')}
          </table>
        </div>
        <details class="ledger-notes"><summary>계산 기준·주의사항 ${report.warnings.length}개</summary><ul>${report.warnings.map(x=>'<li>'+esc(x)+'</li>').join('')}<li>원본의 13월·14월 표기는 화면에서 다음 해 1월·2월로 표시합니다.</li><li>작업 대장의 교직원 미납액은 정산월 징수액−수납액으로 계산합니다. 원본에서 비어 있던 행과 다를 수 있습니다.</li><li>학교 자체부담 지출은 별도 재원이므로 지원금 관리 잔액에서 중복 차감하지 않습니다.</li><li>선택 지출 항목의 빈칸은 원본 SUM 방식으로 소계에서 제외합니다. 신규 정산월의 필수 실적이 없으면 —로 표시합니다.</li><li>같은 항목의 분기 정산 변경액이 활성화되어 있으면 월별로 임의 배분하지 않습니다. 월별 셀 변경은 보존하되 해당 분기에서는 적용하지 않습니다.</li></ul></details>
      </section>
      <dialog id="ledger-editor" aria-labelledby="ledger-edit-title"><form method="dialog"><div class="section-head"><h2 id="ledger-edit-title">셀 변경</h2><button value="cancel" aria-label="닫기">닫기</button></div></form><div id="ledger-edit-content"></div></dialog>`;
    $('#ledger-group').value=group;$('#ledger-period').value=period;
    $('#ledger-reference').onclick=()=>{view='reference';render(o);};
    $('#ledger-working').onclick=()=>{view='working';render(o);};
    $('#ledger-settings').onclick=()=>$('#tab-calculation').click();
    $('#ledger-group').onchange=e=>{group=e.target.value;render(o);};
    $('#ledger-period').onchange=e=>{period=e.target.value;render(o);};
    if($('#ledger-seed'))$('#ledger-seed').onclick=()=>{
      if(state.matrix&&!confirm('기존 작업 대장의 셀 변경액·월별 상태를 첨부 기준으로 초기화할까요? 식수·단가·산정 정산 설정은 유지됩니다. 필요하면 먼저 백업하세요.'))return;
      if(!state.matrix&&!confirm('첨부 관리대장의 집계값을 작업 기준으로 사용합니다. 기존 식수·단가 설정은 유지됩니다. 계속할까요?'))return;
      view='working';commit(L.initial(state.year,true),'첨부 관리대장 가져오기','기초자료 Q2:AD49 집계값을 기준으로 사용. 개인별 자료 제외. 기존 식수·단가 설정 유지.');
    };
    $('#ledger-empty').onclick=()=>{
      if(state.matrix&&!confirm('작업 대장의 원본 기준값·셀 변경액·월별 상태를 비우고 새로 시작할까요? 식수·단가 설정은 유지됩니다.'))return;
      view='working';commit(L.initial(state.year,false),'빈 작업 관리대장 시작','첨부 집계값을 사용하지 않는 작업 대장을 시작했습니다.');
    };
    document.querySelectorAll('[data-ledger-status]').forEach(el=>el.onchange=()=>{
      const [g,i]=el.dataset.ledgerStatus.split(':'),next=structuredClone(state.matrix),field=g==='income'?'incomeStatus':'expenseStatus';
      const before=next[field][Number(i)];next[field][Number(i)]=el.value;
      commit(next,'월별 정산 상태 변경',L.M[Number(i)]+'월 '+(g==='income'?'징수':'지출')+' '+before+' → '+el.value+'; 신규 정산 실적은 자동 생성하지 않음');
    });
    document.querySelectorAll('[data-ledger-edit]').forEach(btn=>btn.onclick=()=>{
      const [rs,ms]=btn.dataset.ledgerEdit.split(':'),r=Number(rs),m=Number(ms),i=L.M.indexOf(m);
      if(r===4||r===5){
        const type=r===4?'food':'operations',c=state.calculation.corrections[type],q=state.ends.findIndex(end=>i<=end);
        if(state.calculation.planning?.enabled&&C.Funding.compute(state.calculation,state.ends).quarters[q][type].mode==='received'){notify('실제 분기 교부액 적용 중입니다. 학생수·분기 신청 → 분기 신청·실제 교부에서 수정하세요.');return;}
        if(c.mode==='quarter'&&c.quarters[q].value!==null){notify('분기 변경액 적용 중입니다. 식수·지원금 산정 → 정산 변경에서 수정하거나 월별 방식으로 바꾸세요.');return;}
      }
      const entry=state.matrix.overrides[btn.dataset.ledgerEdit],without=structuredClone(state);
      delete without.matrix.overrides[btn.dataset.ledgerEdit];const baseReport=L.compute(without),base=baseReport.rows[rs].values[i];
      $('#ledger-edit-title').textContent=report.rows[rs].label+' · '+m+'월';
      $('#ledger-edit-content').innerHTML=`
        <div class="rules"><span class="step">기준값</span><span>${money(base)}<br>${esc(baseReport.sources[btn.dataset.ledgerEdit])}</span></div>
        ${r===6?'<p class="hint">이 셀은 월별 관리용 계획배분입니다. 연간 인건비 총액을 바꾸려면 식수·단가 설정에서 연간 기준·정산값을 수정하세요. 월별 배분은 실제 입금액이 아닙니다.</p>':''}
        <label for="ledger-edit-value">변경 후 총액 (원)</label><input id="ledger-edit-value" inputmode="decimal" value="${entry?entry.value:''}" placeholder="비우면 위 기준값으로 복귀"><p class="field-help">0원도 유효합니다. 증감액이 아닌 변경 후 총액을 입력하세요. —는 미입력·미배분입니다.</p>
        <label for="ledger-edit-reason" style="margin-top:16px">변경 사유</label><input id="ledger-edit-reason" maxlength="500" value="${esc(entry?.reason??'')}" placeholder="금액 변경·삭제 시 사유 필수">
        <div id="ledger-edit-error" role="alert"></div><div class="savebar"><button id="ledger-remove">변경액 비우기</button><button id="ledger-save" class="primary">변경액 저장</button></div>`;
      const dialog=$('#ledger-editor');dialog.showModal();
      $('#ledger-edit-value').focus();
      $('#ledger-remove').onclick=()=>{$('#ledger-edit-value').value='';};
      $('#ledger-save').onclick=()=>{
        try{
          const raw=$('#ledger-edit-value').value.trim().replace(/,/g,''),reason=$('#ledger-edit-reason').value.trim();
          if(raw!==''&&!/^-?\d+(?:\.\d{1,2})?$/.test(raw))throw new Error('변경 후 총액은 숫자로 입력하세요. 소수는 최대 2자리까지 지원합니다.');
          if(!reason&&(raw!==''||entry))throw new Error('변경 또는 삭제 사유를 입력하세요.');
          const next=structuredClone(state.matrix);
          if(raw==='')delete next.overrides[btn.dataset.ledgerEdit];
          else next.overrides[btn.dataset.ledgerEdit]={value:Number(raw),reason};
          dialog.close();commit(next,'관리대장 셀 변경',report.rows[rs].label+' '+m+'월: '+num(report.rows[rs].values[i])+' → '+(raw===''?'기준값 '+num(base):num(Number(raw)))+' / 사유: '+reason);
        }catch(e){$('#ledger-edit-error').className='error';$('#ledger-edit-error').textContent=e.message;}
      };
    });
    $('#ledger-csv').onclick=()=>{
      const lines=[['자료',view==='reference'?'첨부 관리대장 기준':'작업 관리대장'],['기준파일',L.Ref.sourceLabel],['주의','산정·예상 포함. 실제 입금·통장잔액 아님. 공개 기준 집계값. 입력값은 이 브라우저에만 저장됩니다.'],['구역','항목',...indexes.map(i=>L.M[i]+'월'),'연간 합계']];
      for(const g of L.groups.filter(g=>group==='all'||g.id===group))for(const r of g.rows){const row=report.rows[String(r)];lines.push([g.name,row.label,...indexes.map(i=>row.values[i]),row.total]);}
      const csv='\ufeff'+lines.map(a=>a.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
      a.href=url;a.download=`급식관리대장_${state.year}_${view==='reference'?'첨부기준':'작업'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    };
  }
  window.LedgerUI={render};
})();