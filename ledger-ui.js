(() => {
  'use strict';
  let group='all',period='all';
  const L=window.LedgerMatrix;
  const subtotal=new Set([7,15,24,36,40]),grand=new Set([16,41]),balance=new Set([25,37]);
  const num=n=>n===null?'—':n.toLocaleString('ko-KR',{maximumFractionDigits:0});
  function render(o){
    const {$,esc,money,C,notify,getState,persist}=o,state=getState();
    const config=L.sourceConfig(state),report=L.unified(state),totals=L.totals(report);
    const canEdit=true;
    const indexes=period==='first'?[0,1,2,3,4,5]:period==='second'?[6,7,8,9,10,11]:period.startsWith('month-')?[L.M.indexOf(Number(period.slice(6)))]:L.M.map((_,i)=>i);
    function commit(matrix,action,detail){
      try{
        const next=structuredClone(getState());next.matrix=L.validate(matrix,next.year);next.updatedAt=new Date().toISOString();
        next.history.push({at:next.updatedAt,action,fund:'급식관리대장',quarter:'',detail});next.history=next.history.slice(-500);
        persist(next);render(o);notify('관리대장에 반영했습니다.');
      }catch(e){notify(e.message);}
    }
    $('#content').innerHTML=`
      <section class="ledger-panel">
        <div class="section-head"><div><h2>월별 급식관리대장</h2><p>제공 관리대장 기준 · 자료 실적과 원본 수식 예상치를 한 표로 · 원 단위</p></div><span class="badge blue">${state.year}학년도 · 실적 + 예상</span></div>
        <div class="ledger-controls">
          <p class="hint">${state.year===L.Data.year?'3~9월: 제공 자료 실적 · 10~다음 해 2월: 원본 수식 예상':'이 학년도는 제공된 원본 자료가 없습니다. 학생수·일수 및 실제 자료 입력이 필요합니다.'}</p>
          <div class="ledger-actions"><button id="ledger-settings">학생수·식수·단가 확인</button><button id="ledger-csv">현재 표 CSV 저장</button></div>
        </div>
        <div class="ledger-source"><strong>${state.year===L.Data.year?'기준: '+esc(L.Data.provenance.ledger)+' · 지출/징수 '+L.Data.asOf+' 자료 반영':'선택 학년도 직접 입력 기준'}</strong><br>자료가 없는 미래 월은 원본 IF 함수의 예상 분기로 계산합니다. 학생수는 최근 입력 인원, 급식일수는 관리대장의 월별 일수를 사용합니다. 월별 산정액은 분기 교부총액과 구분하여 빈칸 없이 표시합니다.<br><span>징수액과 실제 수납액은 별도입니다. 셀을 누르면 계산 근거를 확인하거나 금액을 수정할 수 있습니다. 기존 셀 변경액은 보존되며 강조 표시됩니다.</span></div>
        <div class="ledger-kpis">
          <div><label>수입·배분 산정 합계</label><strong id="ledger-income">${money(totals.income)}</strong></div>
          <div><label>지원금·수익자부담 지출</label><strong id="ledger-expenses">${money(totals.supportExpenses)}</strong></div>
          <div><label>관리 잔액 · 예상 포함</label><strong id="ledger-balance" class="${totals.balance<0?'negative':''}">${money(totals.balance)}</strong></div>
          <div><label>학교 자체부담 지출 · 별도</label><strong id="ledger-school">${money(totals.schoolExpenses)}</strong></div>
        </div>
        <div class="ledger-filters"><div><label for="ledger-group">표시 구역</label><select id="ledger-group"><option value="all">전체 대장</option>${L.groups.map(g=>`<option value="${g.id}" ${group===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></div><div><label for="ledger-period">표시 기간</label><select id="ledger-period"><option value="all">전체 12개월</option><option value="first" ${period==='first'?'selected':''}>상반기 · 3~8월</option><option value="second" ${period==='second'?'selected':''}>하반기 · 9~2월</option>${L.M.map(m=>`<option value="month-${m}" ${period==='month-'+m?'selected':''}>${m}월만 보기</option>`).join('')}</select></div><p class="ledger-legend"><span class="legend-budget">지원금</span><span class="legend-allocation">수익자·지출</span><span class="legend-change">셀 변경액 우선</span><span class="negative">− 음수 잔액</span></p></div>
        <p class="hint">열 제목과 항목명·합계는 스크롤해도 고정됩니다. 좁은 화면에서는 표 안을 좌우로 이동하거나 월을 선택하세요. 합계 열은 선택한 표시 기간과 무관한 연간 값입니다.</p>
        <div class="ledger-scroll" tabindex="0" role="region" aria-label="월별 급식관리대장 표 · 가로 세로 스크롤">
          <table class="ledger-table ${indexes.length===1?'single':''}"><caption class="sr-only">${state.year}학년도 급식관리대장 · 제공 자료 실적 + 원본 수식 예상</caption>
            <thead><tr><th scope="col">구분</th>${indexes.map(i=>`<th scope="col">${L.M[i]}월${L.M[i]<3?'<small>'+(state.year+1)+'년</small>':''}</th>`).join('')}<th scope="col">연간 합계</th></tr></thead>
            ${L.groups.filter(g=>group==='all'||g.id===group).map(g=>`
              <tbody data-ledger-group="${g.id}">
                <tr class="ledger-section"><th scope="row">${esc(g.name)}</th>${indexes.map(i=>`<td>${g.id==='school'?'<span>지원금과 별도</span>':`<span class="badge ${report[g.id==='income'?'incomeStatus':'expenseStatus'][i]==='정산'?'blue':'orange'}">${report[g.id==='income'?'incomeStatus':'expenseStatus'][i]==='정산'?'자료 실적':'예상'}</span>`}</td>`).join('')}<td>실적·예상 포함</td></tr>
                ${g.rows.map(r=>{
                  const row=report.rows[String(r)];
                  const cls=grand.has(r)?'ledger-grand':subtotal.has(r)?'ledger-subtotal':balance.has(r)?'ledger-balance-row':r<=6?'ledger-budget':r<=15?'ledger-allocation':g.id==='expenses'?'ledger-cost':'ledger-own';
                  return `<tr class="${cls}" data-ledger-row="${r}"><th scope="row">${esc(row.label)}${r===6?'<small>월: 계획배분 / 합계: 연간 기준</small>':''}</th>${indexes.map(i=>{
                    const n=row.values[i],change=config.overrides[r+':'+L.M[i]],title=report.sources[r+':'+L.M[i]];
                    return `<td class="${n!==null&&n<0?'negative':''} ${change?'ledger-overridden':''}" data-ledger-cell="${r}:${L.M[i]}" title="${esc(title)}">${canEdit&&L.editable.includes(r)?`<button data-ledger-edit="${r}:${L.M[i]}" aria-label="${esc(row.label)} ${L.M[i]}월 ${num(n)}원 수정">${num(n)}${change?'<span class="cell-dot" aria-hidden="true"> •</span>':''}</button>`:`<span>${num(n)}</span>`}</td>`;
                  }).join('')}<td class="ledger-annual ${row.total!==null&&row.total<0?'negative':''}" data-ledger-total="${r}">${num(row.total)}</td></tr>`;
                }).join('')}
              </tbody>`).join('')}
          </table>
        </div>
        <details class="ledger-notes"><summary>계산 기준·주의사항 ${report.warnings.length}개</summary><ul>${report.warnings.map(x=>'<li>'+esc(x)+'</li>').join('')}<li>원본의 13월·14월 표기는 화면에서 다음 해 1월·2월로 표시합니다.</li><li>교직원 미납액은 자료 실적월의 징수액−수납액−불납결손액입니다. 예상월 미납액은 미확정으로 표시합니다.</li><li>학교 자체부담 지출은 별도 재원이므로 지원금 관리 잔액에서 중복 차감하지 않습니다.</li><li>선택 지출 항목의 빈칸은 원본 SUM 방식으로 소계에서 제외합니다. 신규 정산월의 필수 실적이 없으면 —로 표시합니다.</li><li>분기 교부액은 별도 신청 화면에서 비교합니다. 이 대장의 월별 재료비·운영비 산정행을 분기 총액으로 대체하거나 중복 합산하지 않습니다.</li></ul></details>
      </section>
      <dialog id="ledger-editor" aria-labelledby="ledger-edit-title"><form method="dialog"><div class="section-head"><h2 id="ledger-edit-title">셀 변경</h2><button value="cancel" aria-label="닫기">닫기</button></div></form><div id="ledger-edit-content"></div></dialog>`;
    $('#ledger-group').value=group;$('#ledger-period').value=period;
    $('#ledger-settings').onclick=()=>$('#tab-enrollment').click();
    $('#ledger-group').onchange=e=>{group=e.target.value;render(o);};
    $('#ledger-period').onchange=e=>{period=e.target.value;render(o);};
    document.querySelectorAll('[data-ledger-edit]').forEach(btn=>btn.onclick=()=>{
      const [rs,ms]=btn.dataset.ledgerEdit.split(':'),r=Number(rs),m=Number(ms),i=L.M.indexOf(m);
      if(state.year!==L.Data.year&&(r===4||r===5)){
        const type=r===4?'food':'operations',c=state.calculation.corrections[type],q=state.ends.findIndex(end=>i<=end);
        if(state.calculation.planning?.enabled&&C.Funding.compute(state.calculation,state.ends).quarters[q][type].mode==='received'){notify('실제 분기 교부액 적용 중입니다. 학생수·분기 신청 → 분기 신청·실제 교부에서 수정하세요.');return;}
        if(c.mode==='quarter'&&c.quarters[q].value!==null){notify('분기 변경액 적용 중입니다. 식수·지원금 산정 → 정산 변경에서 수정하거나 월별 방식으로 바꾸세요.');return;}
      }
      const entry=config.overrides[btn.dataset.ledgerEdit],without=structuredClone(state);
      without.matrix=structuredClone(config);
      delete without.matrix.overrides[btn.dataset.ledgerEdit];const baseReport=L.unified(without),base=baseReport.rows[rs].values[i];
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
          const next=structuredClone(config);
          if(raw==='')delete next.overrides[btn.dataset.ledgerEdit];
          else next.overrides[btn.dataset.ledgerEdit]={value:Number(raw),reason};
          dialog.close();commit(next,'관리대장 셀 변경',report.rows[rs].label+' '+m+'월: '+num(report.rows[rs].values[i])+' → '+(raw===''?'기준값 '+num(base):num(Number(raw)))+' / 사유: '+reason);
        }catch(e){$('#ledger-edit-error').className='error';$('#ledger-edit-error').textContent=e.message;}
      };
    });
    $('#ledger-csv').onclick=()=>{
      const lines=[['자료','제공 자료 실적 + 원본 수식 예상'],['기준파일',L.Ref.sourceLabel],['실적자료',L.Data.provenance.expenses+' / '+L.Data.provenance.receipts],['적용구분','3~9월 자료 실적 / 10~다음 해 2월 원본 수식 예상'],['주의','산정·예상 포함. 실제 입금·통장잔액 아님. 공개 기준 집계값. 입력값은 이 브라우저에만 저장됩니다.'],['구역','항목',...indexes.map(i=>L.M[i]+'월'),'연간 합계']];
      for(const g of L.groups.filter(g=>group==='all'||g.id===group))for(const r of g.rows){const row=report.rows[String(r)];lines.push([g.name,row.label,...indexes.map(i=>row.values[i]),row.total]);}
      const csv='\ufeff'+lines.map(a=>a.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
      a.href=url;a.download=`급식관리대장_${state.year}_실적예상통합.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    };
  }
  window.LedgerUI={render};
})();