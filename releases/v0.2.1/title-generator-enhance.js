'use strict';
(() => {
  const d=document, el=id=>d.getElementById(id);
  if(el('secondaryKeywords'))return;
  const panel=d.createElement('div');
  panel.style.cssText='background:#f5f8ff;border:1px solid #d9e4fb;border-radius:10px;padding:14px;margin-top:15px';
  panel.innerHTML='<label>하부노출 키워드 (모든 제목에 포함)</label><div class="inline" id="secondaryKeywords"></div><div style="margin-top:10px"><label for="secondaryAdditional">하부노출 추가 키워드 (쉼표 구분)</label><input type="text" id="secondaryAdditional" placeholder="예: 대구샷시, 대구그린리모델링"></div><p class="hint">우선노출 + 하부노출 키워드를 모두 제목에 넣습니다. 길면 경고하지만 키워드는 삭제하지 않습니다.</p>';
  const first=el('keywords').parentElement;
  first.after(panel);
  for(const word of ['샷시견적','샤시견적','창호견적','베란다샷시','샷시비용','단열창호']){
    const label=d.createElement('label'),input=d.createElement('input');
    label.className='check';input.type='checkbox';input.value=word;
    label.append(input,d.createTextNode(' '+word));el('secondaryKeywords').append(label);
  }
  const mainLabel=first.querySelector('label');
  if(mainLabel)mainLabel.textContent='우선노출 키워드 (모든 제목에 포함)';
  const extraLabel=d.querySelector('label[for="additional"]');
  if(extraLabel)extraLabel.textContent='우선노출 추가 키워드 (쉼표 구분)';
  el('mode').options[0].text='단지당 제목 1개 (모든 키워드 포함)';
  el('mode').options[1].text='우선키워드별 문구 변형 (매 제목에 전체 포함)';
  const originalTemplate='{{지역}} {{단지명}} {{키워드}} {{설명}}';
  if(!el('template').value.trim()||el('template').value.trim()===originalTemplate)
    el('template').value='{{지역}} {{단지명}} {{우선키워드}} {{하부키워드}} {{설명}}';
  const hint=el('template').nextElementSibling;
  if(hint)hint.textContent='{{지역}} {{단지명}} {{우선키워드}} {{하부키워드}} {{키워드}}(모두) {{설명}} {{연도}} {{세대수}} 사용 가능. 템플릿에서 빠진 선택 키워드도 자동 추가됩니다.';
  const audit=d.createElement('div');
  audit.className='status';audit.id='filterAudit';
  audit.textContent='생성하면 CSV 전체 → 지역 → 아파트 유형 → 연도 → 세대수 → 중복 제거 건수가 나타납니다.';
  el('generateStatus').after(audit);
  const note=d.createElement('p');note.className='note';
  note.textContent='기존 배포 제목 672건과 현재 CSV 조건에 맞는 고유 단지 수는 서로 다른 기준입니다.';
  el('previewInfo').after(note);
  const secWords=()=>{
    const checked=[...d.querySelectorAll('#secondaryKeywords input:checked')].map(e=>e.value);
    const extra=el('secondaryAdditional').value.split(/[,，\n]/).map(t=>t.trim()).filter(Boolean);
    return [...new Set([...checked,...extra])];
  };
  const requireWords=(title,words)=>{
    const found=title.split(/[\s,·/|]+/);
    const missing=words.filter(w=>!found.includes(w));
    return missing.length?title+' '+missing.join(' '):title;
  };
  const oldSettings=settings;
  settings=()=>({...oldSettings(),version:2,secondaryKeywords:secWords(),secondaryExtra:el('secondaryAdditional').value});
  const oldApply=applySettings;
  applySettings=(data)=>{
    oldApply(data);
    const saved=Array.isArray(data.secondaryKeywords)?data.secondaryKeywords:[];
    for(const item of d.querySelectorAll('#secondaryKeywords input'))item.checked=saved.includes(item.value);
    if(data.secondaryExtra!==undefined)el('secondaryAdditional').value=data.secondaryExtra;
  };
  try{const s=localStorage.getItem('timo-title-generator-v1');if(s)applySettings(JSON.parse(s))}catch{}
  el('csvInput').addEventListener('change',()=>{
    audit.textContent='CSV가 변경됐습니다. 다시 생성하면 단계별 통과 수를 확인합니다.';
    audit.className='status';
  });
  buildTitles=function(){
    if(!rawRows.length)throw Error('CSV를 먼저 불러오세요.');
    if(getCol('colName')<0||getCol('colAddr')<0)throw Error('단지명·주소 열 연결을 확인하세요.');
    const priority=selectedKeywords(),secondary=secWords();
    const all=[...new Set([...priority,...secondary])];
    if(!all.length)throw Error('우선노출 또는 하부노출 키워드를 선택하세요.');
    const y0=intOrNull(el('yearFrom').value),y1=intOrNull(el('yearTo').value);
    const u0=intOrNull(el('unitsFrom').value),u1=intOrNull(el('unitsTo').value);
    validateRange(y0,y1,'연도');validateRange(u0,u1,'세대수');
    if((y0!==null||y1!==null)&&getCol('colYear')<0)throw Error('사용승인일 열을 연결하세요.');
    if((u0!==null||u1!==null)&&getCol('colUnits')<0)throw Error('세대수 열을 연결하세요.');
    if(el('aptOnly').checked&&getCol('colType')<0)throw Error('단지종류 열을 연결하세요.');
    const regions=el('regions').value.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean);
    const counts={region:0,type:0,year:0,units:0},missing={missingName:0,missingYear:0,missingUnits:0};
    const matches=[], seen=new Set();
    for(const row of rawRows){
      const name=value(row,'colName'),addr=value(row,'colAddr');
      if(!name||!addr){missing.missingName++;continue;}
      const location=value(row,'colRegion')+' '+addr;
      const region=regions.length?matchesRegion(location,regions):'';
      if(regions.length&&!region)continue;
      counts.region++;
      if(el('aptOnly').checked){
        const typ=norm(value(row,'colType'));
        if(typ!=='1'&&typ!=='아파트')continue;
      }
      counts.type++;
      const year=yearOrNull(value(row,'colYear'));
      if(y0!==null||y1!==null){
        if(year===null){missing.missingYear++;continue;}
        if((y0!==null&&year<y0)||(y1!==null&&year>y1))continue;
      }
      counts.year++;
      const units=intOrNull(value(row,'colUnits'));
      if(u0!==null||u1!==null){
        if(units===null){missing.missingUnits++;continue;}
        if((u0!==null&&units<u0)||(u1!==null&&units>u1))continue;
      }
      counts.units++;
      const id=value(row,'colId');
      const key=id?'id:'+id:'place:'+norm(addr)+'|'+norm(name);
      if(el('dedupe').checked){if(seen.has(key))continue;seen.add(key);}
      matches.push({id,name,addr,region:region||cityName(location),year,units});
    }
    const template=el('template').value.trim();
    if(!template.includes('{{단지명}}'))throw Error('제목 템플릿에 {{단지명}}이 필요합니다.');
    const limit=intOrNull(el('maxTitle').value)||85;
    const texts=new Set(),titles=[];let repeated=0;
    for(const a of matches){
      const focus=el('mode').value==='all'?(priority.length?priority:[all[0]]):[priority[0]||all[0]];
      for(const topic of focus){
        const info={지역:a.region,단지명:a.name,우선키워드:priority.join(' '),하부키워드:secondary.join(' '),키워드:all.join(' '),설명:textDesc(topic),연도:a.year??'',세대수:a.units??''};
        const generated=template.replace(/{{\s*(지역|단지명|우선키워드|하부키워드|키워드|설명|연도|세대수)\s*}}/g,(_,word)=>String(info[word]??'')).replace(/\s+/g,' ').trim();
        const title=requireWords(generated,all);
        if(texts.has(title))repeated++;
        texts.add(title);
        titles.push({...a,keyword:topic,title,titleOver:[...title].length>limit});
      }
    }
    const tooLong=titles.filter(t=>t.titleOver).length;
    const lines=[
      '단계별 통과: 전체 CSV '+numfmt(rawRows.length)+'행 → 지역 일치 '+numfmt(counts.region)+' → 아파트 유형 '+numfmt(counts.type)+' → 연도 조건 '+numfmt(counts.year)+' → 세대수 조건 '+numfmt(counts.units)+' → 중복 제거 후 '+numfmt(matches.length)+'단지',
      '생성 제목 '+numfmt(titles.length)+'개 · 이름/주소 누락 '+numfmt(missing.missingName)+' · 연도 누락 '+numfmt(missing.missingYear)+' · 세대수 누락 '+numfmt(missing.missingUnits)
    ];
    const warnings=[];
    if(matches.length<20&&rawRows.length>=1000)warnings.push('추출 단지가 적습니다. 단지종류·사용승인일·세대수 열 연결을 확인하세요.');
    if(repeated)warnings.push('중복된 제목 '+numfmt(repeated)+'개. 템플릿 및 단지명을 확인하세요.');
    if(tooLong)warnings.push('글자 제한 초과 '+numfmt(tooLong)+'개. 키워드는 삭제하지 않았습니다.');
    audit.textContent=[...lines,...warnings].join('\n');
    audit.className=warnings.length?'status err':'status good';
    return{matches,titles,...missing};
  };
  const footer=d.querySelector('.foot');
  if(footer)footer.textContent='제목 생성기 0.2.1 · 모든 키워드 포함 및 추출 단계별 검사 · 검색 노출 순위는 보장되지 않습니다.';
})();
