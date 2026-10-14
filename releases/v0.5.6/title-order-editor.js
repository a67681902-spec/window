'use strict';
(() => {
  const $ = id => document.getElementById(id);
  if ($('timo-order-editor')) return;
  const template = $('template');
  if (!template) return;
  const container = template.parentElement;
  template.style.display = 'none';

  const css = document.createElement('style');
  css.textContent = [
    '.tm-editor{background:#f7faff;border:1px solid #cddbf4;border-radius:10px;padding:14px;margin-top:9px}',
    '.tm-chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center;min-height:48px;border:1px dashed #aabce1;background:#fff;border-radius:9px;padding:10px;margin:8px 0}',
    '.tm-chip{display:inline-flex;align-items:center;gap:4px;background:#e8edfa;border:1px solid #afbddb;color:#263d62;border-radius:8px;padding:6px 6px 6px 9px;white-space:nowrap;font:600 13px system-ui,"Malgun Gothic",sans-serif;cursor:grab;user-select:none;max-width:100%}',
    '.tm-chip.tm-priority{background:#eaf2ff;border-color:#8cb0f5;color:#204891}',
    '.tm-chip.tm-secondary{background:#e8f7ef;border-color:#93d6ae;color:#256744}',
    '.tm-chip.tm-note{background:#fff0ca;border-color:#dfb75c;color:#775119}',
    '.tm-chip.tm-over{outline:2px solid #3866df;outline-offset:2px}',
    '.tm-chip-label{overflow:hidden;text-overflow:ellipsis;max-width:220px}',
    '.tm-grip{opacity:.5;margin-right:3px}',
    '.tm-step{border:0;background:transparent;border-radius:4px;color:inherit;font-size:13px;cursor:pointer;padding:2px 3px}',
    '.tm-step:hover{background:#ffffff99}.tm-step:disabled{opacity:.23;cursor:default}',
    '.tm-legend,.tm-tip{font-size:12px;color:#56718a;line-height:1.6;margin:6px 0}',
    '.tm-phrases{margin-top:10px;display:grid;gap:7px}',
    '.tm-phrase-row{display:flex;align-items:center;gap:7px}',
    '.tm-phrase-row input{flex:1;min-width:110px;padding:9px;border:1px solid #ccd7eb;border-radius:7px}',
    '.tm-phrase-row button,.tm-add-button{border:1px solid #aac0e9;border-radius:7px;cursor:pointer;padding:9px 12px;background:#e8efff;color:#234b88;font-weight:700}',
    '.tm-phrase-row button.tm-remove{border-color:#edc5c5;background:#fff0f0;color:#943b3b}',
    '.tm-example{border-top:1px solid #d5def1;margin-top:12px;padding-top:10px;color:#365177;font-size:13px;line-height:1.6;word-break:keep-all}',
    '.tm-example strong{color:#1b3669}'
  ].join('');
  document.head.appendChild(css);

  const wrapper = document.createElement('div');
  wrapper.id = 'timo-order-editor';
  wrapper.className = 'tm-editor';
  wrapper.innerHTML = '<strong>제목 구성 순서 (블록 드래그)</strong>'
    + '<p class="tm-legend">회색: 지역·단지명 | 파랑: 우선키워드 | 초록: 하부키워드 | 노랑: 설명 문구</p>'
    + '<div id="tm-chips" class="tm-chips" role="list" aria-label="제목 구성 순서"></div>'
    + '<p class="tm-tip">블록을 드래그하거나 ◀ ▶로 위치를 변경하세요. 모든 선택 키워드는 유지됩니다.</p>'
    + '<div style="margin-top:12px"><strong>설명 문구 직접 추가</strong>'
    + '<p class="tm-tip">견적·단열 같은 문구는 자동으로 붙이지 않습니다. 아래에서 원하는 문구를 여러 개 추가하세요.</p>'
    + '<div class="tm-phrase-row"><input type="text" id="tm-new-phrase" maxlength="100" placeholder="예: 창호 교체 전 확인사항" aria-label="추가할 설명 문구" />'
    + '<button type="button" id="tm-add-phrase" class="tm-add-button">+ 추가</button></div>'
    + '<div class="tm-phrases" id="tm-phrases" aria-label="등록한 설명 문구"></div></div>'
    + '<div class="tm-example" id="tm-example" aria-live="polite"></div>';
  container.insertBefore(wrapper, template.nextSibling);
  template.value = '{{지역}} {{단지명}} {{우선키워드}} {{하부키워드}}';

  let order = [], phrases = [], serial = 0;
  const getIds = () => {
    const ids = ['region','name'], found = new Set();
    selectedKeywords().forEach(t => {
      if (!found.has(t)) {found.add(t); ids.push('p:'+t);}
    });
    const checks = [...document.querySelectorAll('#secondaryKeywords input:checked')].map(x=>x.value);
    const extras = $('secondaryAdditional').value.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean);
    [...checks,...extras].forEach(t => {
      if (!found.has(t)) {found.add(t); ids.push('s:'+t);}
    });
    phrases.forEach(p => ids.push('note:'+p.id));
    return ids;
  };
  const label = key => {
    if (key === 'region') return '지역';
    if (key === 'name') return '단지명';
    if (key.startsWith('note:')) {
      const match=phrases.find(p=>'note:'+p.id===key);
      return match?.text || '설명 문구';
    }
    return key.slice(2);
  };
  function sync() {
    const all = getIds(), valid = new Set(all);
    order = [...new Set([...order.filter(x=>valid.has(x)),...all])];
  }
  function itemText(key,row) {
    if (key === 'region') return row?.region || $('regions').value.split(/[,，\n]/)[0].trim() || '지역';
    if (key === 'name') return row?.name || '○○아파트';
    if (key.startsWith('note:')) return phrases.find(p=>'note:'+p.id===key)?.text?.trim() || '';
    return key.slice(2);
  }
  function titleFor(row) {
    return order.map(key => itemText(key,row)).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  }
  function preview() {
    const row = (typeof uniqueMatches !== 'undefined' && uniqueMatches.length) ? uniqueMatches[0] : null;
    const text = titleFor(row), n=[...text].length, max=intOrNull($('maxTitle').value)||85;
    const target=$('tm-example');target.textContent='';
    const head=document.createElement('strong');
    head.textContent='제목 미리보기 ('+n+'자)';
    const example=document.createElement('div');
    example.style.marginTop='5px';example.textContent=text;
    target.append(head, example);
    if(n>max){
      const warning=document.createElement('div');
      warning.style.color='#a23a29';
      warning.textContent='설정한 '+max+'자 제한 초과 · 선택한 키워드나 문구는 자동 삭제하지 않습니다.';
      target.append(warning);
    }
  }
  function save() {
    try {
      localStorage.setItem('timo-title-order-v2',JSON.stringify({
        titleOrder:[...order],customDescriptions:phrases.map(p=>({...p}))
      }));
    } catch {}
  }
  function moveLeftRight(key,delta) {
    const i=order.indexOf(key), j=i+delta;
    if(i<0 || j<0 || j>=order.length)return;
    [order[i],order[j]]=[order[j],order[i]];
    render();
  }
  function dropBefore(source,target) {
    if(source===target||!order.includes(source)||!order.includes(target))return;
    const from=order.indexOf(source);
    let to=order.indexOf(target);
    order.splice(from,1);
    if(from<to)to--;
    order.splice(to,0,source);
    render();
  }
  function renderChips() {
    const root=$('tm-chips');root.textContent='';
    order.forEach((key,index)=>{
      const chip=document.createElement('div');
      chip.className='tm-chip '+(key.startsWith('p:')?'tm-priority':key.startsWith('s:')?'tm-secondary':key.startsWith('note:')?'tm-note':'');
      chip.draggable=true;chip.setAttribute('role','listitem');
      chip.title='드래그로 위치 변경: '+label(key);
      const grip=document.createElement('span');grip.className='tm-grip';grip.textContent='⠿';
      const name=document.createElement('span');name.className='tm-chip-label';name.textContent=label(key);
      chip.append(grip,name);
      for(const [glyph,delta] of [['◀',-1],['▶',1]]){
        const button=document.createElement('button');
        button.type='button';button.className='tm-step';button.textContent=glyph;
        button.disabled=(index+delta<0||index+delta>=order.length);
        button.setAttribute('aria-label',label(key)+' '+(delta<0?'왼쪽':'오른쪽')+' 이동');
        button.addEventListener('click',()=>moveLeftRight(key,delta));
        chip.append(button);
      }
      chip.addEventListener('dragstart',event=>{
        event.dataTransfer.setData('text/plain',key);
        event.dataTransfer.effectAllowed='move';
      });
      chip.addEventListener('dragover',event=>{
        event.preventDefault();event.dataTransfer.dropEffect='move';chip.classList.add('tm-over');
      });
      chip.addEventListener('dragleave',()=>chip.classList.remove('tm-over'));
      chip.addEventListener('drop',event=>{
        event.preventDefault();chip.classList.remove('tm-over');
        dropBefore(event.dataTransfer.getData('text/plain'),key);
      });
      root.append(chip);
    });
  }
  function renderPhrases() {
    const root=$('tm-phrases');root.textContent='';
    phrases.forEach((p,index)=>{
      const row=document.createElement('div');row.className='tm-phrase-row';
      const input=document.createElement('input');
      input.type='text';input.maxLength=100;input.value=p.text;
      input.setAttribute('aria-label','설명 문구 '+(index+1));
      input.addEventListener('input',()=>{
        p.text=input.value;
        renderChips();preview();save();
      });
      const remove=document.createElement('button');
      remove.type='button';remove.className='tm-remove';remove.textContent='삭제';
      remove.setAttribute('aria-label','설명 문구 '+(index+1)+' 삭제');
      remove.addEventListener('click',()=>{
        phrases=phrases.filter(x=>x.id!==p.id);
        render();
      });
      row.append(input,remove);root.append(row);
    });
  }
  function render(){
    sync();renderChips();renderPhrases();preview();save();
  }
  function addPhrase(){
    const input=$('tm-new-phrase'),value=input.value.trim().replace(/\s+/g,' ');
    if(!value){input.focus();return;}
    if(phrases.some(p=>p.text===value)){input.focus();return;}
    phrases.push({id:'n'+(++serial),text:value});
    input.value='';render();input.focus();
  }
  $('tm-add-phrase').addEventListener('click',addPhrase);
  $('tm-new-phrase').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addPhrase();}});

  function restore(data) {
    if(!data || typeof data!=='object')return;
    const incoming=Array.isArray(data.customDescriptions)?data.customDescriptions:[];
    phrases=incoming.filter(p=>p && /^[a-zA-Z0-9_-]+$/.test(p.id) && typeof p.text==='string' && p.text.trim())
      .slice(0,100).map(p=>({id:p.id,text:p.text.slice(0,100)}));
    // Migrate the optional single description introduced in 0.2.4.
    if(!phrases.length && data.descriptionEnabled && typeof data.descriptionText==='string' && data.descriptionText.trim()){
      phrases=[{id:'legacy',text:data.descriptionText.trim().slice(0,100)}];
    }
    const numbers=phrases.map(p=>/^n\d+$/.test(p.id)?Number(p.id.slice(1)):0);
    serial=Math.max(0,...numbers);
    order=Array.isArray(data.titleOrder)?data.titleOrder.filter(k=>typeof k==='string'):[];
    order=order.map(k=>k==='desc'&&phrases.some(p=>p.id==='legacy')?'note:legacy':k);
    render();
  }
  let initial=null;
  try{
    const fresh=localStorage.getItem('timo-title-order-v2');
    const old=localStorage.getItem('timo-title-order-v1');
    const shared=localStorage.getItem('timo-title-generator-v1');
    initial=fresh?JSON.parse(fresh):(old?JSON.parse(old):shared?JSON.parse(shared):null);
    if(initial && !fresh && old && initial.order && !initial.titleOrder) {
      initial={
        titleOrder:initial.order,
        descriptionEnabled:initial.descriptionEnabled,
        descriptionText:initial.descriptionText
      };
    }
  }catch{}
  if(initial)restore(initial);else render();

  const oldSettings=settings;
  settings=()=>({
    ...oldSettings(),
    titleOrder:[...order],
    customDescriptions:phrases.map(p=>({...p})),
    // Legacy fields kept for compatibility when old settings are reloaded.
    descriptionEnabled:phrases.length>0,
    descriptionText:phrases[0]?.text||''
  });
  const oldApply=applySettings;
  applySettings=(data)=>{oldApply(data);restore(data);};

  const originalBuild=buildTitles;
  buildTitles=function(){
    sync();
    const result=originalBuild();
    const limit=intOrNull($('maxTitle').value)||85;
    result.titles=result.titles.map(item=>{
      const title=titleFor(item);
      return {...item,title,titleOver:[...title].length>limit};
    });
    const audit=$('filterAudit');
    if(audit) {
      const long=result.titles.filter(x=>x.titleOver).length;
      audit.textContent=audit.textContent.replace(/\n블록 순서 적용:.*$/s,'')
        +'\n블록 순서 적용: '+numfmt(result.titles.length)+'개 제목 · '+phrases.length
        +'개 설명 문구 · 길이 초과 '+numfmt(long)+'개 (자동 삭제 없음)';
    }
    // Publish selected primary/secondary keywords and region-level districts
    // to the outer extension page. Only summary settings, never CSV rows.
    try{
      const priority=selectedKeywords();
      const selected=[...document.querySelectorAll('#secondaryKeywords input:checked')].map(el=>el.value);
      const extras=$('secondaryAdditional').value.split(/[,，\n]/).map(s=>s.trim()).filter(Boolean);
      const keywords=[...new Set([...priority,...selected,...extras])];
      // Preserve the exact deployment-region filter used for this generation.
      const selectedRegions=[...new Set($('regions').value.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean))];
      const districts=new Set();
      const knownRegions=new Set(['서울특별시','부산광역시','대구광역시','인천광역시','광주광역시','대전광역시','울산광역시','세종특별자치시','경기도','강원특별자치도','강원도','충청북도','충청남도','전북특별자치도','전라북도','전라남도','경상북도','경상남도','제주특별자치도']);
      for(const row of result.matches||[]){
        const loc=String(row.addr||'');
        const parts=loc.split(/\s+/).map(s=>s.trim()).filter(Boolean);
        for(const token of parts.slice(0,4)){
          if(knownRegions.has(token))continue;
          if(/^[가-힣]{1,10}(?:시|군|구)$/.test(token))districts.add(token);
        }
      }
      // Count physical complexes, not generated title variants. Use the same
      // ID / normalized address+name identity as the title generator.
      const complexKeys=new Set();
      for(const item of result.matches||[]){
        const id=String(item.id||'').trim();
        const key=id?'id:'+id:
          'place:'+String(item.addr||'').trim().replace(/\s+/g,' ').toLowerCase()+
          '|'+String(item.name||'').trim().replace(/\s+/g,' ').toLowerCase();
        if(item.name&&item.addr)complexKeys.add(key);
      }
      const uniqueComplexCount=complexKeys.size;
      window.parent.postMessage({type:'TIMO_TITLE_CONTEXT_V1',
        keywords,regions:selectedRegions,districts:[...districts].slice(0,100),
        titlesCount:result.titles.length,
        uniqueComplexCount},'*');
    }catch(e){console.warn('TIMO title sync failed:',e.message);}
    preview();
    return result;
  };

  for(const id of ['keywords','secondaryKeywords'])$(id).addEventListener('change',render);
  for(const id of ['additional','secondaryAdditional','regions','maxTitle'])$(id).addEventListener('input',render);
  $('makeBtn').addEventListener('click',()=>setTimeout(preview,100));
  const footer=document.querySelector('.foot');
  if(footer)footer.textContent='제목 생성기 0.2.5 · 설명 문구 여러 개 추가·편집·삭제·드래그 정렬 · 기본 자동 문구 없음';
})();