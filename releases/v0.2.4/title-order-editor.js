'use strict';
(() => {
  const $ = id => document.getElementById(id);
  if ($('timo-order-editor')) return;

  const template = $('template');
  const container = template.parentElement;
  template.style.display = 'none';
  const styles = document.createElement('style');
  styles.textContent = '.tm-editor{background:#f7faff;border:1px solid #cddbf4;border-radius:10px;padding:14px;margin-top:9px}.tm-chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center;min-height:48px;border:1px dashed #aabce1;background:#fff;border-radius:9px;padding:10px;margin:8px 0}.tm-chip{display:inline-flex;align-items:center;gap:4px;background:#e8edfa;border:1px solid #afbddb;color:#263d62;border-radius:8px;padding:6px 6px 6px 9px;white-space:nowrap;font:600 13px system-ui,"Malgun Gothic",sans-serif;cursor:grab;user-select:none}.tm-chip.tm-priority{background:#eaf2ff;border-color:#8cb0f5;color:#204891}.tm-chip.tm-secondary{background:#e8f7ef;border-color:#93d6ae;color:#256744}.tm-chip.tm-desc{background:#fff4dc;border-color:#e9c86d;color:#694e17}.tm-chip.tm-over{outline:2px solid #3866df;outline-offset:2px}.tm-grip{opacity:.5;margin-right:3px}.tm-step{border:0;background:transparent;border-radius:4px;color:inherit;font-size:13px;cursor:pointer;padding:2px 3px}.tm-step:hover{background:#ffffff99}.tm-step:disabled{opacity:.23;cursor:default}.tm-legend{font-size:12px;color:#56718a;line-height:1.6}.tm-option{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px}.tm-option label{margin:0;display:inline-flex;gap:6px;align-items:center;font-weight:600}.tm-example{border-top:1px solid #d5def1;margin-top:12px;padding-top:10px;color:#365177;font-size:13px;line-height:1.6;word-break:keep-all}.tm-example strong{color:#1b3669}.tm-desc-input{margin-top:8px}.tm-tip{font-size:12px;color:#697e9d;margin:6px 0 0}';
  document.head.appendChild(styles);

  const wrapper=document.createElement('div');
  wrapper.id='timo-order-editor';
  wrapper.className='tm-editor';
  wrapper.innerHTML = '<strong>제목 구성 · 블록을 끌어서 순서 변경</strong><p class="tm-legend">회색: 지역·단지명 | 파랑: 우선노출 각각 | 초록: 하부노출 각각</p><div class="tm-chips" id="tm-chips" role="list" aria-label="제목 구성 순서"></div><p class="tm-tip">마우스로 끌어 놓거나 블록의 ◀ ▶ 버튼으로 이동할 수 있습니다.</p><div class="tm-option"><label><input type="checkbox" id="tm-desc-enabled"> 설명 문구 직접 추가 (기본 해제)</label></div><div class="tm-desc-input" id="tm-desc-row" style="display:none"><label for="tm-desc-input">직접 입력할 설명 문구</label><input type="text" id="tm-desc-input" placeholder="예: 창호 교체 시 확인사항" /></div><div class="tm-example" id="tm-example" aria-live="polite"></div>';
  container.insertBefore(wrapper, template.nextSibling);

  let order = [];
  const keyPart = key => key.startsWith('p:') ? key.slice(2) : key.startsWith('s:') ? key.slice(2) : '';
  const priorities = () => [...new Set(selectedKeywords())];
  const secondaries = () => {
    const checks=[...document.querySelectorAll('#secondaryKeywords input:checked')].map(x=>x.value);
    const extras=$('secondaryAdditional').value.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean);
    return [...new Set([...checks,...extras])];
  };
  function available() {
    const ids=['region','name'];
    const used=new Set();
    priorities().forEach(word => {if(!used.has(word)){ids.push('p:'+word);used.add(word);}});
    secondaries().forEach(word => {if(!used.has(word)){ids.push('s:'+word);used.add(word);}});
    if ($('tm-desc-enabled').checked) ids.push('desc');
    return ids;
  }
  function syncOrder() {
    const ids=available(), valid=new Set(ids);
    order=[...new Set(order.filter(id=>valid.has(id)).concat(ids))];
  }
  function labelFor(id) {
    if(id==='region')return '지역';
    if(id==='name')return '단지명';
    if(id==='desc')return '설명 문구';
    return keyPart(id);
  }
  function visibleText(id, row) {
    if(id==='region')return row?.region||$('regions').value.split(/[,，\n]/)[0].trim()||'지역';
    if(id==='name')return row?.name||'○○아파트';
    if(id==='desc')return $('tm-desc-input').value.trim();
    return keyPart(id);
  }
  function createTitle(row) {
    return order.map(id=>visibleText(id,row)).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  }
  function preview(){
    const first=typeof uniqueMatches!=='undefined' && uniqueMatches.length ? uniqueMatches[0] : null;
    const s=createTitle(first),n=[...s].length,limit=intOrNull($('maxTitle').value)||85;
    $('tm-example').textContent='';
    const headline=document.createElement('strong');headline.textContent='제목 미리보기 ('+n+'자)';$('tm-example').append(headline);
    const val=document.createElement('div');val.style.marginTop='5px';val.textContent=s;$('tm-example').append(val);
    if(n>limit){const warn=document.createElement('div');warn.style.color='#a23a29';warn.textContent='현재 글자 수 제한 '+limit+'자를 초과합니다. 키워드는 자동 삭제하지 않습니다.';$('tm-example').append(warn);}
  }
  function render(){
    syncOrder();
    const root=$('tm-chips');root.textContent='';
    order.forEach((id,index)=>{
      const chip=document.createElement('div');
      chip.className='tm-chip '+(id.startsWith('p:')?'tm-priority':id.startsWith('s:')?'tm-secondary':id==='desc'?'tm-desc':'');
      chip.dataset.key=id;chip.draggable=true;chip.setAttribute('role','listitem');
      chip.title='드래그해서 순서 변경: '+labelFor(id);
      const grip=document.createElement('span');grip.className='tm-grip';grip.textContent='⠿';chip.append(grip);
      const title=document.createElement('span');title.textContent=labelFor(id);chip.append(title);
      for(const [text,delta] of [['◀',-1],['▶',1]]){
        const btn=document.createElement('button');btn.type='button';btn.className='tm-step';btn.textContent=text;btn.title=labelFor(id)+' '+(delta<0?'왼쪽':'오른쪽')+' 이동';btn.setAttribute('aria-label',btn.title);
        btn.disabled=index+delta<0||index+delta>=order.length;
        btn.addEventListener('click',()=>moveKey(id,index+delta));
        chip.append(btn);
      }
      chip.addEventListener('dragstart',e=>{
        e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';
      });
      chip.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';chip.classList.add('tm-over');});
      chip.addEventListener('dragleave',()=>chip.classList.remove('tm-over'));
      chip.addEventListener('drop',e=>{
        e.preventDefault();chip.classList.remove('tm-over');
        const source=e.dataTransfer.getData('text/plain');
        if(order.includes(source))moveKey(source,order.indexOf(id));
      });
      root.append(chip);
    });
    preview();
    saveOrderSilently();
  }
  function saveOrderSilently() {
    try{localStorage.setItem('timo-title-order-v1',JSON.stringify({
      order,descriptionEnabled:$('tm-desc-enabled').checked,descriptionText:$('tm-desc-input').value
    }));}catch{}
  }
  function moveKey(key,newIndex){
    const oldIndex=order.indexOf(key);if(oldIndex<0)return;
    const target=Math.max(0,Math.min(order.length-1,newIndex));if(oldIndex===target)return;
    order.splice(oldIndex,1);order.splice(target,0,key);render();
  }
  function restore(data){
    if(data&&Array.isArray(data.titleOrder))order=data.titleOrder.filter(x=>typeof x==='string');
    if(data&&data.descriptionEnabled!==undefined)$('tm-desc-enabled').checked=!!data.descriptionEnabled;
    if(data&&typeof data.descriptionText==='string')$('tm-desc-input').value=data.descriptionText;
    $('tm-desc-row').style.display=$('tm-desc-enabled').checked?'block':'none';
    render();
  }
  try{
    const preferences=localStorage.getItem('timo-title-order-v1');
    if(preferences){
      const o=JSON.parse(preferences);
      restore({titleOrder:o.order,descriptionEnabled:o.descriptionEnabled,descriptionText:o.descriptionText});
    }
    const stored=localStorage.getItem('timo-title-generator-v1');
    if(stored)restore(JSON.parse(stored));
  } catch {render();}
  if(!order.length)render();

  const oldSettings=settings;
  settings=()=>({
    ...oldSettings(),titleOrder:[...order],
    descriptionEnabled:$('tm-desc-enabled').checked,
    descriptionText:$('tm-desc-input').value
  });
  const oldApply=applySettings;
  applySettings=(data)=>{oldApply(data);restore(data);};
  const oldBuild=buildTitles;
  buildTitles=function(){
    // Keep all filtering and 731-complex validation logic unchanged.
    // The new editor controls the final title ordering only.
    syncOrder();
    const result=oldBuild();
    const maxLength=intOrNull($('maxTitle').value)||85;
    result.titles=result.titles.map(item=>{
      const title=createTitle(item);
      return {...item,title,titleOver:[...title].length>maxLength};
    });
    const audit=$('filterAudit');
    if(audit){
      const long=result.titles.filter(x=>x.titleOver).length;
      const warning='블록 순서 적용: '+numfmt(result.titles.length)+'개 제목 · 길이 제한 초과 '+numfmt(long)+'개'+(long?' (키워드 자동 생략 없음)':'');
      audit.textContent=audit.textContent.replace(/\n블록 순서 적용:.*$/s,'')+'\n'+warning;
    }
    preview();
    return result;
  };
  $('tm-desc-enabled').addEventListener('change',e=>{
    $('tm-desc-row').style.display=e.target.checked?'block':'none';
    render();
  });
  $('tm-desc-input').addEventListener('input',()=>{preview();saveOrderSilently();});
  for(const id of ['keywords','secondaryKeywords']){
    $(id).addEventListener('change',render);
  }
  for(const id of ['additional','secondaryAdditional','regions','maxTitle']){
    $(id).addEventListener('input',render);
  }
  $('makeBtn').addEventListener('click',()=>setTimeout(preview,100));
  // Keep original template as an internal compatibility field. It must not
  // constrain individual keyword order or introduce the old automatic description.
  template.value='{{지역}} {{단지명}} {{우선키워드}} {{하부키워드}}';
  const footer=document.querySelector('.foot');
  if(footer)footer.textContent='제목 생성기 0.2.4 · 개별 키워드 드래그 정렬 · 설명 문구는 사용자가 선택한 경우에만 포함';
})();
