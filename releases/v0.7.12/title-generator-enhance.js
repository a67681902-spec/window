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

  // v0.2.2: correct official Korean real-estate CSV column choices.
  const oldMakeMappings = makeMappings;
  makeMappings = function () {
    oldMakeMappings();
    const exact = h => csvHeaders.findIndex(x => norm(x) === norm(h));
    const addressId = exact('주소');
    // Official file has both 주소 and 도로명주소. The former is the complete
    // legal-dong address and should drive region filters.
    if (addressId >= 0) el('colAddr').value=String(addressId);
    const nameCandidates=['단지명_공시가격','단지명_건축물대장','단지명_도로명주소','단지명','공동주택명','아파트명'];
    const nameIndex=nameCandidates.map(n=>exact(n)).find(i=>i>=0&&rawRows.some(row=>String(row[i]??'').trim()));
    if(nameIndex!==undefined)el('colName').value=String(nameIndex);
    const typeId=exact('단지종류');
    if(typeId>=0) el('colType').value=String(typeId);
    const yearId=exact('사용승인일');
    if(yearId>=0)el('colYear').value=String(yearId);
    const unitsId=exact('세대수');
    if(unitsId>=0)el('colUnits').value=String(unitsId);
    const regionId=exact('시도');
    if(regionId>=0)el('colRegion').value=String(regionId);
    status('loadStatus','CSV '+numfmt(rawRows.length)+'행 연결 완료. 지역은 법정동 주소와 도로명주소를 함께 검사합니다. 열 연결값도 확인하세요.','good');
  };
  // These are explicit user defaults, not constraints.
  for(const [id,v] of [['yearFrom','1991'],['yearTo','2008'],['unitsFrom','20'],['unitsTo','5000']])el(id).value=v;
  const auditExtra=d.createElement('p');
  auditExtra.className='hint';
  auditExtra.textContent='CSV 주소열이 여러 개이면 법정동 주소와 도로명주소를 모두 사용해 지역을 판별합니다. 실제 추출 수는 원본 데이터 품질에 따라 달라집니다.';
  audit.after(auditExtra);
  // v0.7.0: basic living-area selector. Direct text input remains available.
  const regionInput=el('regions');
  if(regionInput){
    const migrationKey='timo-region-default-daegu-cleared-v075';
    const explicitKey='timo-region-user-explicit-v1';
    const isOnlyDaegu=value=>{
      const tokens=String(value||'').split(/[,，\n]/).map(x=>x.trim()).filter(Boolean);
      return tokens.length===1&&/^(대구|대구광역시)$/.test(tokens[0]);
    };
    const clearLegacyDaegu=()=>{
      let explicit=false;
      try{explicit=localStorage.getItem(explicitKey)==='1';}catch{}
      if(explicit)return false;
      let changed=false;
      if(isOnlyDaegu(regionInput.value)){
        regionInput.value='';
        regionInput.dispatchEvent(new Event('input',{bubbles:true}));
        regionInput.dispatchEvent(new Event('change',{bubbles:true}));
        changed=true;
      }
      try{
        const raw=localStorage.getItem('timo-title-generator-v1');
        if(raw){
          const saved=JSON.parse(raw);
          let dirty=false;
          for(const key of ['regions','region','deploymentRegion']){
            if(typeof saved?.[key]==='string'&&isOnlyDaegu(saved[key])){saved[key]='';dirty=true;}
            else if(Array.isArray(saved?.[key])&&saved[key].length===1&&isOnlyDaegu(saved[key][0])){saved[key]=[];dirty=true;}
          }
          if(dirty){localStorage.setItem('timo-title-generator-v1',JSON.stringify(saved));changed=true;}
        }
        localStorage.setItem(migrationKey,'1');
      }catch{}
      return changed;
    };
    // The base generator and later enhancement scripts can restore saved values
    // asynchronously. Recheck after each initial loading stage.
    clearLegacyDaegu();
    for(const delay of [80,300,800,1600])setTimeout(clearLegacyDaegu,delay);
    regionInput.addEventListener('input',event=>{
      if(!event.isTrusted)return;
      try{localStorage.setItem(explicitKey,'1');}catch{}
    });
  }
  const LIVING_ZONES={
    '경기':[
      ['수원·화성·오산권','약 248만',['경기 수원','경기 화성','경기 오산']],
      ['성남·광주·하남권','약 166만',['경기 성남','경기 광주','경기 하남']],
      ['안양·군포·의왕·과천권','약 106만',['경기 안양','경기 군포','경기 의왕','경기 과천']],
      ['안산·시흥·광명권','약 142만',['경기 안산','경기 시흥','경기 광명']],
      ['부천·김포권','약 128만',['경기 부천','경기 김포']],
      ['평택·안성권','약 79만',['경기 평택','경기 안성']],
      ['이천·여주·양평권','약 47만',['경기 이천','경기 여주','경기 양평']],
      ['고양·파주권','약 159만',['경기 고양','경기 파주']],
      ['구리·남양주·가평권','약 99만',['경기 구리','경기 남양주','경기 가평']],
      ['의정부·양주·동두천·포천·연천권','약 102만',['경기 의정부','경기 양주','경기 동두천','경기 포천','경기 연천']],
      ['용인권','약 111만',['경기 용인']]
    ],
    '강원':[
      ['춘천권','약 47만',['강원 춘천','강원 홍천','강원 화천','강원 양구','강원 철원','강원 인제']],
      ['원주권','약 41만',['강원 원주','강원 횡성']],
      ['영월·평창·정선권','약 11만',['강원 영월','강원 평창','강원 정선']],
      ['강릉·동해·삼척·태백권','약 40만',['강원 강릉','강원 동해','강원 삼척','강원 태백']],
      ['속초·양양·고성권','약 14만',['강원 속초','강원 양양','강원 고성']]
    ],
    '충북':[
      ['청주권','약 85만',['충북 청주']],
      ['충북 북부권','약 37만',['충북 충주','충북 제천','충북 단양']],
      ['중부4군권','약 26만',['충북 증평','충북 진천','충북 괴산','충북 음성']],
      ['남부3군권','약 13만',['충북 보은','충북 옥천','충북 영동']]
    ],
    '충남':[
      ['천안·아산권','약 106만',['충남 천안','충남 아산']],
      ['서산·당진·태안권','약 41만',['충남 서산','충남 당진','충남 태안']],
      ['보령·부여·서천권','약 21만',['충남 보령','충남 부여','충남 서천']],
      ['홍성·예산·청양권','약 21만',['충남 홍성','충남 예산','충남 청양']],
      ['공주권','약 10만',['충남 공주']],
      ['논산·계룡·금산권','약 21만',['충남 논산','충남 계룡','충남 금산']]
    ],
    '전북':[
      ['전주·완주권','약 74만',['전북 전주','전북 완주']],
      ['군산·익산권','약 53만',['전북 군산','전북 익산']],
      ['김제·부안권','약 13만',['전북 김제','전북 부안']],
      ['정읍·고창권','약 15만',['전북 정읍','전북 고창']],
      ['남원·임실·순창권','약 13만',['전북 남원','전북 임실','전북 순창']],
      ['진안·무주·장수권','약 7만',['전북 진안','전북 무주','전북 장수']]
    ],
    '전남':[
      ['목포·무안·신안권','약 34만',['전남 목포','전남 무안','전남 신안']],
      ['영광·함평·장성권','약 13만',['전남 영광','전남 함평','전남 장성']],
      ['나주·담양·화순권','약 22만',['전남 나주','전남 담양','전남 화순']],
      ['해남·영암·강진·장흥권','약 19만',['전남 해남','전남 영암','전남 강진','전남 장흥']],
      ['완도·진도권','약 7만',['전남 완도','전남 진도']],
      ['여수·순천·광양권','약 70만',['전남 여수','전남 순천','전남 광양']],
      ['곡성·구례권','약 5만',['전남 곡성','전남 구례']],
      ['보성·고흥권','약 10만',['전남 보성','전남 고흥']]
    ],
    '경북':[
      ['포항·경주권','약 74만',['경북 포항','경북 경주']],
      ['구미·김천·칠곡권','약 66만',['경북 구미','경북 김천','경북 칠곡']],
      ['경산·영천·청도권','약 41만',['경북 경산','경북 영천','경북 청도']],
      ['안동·예천·의성권','약 25만',['경북 안동','경북 예천','경북 의성']],
      ['청송·영양권','약 4만',['경북 청송','경북 영양']],
      ['영주·봉화권','약 13만',['경북 영주','경북 봉화']],
      ['상주·문경권','약 16만',['경북 상주','경북 문경']],
      ['영덕·울진·울릉권','약 9만',['경북 영덕','경북 울진','경북 울릉']],
      ['성주·고령권','약 7만',['경북 성주','경북 고령']]
    ],
    '경남':[
      ['창원권','약 46만',['경남 창원']],
      ['마산권','약 35만',['경남 마산']],
      ['진해권','약 19만',['경남 진해']],
      ['김해·양산권','약 90만',['경남 김해','경남 양산']],
      ['진주·사천권','약 45만',['경남 진주','경남 사천']],
      ['남해·하동권','약 8만',['경남 남해','경남 하동']],
      ['거제·통영·고성권','약 40만',['경남 거제','경남 통영','경남 고성']],
      ['밀양·창녕권','약 16만',['경남 밀양','경남 창녕']],
      ['함안·의령권','약 9만',['경남 함안','경남 의령']],
      ['거창·함양·합천·산청권','약 17만',['경남 거창','경남 함양','경남 합천','경남 산청']]
    ],
    '제주':[
      ['제주권','약 49만',['제주 제주시']],
      ['서귀포권','약 18만',['제주 서귀포']]
    ]
  };
  if(regionInput){
    el('regionPresetBar')?.remove();
    const box=d.createElement('div');box.id='livingZonePanel';box.style.cssText='margin-top:10px;border:1px solid #d8e3f5;border-radius:10px;background:#fbfdff;padding:10px';
    const head=d.createElement('div');head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap';
    const title=d.createElement('strong');title.textContent='기본 생활권 빠른 선택';title.style.cssText='font-size:12px;color:#31507f';
    const clear=d.createElement('button');clear.type='button';clear.textContent='배포지역 비우기';clear.style.cssText='border:1px solid #d6ddeb;background:#fff;border-radius:7px;padding:5px 8px;font-size:11px;color:#64748b;cursor:pointer';
    head.append(title,clear);
    const tabs=d.createElement('div');tabs.style.cssText='display:flex;gap:5px;flex-wrap:wrap;margin-top:8px';
    const zones=d.createElement('div');zones.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:7px;margin-top:9px';
    const note=d.createElement('div');note.textContent='여러 생활권을 함께 선택할 수 있습니다. 직접 입력도 가능합니다. 인구는 최근 주민등록인구를 만 단위로 반올림한 참고값입니다.';note.style.cssText='margin-top:8px;font-size:10px;line-height:1.5;color:#7b879d';
    box.append(head,tabs,zones,note);regionInput.parentElement.append(box);
    let activeProvince=Object.keys(LIVING_ZONES).includes(localStorage.getItem('timo-living-zone-tab'))?localStorage.getItem('timo-living-zone-tab'):'경북';
    const splitRegions=()=>regionInput.value.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean);
    const setRegions=list=>{regionInput.value=[...new Set(list)].join(', ');regionInput.dispatchEvent(new Event('input',{bubbles:true}));regionInput.dispatchEvent(new Event('change',{bubbles:true}));renderZones();};
    function renderZones(){
      tabs.textContent='';zones.textContent='';
      for(const province of Object.keys(LIVING_ZONES)){
        const b=d.createElement('button');b.type='button';b.textContent=province;b.style.cssText='border:1px solid '+(province===activeProvince?'#2b58d9':'#ced9ec')+';background:'+(province===activeProvince?'#2b58d9':'#f3f6fc')+';color:'+(province===activeProvince?'#fff':'#476089')+';border-radius:7px;padding:6px 9px;font:700 11px system-ui;cursor:pointer';
        b.onclick=()=>{activeProvince=province;try{localStorage.setItem('timo-living-zone-tab',province)}catch{}renderZones();};tabs.append(b);
      }
      const current=splitRegions(),currentSet=new Set(current);
      for(const zone of LIVING_ZONES[activeProvince]){
        const [name,pop,members]=zone,selected=members.every(x=>currentSet.has(x));
        const b=d.createElement('button');b.type='button';b.title=members.join(', ');b.style.cssText='text-align:left;border:1px solid '+(selected?'#2b58d9':'#d6e0f0')+';background:'+(selected?'#edf3ff':'#fff')+';border-radius:9px;padding:8px 9px;cursor:pointer;color:#304b75';
        const n=d.createElement('div');n.textContent=name;n.style.cssText='font:700 12px system-ui,"Malgun Gothic",sans-serif';
        const p=d.createElement('div');p.textContent=pop;p.style.cssText='font:10px system-ui;color:#8290a7;margin-top:3px';
        b.append(n,p);b.onclick=()=>{const set=new Set(splitRegions()),all=members.every(x=>set.has(x));for(const member of members){if(all)set.delete(member);else set.add(member);}setRegions([...set]);};zones.append(b);
      }
    }
    clear.onclick=()=>setRegions([]);
    regionInput.addEventListener('input',()=>{clearTimeout(regionInput._livingTimer);regionInput._livingTimer=setTimeout(renderZones,80);});
    renderZones();
  }
    const allAddressIndices=()=>csvHeaders.map((h,i)=>(['주소','도로명주소','법정동주소','지번주소','단지주소','시도','시군구','시군구명','지역'].includes(norm(h)))?i:-1).filter(i=>i>=0);
  const allNameIndices=()=>csvHeaders.map((h,i)=>(/^(단지명|공동주택명|아파트명)/.test(norm(h)))?i:-1).filter(i=>i>=0);
  // v0.7.0: province-scoped living zones + city/district aliases.
  const REGION_GROUPS={
    '충북소도시':['충주시','제천시','보은군','옥천군','영동군','증평군','진천군','괴산군','음성군','단양군'],
    '충남소도시':['공주시','보령시','서산시','논산시','계룡시','당진시','금산군','부여군','서천군','청양군','홍성군','예산군','태안군']
  };
  const PROVINCE_ALIASES={
    '경기':['경기','경기도'],'강원':['강원','강원도','강원특별자치도'],'충북':['충북','충청북도'],'충남':['충남','충청남도'],
    '전북':['전북','전라북도','전북특별자치도'],'전남':['전남','전라남도'],'경북':['경북','경상북도'],'경남':['경남','경상남도'],
    '제주':['제주','제주도','제주특별자치도']
  };
  const regionParts=location=>String(location||'').split(/[\s,]+/).map(x=>x.trim()).filter(Boolean);
  const provinceKey=word=>{const v=String(word||'').trim();for(const [key,vals] of Object.entries(PROVINCE_ALIASES))if(vals.includes(v))return key;return '';};
  const locationAliases=location=>{const words=regionParts(location),out=new Set();const metro=words.find(w=>/(특별시|광역시|특별자치시)$/.test(w));const local=words.find(w=>/(시|군)$/.test(w)&&!/(특별시|광역시|특별자치시)$/.test(w));const city=local||metro||'';const district=words.find(w=>/구$/.test(w)&&w!==city)||'';const stem=city.replace(/(특별자치시|특별시|광역시|시|군)$/,'');[city,stem,district].filter(Boolean).forEach(v=>out.add(norm(v)));if(city&&district){out.add(norm(city+district));if(stem)out.add(norm(stem+district));}return out;};
  const smartMatchesRegion=(location,tokens)=>{
    const a=norm(location),aliases=locationAliases(location);
    const matchLocal=(local,display)=>{
      const t=norm(local);
      if(t==='창원'||t==='창원시'){if(a.includes(norm('창원시 의창구'))||a.includes(norm('창원시 성산구')))return '창원';return '';}
      if(t==='마산'){if(a.includes(norm('창원시 마산합포구'))||a.includes(norm('창원시 마산회원구')))return '마산';return '';}
      if(t==='진해'){if(a.includes(norm('창원시 진해구')))return '진해';return '';}
      if(t==='통합창원'||t==='창원전체'){if(a.includes(norm('창원시')))return '창원';return '';}
      if(aliases.has(t))return display||local;
      if(regionVariants(local).some(x=>a.includes(x)))return display||local;
      return '';
    };
    for(const raw of tokens){
      const token=String(raw||'').trim(),t=norm(token),parts=regionParts(token),group=REGION_GROUPS[t];
      if(group){const hit=group.find(x=>aliases.has(norm(x))||a.includes(norm(x)));if(hit)return hit.replace(/[시군]$/,'');continue;}
      const pkey=parts.length>1?provinceKey(parts[0]):'';
      if(pkey){
        if(!PROVINCE_ALIASES[pkey].some(x=>a.includes(norm(x))))continue;
        const local=parts.slice(1).join(' '),hit=matchLocal(local,local.replace(/(특별자치시|특별시|광역시|시|군)$/,''));
        if(hit)return hit;continue;
      }
      const hit=matchLocal(token,token);if(hit)return hit;
    }
    return '';
  };
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
    const addressCols=allAddressIndices(),nameCols=allNameIndices();
    for(const row of rawRows){
      const findFirst=(indices)=>indices.map(i=>String(row[i]??'').trim()).find(Boolean)||'';
      const name=value(row,'colName')||findFirst(nameCols);
      const addr=value(row,'colAddr')||findFirst(addressCols);
      if(!name||!addr){missing.missingName++;continue;}
      const location=[value(row,'colRegion'),addr,...addressCols.map(i=>row[i]??'')].join(' ');
      const region=regions.length?smartMatchesRegion(location,regions):'';
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
    if(matches.length<20&&rawRows.length>=1000)warnings.push('추출 단지가 적습니다. 열 연결 또는 데이터 원본을 확인하세요.');
    if(repeated)warnings.push('중복된 제목 '+numfmt(repeated)+'개. 템플릿 및 단지명을 확인하세요.');
    if(tooLong)warnings.push('글자 제한 초과 '+numfmt(tooLong)+'개. 키워드는 삭제하지 않았습니다.');
    audit.textContent=[...lines,...warnings].join('\n');
    audit.className=warnings.length?'status err':'status good';
    return{matches,titles,...missing};
  };
  const footer=d.querySelector('.foot');
  if(footer)footer.textContent='제목 생성기 0.2.2 · 주소 열 교차검사 · 모든 키워드 포함 · 검색 순위 보장 없음.';
})();
