'use strict';
// TIMO 0.7.37 - verified population import, city/county batch campaign queue.
// Runs only on the visible extension setup page. It creates and starts
// only the exact newly-identified TiMO campaign, never unrelated rows.
(()=>{
const $=id=>document.getElementById(id);
if(!$('timoBatchPanel'))return;
const KEY='timoRegionBatchHistoryV1',POPKEY='timoPopulationImportV1',BODYKEY='timoRegionBodyConfigV1';
const OFFICE_URLS={
 '본사':'https://m.place.naver.com/place/1092585417/home',
 '전북지사':'https://m.place.naver.com/place/1733954252/home',
 '전남지사':'https://m.place.naver.com/place/1703575111/home',
 '경남지사':'https://m.place.naver.com/place/1143478244/home',
 '경기지사':'https://m.place.naver.com/place/1277280295/home',
 '경북지사':'https://m.place.naver.com/place/1558745244/home',
 '강원지사':'https://m.place.naver.com/place/1404048366/home',
 '서울지사':'https://m.place.naver.com/place/1466463154/home',
 '충청지사':'https://m.place.naver.com/place/1783339221/home'
};
const PROVINCES={
 '서울':'서울특별시','부산':'부산광역시','대구':'대구광역시','인천':'인천광역시',
 '광주':'광주광역시','대전':'대전광역시','울산':'울산광역시','세종':'세종특별자치시',
 '경기':'경기도','강원':'강원특별자치도','충북':'충청북도','충남':'충청남도',
 '전북':'전북특별자치도','전남':'전라남도','경북':'경상북도','경남':'경상남도','제주':'제주특별자치도'
};
const PROVINCE_ALIASES={
 '강원도':'강원','강원특별자치도':'강원','전라북도':'전북','전북특별자치도':'전북',
 '제주도':'제주','제주특별자치도':'제주','충청남도':'충남','충청북도':'충북',
 '전라남도':'전남','경상북도':'경북','경상남도':'경남','경기도':'경기',
 ...Object.fromEntries(Object.entries(PROVINCES).map(([k,v])=>[v,k]))
};
const DEFAULT_OFFICE={경북:'경북지사',경남:'경남지사',전북:'전북지사',전남:'전남지사',경기:'경기지사',강원:'강원지사',서울:'서울지사',충북:'충청지사',충남:'충청지사'};
const GYEONGBUK_202610=[
 ['포항시',486739],['구미시',402774],['경산시',262570],['경주시',242191],
 ['안동시',151224],['김천시',132149],['칠곡군',103225],['영주시',95991],
 ['영천시',93168],['상주시',88664]
].map(([formalName,population])=>({province:'경북',formalName,population}));
const aliases={}; for(const [key,full] of Object.entries(PROVINCES)){aliases[key]=key;aliases[full]=key;}
Object.assign(aliases,PROVINCE_ALIASES);
const normalizeProvince=s=>aliases[String(s||'').trim().replace(/\s+/g,'')]||'';
const stripSuffix=s=>String(s||'').trim().replace(/(?:특별자치시|특별시|광역시|시|군)$/,'');
const status=(message,error=false)=>{const el=$('batchStatus');el.className='status'+(error?' err':'');el.textContent=message;};
const popStatus=message=>$('batchPopulationStatus').textContent=message;
const integer=(id,min,max)=>{const s=String($(id).value).trim(),n=Number(s);if(!/^\d+$/.test(s)||!Number.isSafeInteger(n)||n<min||n>max)throw Error(id+' : '+min+'~'+max+' 정수를 입력하세요.');return n;};
const isMetro=k=>['서울','부산','대구','인천','광주','대전','울산','세종'].includes(k);
let imported=null,folder=null,busy=false,stopRequested=false,selected=new Set();
const cityKey=(province,formalName)=>province+'|'+formalName;

function parseCSV(text){
 const out=[],row=[];let field='',quoted=false;
 // Supports comma-separated CSV with quoted fields, embedded commas and newlines.
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;
  }else if(c===','&&!quoted){row.push(field.trim());field='';}
  else if((c==='\n'||c==='\r')&&!quoted){
   if(c==='\r'&&text[i+1]==='\n')i++;
   row.push(field.trim());field='';if(row.some(Boolean))out.push(row.splice(0));else row.length=0;
  }else field+=c;
 }
 row.push(field.trim());if(row.some(Boolean))out.push(row);
 return out;
}
function parsePopulation(text){
 const records=parseCSV(text.replace(/^\uFEFF/,''));
 if(records.length<2)throw Error('CSV 내용이 비어 있습니다.');
 const headerIndex=records.findIndex(row=>row.some(c=>/행정기관|행정구역|시도명|시군구명/.test(c))&&row.some(c=>/인구|행정기관/.test(c)));
 if(headerIndex<0)throw Error('행정기관/시도명과 인구 열이 있는 행정안전부 시·군 CSV를 선택해 주세요.');
 const headers=records[headerIndex].map(v=>String(v||'').replace(/\s+/g,''));
 const at=names=>headers.findIndex(h=>names.some(n=>h.includes(n)));
 const provinceCol=at(['시도명']);const cityCol=at(['시군구명']);const addrCol=headers.findIndex(h=>(h.includes('행정기관')||h.includes('행정구역'))&&!h.includes('코드'));const dongCol=at(['읍면동명']);
 let popCol=at(['전체당월인구수','총인구수','인구수']);
 if(popCol<0)popCol=headers.findIndex(h=>h.endsWith('총인구'));
 if(popCol<0)throw Error('인구수 열을 찾을 수 없습니다. CSV 열 제목을 확인해 주세요.');
 const totalRows=new Map(),parts=new Map(),metros=new Map();let period='';
 const digits=value=>Number(String(value||'').replace(/[,\s명]/g,''));
 const add=(map,key,n,kind)=>{
  const v=map.get(key);if(v){if(kind==='sum')v.population+=n;else v.population=Math.max(v.population,n);}else map.set(key,{key,population:n});
 };
 for(let i=headerIndex+1;i<records.length;i++){
  const row=records[i];const pop=digits(row[popCol]);
  if(!Number.isSafeInteger(pop)||pop<0)continue;
  const label=addrCol>=0?String(row[addrCol]||'').replace(/^\d+\s*[- ]\s*/, '').trim():'';
  let prov=provinceCol>=0?normalizeProvince(row[provinceCol]):'';
  if(!prov){const first=label.split(/\s+/)[0];prov=normalizeProvince(first);}
  if(!prov)continue;
  const tokens=label.split(/\s+/).filter(Boolean);
  let city=cityCol>=0?String(row[cityCol]||'').trim():'';
  if(!city)city=tokens.length>=2?tokens[1]:'';
  if(isMetro(prov)){
   // Metropolises are selected as one campaign, not by autonomous district.
   if(city===PROVINCES[prov]||!city||!city.endsWith('구'))add(metros,prov,pop,'max');
   else add(parts,'METRO:'+prov+':'+city,pop,'max');
   continue;
  }
  if(!/^[가-힣]{1,15}(?:시|군)$/.test(city))continue;
  const key=cityKey(prov,city);
  const dong=dongCol>=0?String(row[dongCol]||'').trim():'';
  if(dongCol>=0){
   if(dong&&/(?:읍|면|동)$/.test(dong))add(parts,key+':'+dong,pop,'max');
   else if(!dong)add(totalRows,key,pop,'max');
  }else if(tokens.length>=3&&/(?:구|읍|면|동)$/.test(tokens[2])){
   // A nested administrative district must not be added as a second city.
   add(parts,key+':'+tokens[2],pop,'max');
  }else add(totalRows,key,pop,'max');
 }
 const merged=new Map(totalRows);
 const byCity=new Map();for(const [key,v] of parts){
  if(key.startsWith('METRO:'))continue;
  const city=key.split(':')[0];byCity.set(city,(byCity.get(city)||0)+v.population);
 }
 for(const [key,count] of byCity)if(!merged.has(key))merged.set(key,{key,population:count});
 for(const prov of Object.keys(PROVINCES).filter(isMetro)){
  const found=metros.get(prov);
  if(found){merged.set(cityKey(prov,PROVINCES[prov]),{key:cityKey(prov,PROVINCES[prov]),population:found.population});continue;}
  // Sum multiple metropolitan districts only when there is no province row.
  const total=[...parts.entries()].filter(([key])=>key.startsWith('METRO:'+prov+':')).reduce((s,[,v])=>s+v.population,0);
  if(total)merged.set(cityKey(prov,PROVINCES[prov]),{key:cityKey(prov,PROVINCES[prov]),population:total});
 }
 const entries=[...merged.values()].map(v=>{const [province,formalName]=v.key.split('|');return {province,formalName,population:v.population};});
 if(!entries.length)throw Error('유효한 시·군 인구가 없습니다. 행정안전부 전체 시군구 자료를 사용하세요.');
 return entries;
}
function allRows(){return imported?.entries||GYEONGBUK_202610;}
function provinceRows(){
 const prov=$('batchProvince').value,min=integer('batchMinPop',1,99999999);
 return allRows().filter(x=>x.province===prov&&x.population>=min).sort((a,b)=>b.population-a.population||a.formalName.localeCompare(b.formalName,'ko'));
}
// Edit the *original* title generator's in-memory state, never a cloned form.
// The generator runs in a same-origin iframe next to the deployment iframe.
let titleSettingsListenerAttached=false,localTitleEdit=false;
const generatorWindow=()=>{
 try{return window.parent.document.getElementById('generator')?.contentWindow||null;}
 catch{return null;}
};
const getTitleAPI=()=>{
 const g=generatorWindow();
 if(!g?.timoRegionSettingsAPI||!g?.timoBatchPreviewRegionTitles)
   throw Error('제목 생성기가 준비되지 않았습니다. 제목 생성 탭을 한 번 열고 지역명 제목을 선택한 뒤 다시 시도해 주세요.');
 // Batch editing always uses the generator's region-title mode.
 if(!g.timoIsRegionMode?.())g.timoRegionSettingsAPI.enterRegionMode();
 if(!g.timoIsRegionMode?.())throw Error('제목 생성기의 지역명 모드를 사용할 수 없습니다.');
 return {g,api:g.timoRegionSettingsAPI};
};
const titleNotice=(message,bad=false)=>{
 const e=$('batchTitleEditorStatus');e.textContent=message;e.style.color=bad?'#9b3c22':'#547299';
};
const descriptionTexts=()=>[...$('batchDescriptionList').querySelectorAll('input[data-description]')].map(e=>e.value);
function drawWordList(listId,field,words){
 const list=$(listId);list.replaceChildren();
 words.forEach((word,i)=>{
  const wrap=document.createElement('span');
  const name=document.createElement('span');name.textContent=(i+1)+'. '+word;
  wrap.append(name);
  for(const [label,delta] of [['◀',-1],['▶',1],['×',0]]){
   const btn=document.createElement('button');btn.type='button';btn.textContent=label;
   btn.setAttribute('aria-label',(i+1)+'번 '+word+(delta===0?' 삭제':delta===-1?' 왼쪽 이동':' 오른쪽 이동'));
   btn.disabled=busy||(delta!==0&&(i+delta<0||i+delta>=words.length));
   btn.onclick=()=>{
    const next=words.slice();
    if(delta===0)next.splice(i,1);
    else [next[i],next[i+delta]]=[next[i+delta],next[i]];
    editTitle({[field]:next});
   };
   wrap.append(btn);
  }
  list.append(wrap);
 });
}
function drawDescriptionList(entries){
 const root=$('batchDescriptionList');root.replaceChildren();
 entries.forEach((entry,i)=>{
  const row=document.createElement('div');row.className='batch-description-item';
  const input=document.createElement('input');input.type='text';input.maxLength=100;
  input.value=entry;input.dataset.description=String(i);
  input.setAttribute('aria-label','설명 문구 '+(i+1));
  input.disabled=busy;
  input.addEventListener('change',()=>editTitle({descriptions:descriptionTexts()}));
  const del=document.createElement('button');del.type='button';del.textContent='삭제';del.disabled=busy;
  del.onclick=()=>editTitle({descriptions:descriptionTexts().filter((_,index)=>index!==i)});
  row.append(input,del);root.append(row);
 });
}
function syncTitleEditor(){
 if(localTitleEdit)return;
 try{
  const {g,api}=getTitleAPI(),cfg=api.get();
  drawWordList('batchRandomList','randomWords',cfg.randomWords);
  drawWordList('batchFixedList','tailWords',cfg.tailWords);
  drawDescriptionList(cfg.descriptions);
  $('batchRepeatRegion').checked=cfg.repeat;
  $('batchNaturalTitles').checked=cfg.natural;
  titleNotice('기존 제목 생성기와 연결됨 · 랜덤 '+cfg.randomWords.length+'개 · 고정 '+cfg.tailWords.length+'개 · 설명 '+cfg.descriptions.length+'개');
  if(!titleSettingsListenerAttached){
   g.addEventListener('timo:title-settings-changed',syncTitleEditor);
   titleSettingsListenerAttached=true;
  }
 }catch(e){titleNotice(e.message,true);}
}
function editTitle(changes){
 if(busy)return titleNotice('일괄배포 실행 중에는 제목 설정을 수정할 수 없습니다.',true);
 localTitleEdit=true;
 try{
  const {api}=getTitleAPI();api.update(changes);
  $('batchTitlePreviewResult').textContent='제목 설정이 변경됐습니다. [실제 제목 미리보기]에서 변경 내용을 확인하세요.';
 }catch(e){titleNotice('제목 설정 변경 실패: '+e.message,true);}
 finally{localTitleEdit=false;syncTitleEditor();}
}
function addTitleWord(field,inputId){
 const input=$(inputId),word=input.value.trim().replace(/\s+/g,' ');
 if(!word)return;
 try{
  const {api}=getTitleAPI(),cfg=api.get();
  editTitle({[field]:[...cfg[field],word]});input.value='';
 }catch(e){titleNotice(e.message,true);}
}
function updatePreviewCity(rows){
 const select=$('batchPreviewCity'),previous=select.value;
 const display=rows.filter(x=>selected.has(cityKey(x.province,x.formalName)));
 const choices=display.length?display:rows;
 select.replaceChildren(...choices.map(r=>new Option(stripSuffix(r.formalName),stripSuffix(r.formalName))));
 if(choices.some(r=>stripSuffix(r.formalName)===previous))select.value=previous;
}
function previewRealTitles(){
 try{
  const {g}=getTitleAPI(),city=$('batchPreviewCity').value;
  if(!city)throw Error('배포할 시·군을 먼저 선택하세요.');
  const n=integer('batchTitleCount',1,100);
  const texts=g.timoBatchPreviewRegionTitles({shortName:city,count:n});
  $('batchTitlePreviewResult').textContent='['+city+'] 실제 제목 '+n+'개 생성 가능 · 미리보기 '+texts.length+'개\n'+
    texts.map((title,i)=>(i+1)+'. '+title).join('\n');
  titleNotice('현재 제목 생성기 설정으로 실제 제목을 생성했습니다. 이 설정이 캠페인별 XLSX에 적용됩니다.');
 }catch(e){$('batchTitlePreviewResult').textContent='제목 생성 확인 실패: '+e.message;titleNotice(e.message,true);}
}
function render(){
 const province=$('batchProvince').value,rows=provinceRows();
 const options=$('batchOffice');const current=options.value;
 options.replaceChildren(new Option('지사 선택 필요',''),...Object.keys(OFFICE_URLS).map(k=>new Option(k,k)));
 options.value=current||DEFAULT_OFFICE[province]||'';
 if(!options.value)options.value=DEFAULT_OFFICE[province]||'';
 const keys=new Set(rows.map(r=>cityKey(r.province,r.formalName)));
 selected=new Set([...selected].filter(key=>keys.has(key)));
 if(!selected.size)selected=new Set(keys);
 const list=$('batchCityList');list.replaceChildren();
 for(const city of rows){
  const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(cityKey(city.province,city.formalName));
  const label=document.createElement('label');label.style.cssText='display:flex;gap:6px;align-items:center;padding:6px 8px;background:#f4f7fc;border:1px solid #d6e0ef;border-radius:7px;font-size:12px';
  check.addEventListener('change',()=>{const key=cityKey(city.province,city.formalName);if(check.checked)selected.add(key);else selected.delete(key);updatePreviewCity(rows);});
  label.append(check,document.createTextNode(stripSuffix(city.formalName)+' '+city.population.toLocaleString('ko-KR')+'명'));list.append(label);
 }
 if(imported)popStatus('CSV 인구 자료 '+imported.filename+' · '+imported.entries.length+'개 지역 · '+province+' 기준 충족 '+rows.length+'곳');
 else popStatus(province==='경북'?'경북 2026년 10월 기본 목록 · 인구 8만 이상 '+rows.length+'곳':
   '이 시·도의 인구 자료가 없습니다. 행정안전부 시·군 CSV를 불러오세요.');
 $('batchStart').disabled=busy||!rows.length;
 updatePreviewCity(rows);
}
async function history(){return (await chrome.storage.local.get(KEY))[KEY]||{};}
const saveHistory=async value=>chrome.storage.local.set({[KEY]:value});
function bodyOptions(){
 return {bodyEnabled:$('batchRegionBodyEnabled').checked,bodyMinCount:integer('batchBodyMinCount',7,30),shatsiMinCount:integer('batchShatsiMinCount',0,80),shasiMinCount:integer('batchShasiMinCount',0,80),tagPrefixEnabled:$('batchTagPrefixEnabled').checked};
}
async function saveBodyOptions(){
 try{await chrome.storage.local.set({[BODYKEY]:bodyOptions()});}catch(e){status('지역 원고 설정 저장 실패: '+e.message,true);}
}
async function previewBottomTags(){
 const result=$('batchTagPreviewResult');
 try{
  const city=$('batchPreviewCity').value;
  if(!city)throw Error('미리보기 지역을 먼저 선택하세요.');
  const enabled=$('batchTagPrefixEnabled').checked;
  const output=await window.timoBatchBridge.previewBottomTags({shortName:city,tagPrefixEnabled:enabled});
  result.textContent='['+city+'] 하단 태그 '+output.transformed.length+'개 · '+(enabled?'모두 지역명 포함':'기존 태그 유지')+'\n'+
   output.transformed.map((tag,i)=>(i+1)+'. #'+tag).join(' · ');
 }catch(e){result.textContent='하단 태그 미리보기 오류: '+e.message;}
}
async function previewReferenceText(){
 const result=$('batchReferencePreviewResult');
 try{
   const city=$('batchPreviewCity').value;
   if(!city)throw Error('배포할 시·군을 먼저 선택하세요.');
   const opts=bodyOptions();
   if(!opts.bodyEnabled)throw Error('지역별 원고 자동 생성을 먼저 체크해 주세요.');
   const prepared=await window.timoBatchBridge.previewReferences({shortName:city,...opts});
   const summaries=prepared.details.map(row=>row.sourceName+' → '+row.filename+'\n  지역명 '+row.originalCount+' → '+row.count+'회 · 샷시 '+row.shatsiOriginal+' → '+row.shatsiCount+'회 · 샤시 '+row.shasiOriginal+' → '+row.shasiCount+'회');
   result.textContent='['+city+'] 참고원고 '+prepared.count+'개 · 지역명 '+opts.bodyMinCount+'회 / 샷시 '+opts.shatsiMinCount+'회 / 샤시 '+opts.shasiMinCount+'회 최소 기준 검증 통과\n'+summaries.join('\n')+'\n\n변환 예시 (첫 번째 원고):\n'+prepared.details[0].preview;
 }catch(e){result.textContent='지역별 원고 미리보기 오류: '+e.message;}
}
function getJobs(){
 const province=$('batchProvince').value,office=$('batchOffice').value;
 if(!OFFICE_URLS[office])throw Error('플레이스 지사를 먼저 선택하세요. 임의 지사를 자동 추정하지 않습니다.');
 const titleCount=integer('batchTitleCount',1,100),dailyLimit=integer('batchDailyLimit',1,100000),postLimit=integer('batchTotalLimit',1,100000);
 const rows=provinceRows().filter(r=>selected.has(cityKey(r.province,r.formalName)));
 if(!rows.length)throw Error('시·군을 하나 이상 선택하세요.');
 const options=bodyOptions();
 return rows.map(row=>({...options,provinceShort:province,provinceFull:PROVINCES[province],formalName:row.formalName,
  shortName:stripSuffix(row.formalName),population:row.population,titleCount,dailyLimit,postLimit,
  office,placeUrl:OFFICE_URLS[office]}));
}
function formatPreview(jobs){return jobs.map((j,i)=>`${i+1}. ${j.formalName} → ${j.shortName} | 제목 ${j.titleCount} | 하루 ${j.dailyLimit} / 전체 ${j.postLimit} | ${j.office} | 하단 태그 ${j.tagPrefixEnabled?'전부 지역명 포함':'기존'} | 지역 원고 ${j.bodyEnabled?'지역 '+j.bodyMinCount+' / 샷시 '+j.shatsiMinCount+' / 샤시 '+j.shasiMinCount+'회':'원본'}`).join('\n');}
async function saveWorkbook(info){
 if(!folder)return;
 if((await folder.queryPermission({mode:'readwrite'}))!=='granted')throw Error('제목 저장 폴더 쓰기 권한을 다시 허용하세요.');
 const file=await folder.getFileHandle(info.filename,{create:true}),w=await file.createWritable();
 try{await w.write(info.generated.blob);await w.close();}catch(e){await w.abort().catch(()=>{});throw e;}
}
async function run(){
 if(busy)return;
 try{
  const {g}=getTitleAPI(),count=integer('batchTitleCount',1,100);
  const preview=$('batchPreviewCity').value;
  if(preview)g.timoBatchPreviewRegionTitles({shortName:preview,count});
 }catch(e){titleNotice('배포 전 제목 설정을 확인하세요: '+e.message,true);return;}
 busy=true;stopRequested=false;
 $('batchStart').disabled=true;
 let sessionStarted=false,finished=0,failed=0;const failureList=[];
 try{
  const jobs=getJobs();
  const old=await history(),completed=jobs.filter(j=>old[cityKey(j.provinceShort,j.formalName)]?.status==='prepared');
  const uncertain=jobs.filter(j=>['running','review'].includes(old[cityKey(j.provinceShort,j.formalName)]?.status));
  // Re-run failed/interrupted cities as new campaigns, without erasing evidence.
  // Only previously confirmed successful cities are omitted.
  const pending=jobs.filter(j=>!completed.includes(j));
  if(!pending.length)throw Error('선택한 시·군은 모두 이전에 정상 등록·진행됐습니다. 성공 도시는 자동 재등록하지 않습니다.');
  const retryMessage=uncertain.length
    ?'\n\n[이전 실패·중단 재등록] '+uncertain.map(j=>j.shortName).join(', ')+
      '\n이미 일부 등록된 캠페인이 있으면 중복 생성될 수 있습니다. 기존 오류 기록은 보존합니다.'
    :'';
  if(!confirm('인구 8만 이상 시·군 자동 신규 등록·실행\n\n'+formatPreview(pending)+retryMessage+
    '\n\n위 도시의 [저장] → [등록] → 이미지·원고·제목 등록 → [진행] 및 예상된 확인창을 자동 처리합니다.'+
    '\n실제 티모 배포가 시작될 수 있습니다. 신규 캠페인의 배포 방식은 생성 후 자동배포로 선택하며, 대상 캠페인 ID가 일치할 때만 [진행]합니다. 실행합니까?'))return;
  await window.timoBatchBridge.begin();sessionStarted=true;
  for(const j of pending){
   if(stopRequested){status('사용자가 중단을 요청했습니다. 완료 '+finished+'곳');break;}
   const id=cityKey(j.provinceShort,j.formalName);
   const current=await history();
   const previous=current[id]||{};
   const previousRuns=Array.isArray(previous.previousRuns)?previous.previousRuns.slice(-19):[];
   if(['running','review'].includes(previous.status))previousRuns.push({
     status:previous.status,error:String(previous.error||'이전 작업 중단'),
     startedAt:previous.startedAt||'',failedAt:previous.failedAt||''
   });
   current[id]={status:'running',startedAt:new Date().toISOString(),office:j.office,previousRuns:previousRuns.slice(-20)};
   await saveHistory(current);
   status(j.formalName+' 등록 진행 중 · '+(finished+1)+'/'+pending.length+' · 제목 → 캠페인 → 파일 등록');
   try{
    const done=await window.timoBatchBridge.one(j,saveWorkbook);
    const next=await history();next[id]={...next[id],status:'prepared',campaignId:done.campaignId,campaignName:done.campaignName,
      placeUrl:j.placeUrl,completedAt:new Date().toISOString(),titleCount:done.generated.titleCount,
      autoStarted:done.startVerified===true,error:null};await saveHistory(next);
    finished++;
    status(j.formalName+' 신규 등록·시작 확인 (캠페인 ID '+done.campaignId+') · '+finished+'/'+pending.length+' · 다음 도시로 이동');
   }catch(e){
    const next=await history();next[id]={...next[id],status:'review',error:e.message,failedAt:new Date().toISOString()};await saveHistory(next);
    failed++;failureList.push(j.shortName+' · '+e.message);
    status(j.shortName+' 실패 · '+e.message+'\n다음 도시로 계속 진행합니다. ('+(finished+failed)+'/'+pending.length+')',true);
    // The next run will retry this city as a new campaign; never silently reuse the failed one.
    await new Promise(resolve=>setTimeout(resolve,600));
   }
  }
  if(!stopRequested)status('일괄배포 처리 종료 · 시작 확인 '+finished+'곳 / 실패 '+failed+'곳'+
    (failureList.length?'\n실패 지역 (다음 실행 시 신규 재등록):\n'+failureList.join('\n'):'')+
    '\n업로드 성공 및 실제 게시 결과는 티모의 서버 상태를 기준으로 최종 확인하세요.',failed>0);
 }catch(e){status('일괄 작업 중단 · '+e.message,true);}
 finally{
  if(sessionStarted)await window.timoBatchBridge.end().catch(e=>status('설정 원복 실패: '+e.message,true));
  busy=false;render();
 }
}
function init(){
 $('batchTagPreview').addEventListener('click',previewBottomTags);
 $('batchReferencePreview').addEventListener('click',previewReferenceText);
 for(const id of ['batchRegionBodyEnabled','batchBodyMinCount','batchShatsiMinCount','batchShasiMinCount','batchTagPrefixEnabled'])$(id).addEventListener('change',saveBodyOptions);
 chrome.storage.local.get(BODYKEY).then(r=>{
   const cfg=r[BODYKEY];if(!cfg)return;
   $('batchRegionBodyEnabled').checked=cfg.bodyEnabled!==false;
   $('batchTagPrefixEnabled').checked=cfg.tagPrefixEnabled!==false;
   const n=Number(cfg.bodyMinCount);
   $('batchBodyMinCount').value=Number.isInteger(n)&&n>=7&&n<=30?String(n):'7';
   for(const [key,inputId] of [['shatsiMinCount','batchShatsiMinCount'],['shasiMinCount','batchShasiMinCount']]){
     const v=Number(cfg[key]);
     $(inputId).value=Number.isInteger(v)&&v>=0&&v<=80?String(v):'0';
   }
 }).catch(()=>{});
 $('batchAddRandom').addEventListener('click',()=>addTitleWord('randomWords','batchRandomInput'));
 $('batchAddFixed').addEventListener('click',()=>addTitleWord('tailWords','batchFixedInput'));
 for(const [inputId,field] of [['batchRandomInput','randomWords'],['batchFixedInput','tailWords']])
  $(inputId).addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();addTitleWord(field,inputId);}});
 $('batchRepeatRegion').addEventListener('change',()=>editTitle({repeat:$('batchRepeatRegion').checked}));
 $('batchNaturalTitles').addEventListener('change',()=>editTitle({natural:$('batchNaturalTitles').checked}));
 $('batchAddDescription').addEventListener('click',()=>{
  const input=$('batchDescriptionInput'),word=input.value.trim().replace(/\s+/g,' ');
  if(!word)return;
  try{const {api}=getTitleAPI();editTitle({descriptions:[...api.get().descriptions,word]});input.value='';}
  catch(e){titleNotice(e.message,true);}
 });
 $('batchDescriptionInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();$('batchAddDescription').click();}});
 $('batchSyncTitles').addEventListener('click',syncTitleEditor);
 $('batchPreviewTitles').addEventListener('click',previewRealTitles);
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.type!=='TIMO_BATCH_OPENED')return;
  syncTitleEditor();
 });
 // The generator's async enhancement scripts can load after this iframe.
 // Re-check on user action rather than silently using stale copied settings.
 setTimeout(syncTitleEditor,800);
 $('batchOffice').replaceChildren(new Option('지사 선택 필요',''),...Object.keys(OFFICE_URLS).map(k=>new Option(k,k)));
 $('batchProvince').addEventListener('change',()=>{selected.clear();$('batchOffice').value=DEFAULT_OFFICE[$('batchProvince').value]||'';render();});
 $('batchMinPop').addEventListener('change',()=>{selected.clear();render();});
 $('batchPopulationFile').addEventListener('change',async event=>{
  const f=event.target.files?.[0];if(!f)return;
  try{
   const buffer=await f.arrayBuffer();
   let decoded=new TextDecoder('utf-8').decode(buffer);
   if(!/시도명|행정기관|행정구역/.test(decoded))decoded=new TextDecoder('euc-kr').decode(buffer);
   const entries=parsePopulation(decoded);imported={filename:f.name,entries,importedAt:new Date().toISOString()};
   await chrome.storage.local.set({[POPKEY]:imported});selected.clear();render();
  }catch(error){popStatus('CSV 오류: '+error.message);}
 });
 $('batchTitleFolder').addEventListener('click',async()=>{
  try{const h=await showDirectoryPicker({id:'timo-batch-title-output',mode:'readwrite'});
   if((await h.requestPermission({mode:'readwrite'}))!=='granted')throw Error('폴더 쓰기 권한이 허용되지 않았습니다.');
   folder=h;$('batchTitleFolder').textContent='제목 폴더: '+h.name;
  }catch(e){if(e.name!=='AbortError')status('폴더 연결 실패: '+e.message,true);}
 });
 $('batchPreview').addEventListener('click',async()=>{
  try{const jobs=getJobs(),old=await history();status('배포 대상 '+jobs.length+'곳 · '+jobs.map(j=>j.shortName).join(', ')+'\n'+formatPreview(jobs)+
   '\n이전 완료: '+jobs.filter(j=>old[cityKey(j.provinceShort,j.formalName)]?.status==='prepared').length+'곳');}
  catch(e){status(e.message,true);}
 });
 $('batchHistoryDetails').addEventListener('click',async()=>{
  if(busy)return;
  try{
   const jobs=getJobs(),saved=await history();
   const errors=jobs.filter(j=>{
     const rec=saved[cityKey(j.provinceShort,j.formalName)]||{};
     return ['running','review'].includes(rec.status)||(Array.isArray(rec.previousRuns)&&rec.previousRuns.length>0);
   });
   if(!errors.length)return status('선택한 도시에서 이전 실패·중단 이력이 발견되지 않았습니다.');
   const details=errors.map(j=>{
     const item=saved[cityKey(j.provinceShort,j.formalName)]||{};
     const previous=(Array.isArray(item.previousRuns)?item.previousRuns:[]).map((entry,i)=>
       '이전 '+(i+1)+'회 · '+(entry.failedAt||entry.startedAt||'시간 미상')+'\n'+String(entry.error||'중단')).join('\n');
     const current=['running','review'].includes(item.status)
       ?'현재 오류 · '+String(item.error||'진행 도중 중단됨')
       :'현재 상태 · '+(item.status||'미상');
     return j.shortName+'\n'+[previous,current].filter(Boolean).join('\n');
   });
   status('이전 실행 진단 ('+errors.length+'곳)\n\n'+details.join('\n\n')+
     '\n\n실패·중단 도시는 다음 일괄배포에서 새 캠페인으로 자동 재등록됩니다.',true);
  }catch(e){status('이전 실패 기록 확인 실패: '+e.message,true);}
 });
 $('batchOpenTimo').addEventListener('click',()=>{
  chrome.tabs.create({url:'https://xn--v52b175b.site/posts/places',active:true})
    .catch(e=>status('티모 캠페인 목록 열기 실패: '+e.message,true));
 });
 $('batchHistoryReset').addEventListener('click',async()=>{
  if(busy)return;
  try{
   const jobs=getJobs(),saved=await history(),affected=jobs.filter(j=>saved[cityKey(j.provinceShort,j.formalName)]);
   if(!affected.length)return status('선택한 도시의 기존 이력이 없습니다.');
   if(!confirm('중복 등록 주의!\n\n다음 '+affected.length+'개 도시의 일괄배포 이력을 초기화합니다:\n'+affected.map(j=>j.formalName).join(', ')+
     '\n\n티모에서 기존 캠페인 및 자료 등록 여부를 직접 확인했습니까? 동일 도시가 다시 생성될 수 있습니다.'))return;
   for(const j of affected)delete saved[cityKey(j.provinceShort,j.formalName)];
   await saveHistory(saved);status('선택 도시 '+affected.length+'곳의 기록을 초기화했습니다. 중복 생성에 주의하세요.');
  }catch(e){status(e.message,true);}
 });
 $('batchStart').addEventListener('click',run);
 $('batchStop').addEventListener('click',()=>{stopRequested=true;status('현재 도시 작업이 끝난 뒤 일괄 처리를 중단합니다.');});
 chrome.storage.local.get(POPKEY).then(data=>{
  const saved=data[POPKEY];if(saved&&Array.isArray(saved.entries)&&saved.entries.every(x=>x.province&&x.formalName&&Number.isSafeInteger(x.population)))imported=saved;
  selected.clear();render();
 }).catch(()=>render());
}
init();
})();
