'use strict';
// TIMO 0.7.37 - verified population import, city/county batch campaign queue.
// Runs only on the visible extension setup page. It does not schedule postings
// and never clicks TiMO's final [진행] control.
(()=>{
const $=id=>document.getElementById(id);
if(!$('timoBatchPanel'))return;
const KEY='timoRegionBatchHistoryV1',POPKEY='timoPopulationImportV1';
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
  check.addEventListener('change',()=>{const key=cityKey(city.province,city.formalName);if(check.checked)selected.add(key);else selected.delete(key);});
  label.append(check,document.createTextNode(stripSuffix(city.formalName)+' '+city.population.toLocaleString('ko-KR')+'명'));list.append(label);
 }
 if(imported)popStatus('CSV 인구 자료 '+imported.filename+' · '+imported.entries.length+'개 지역 · '+province+' 기준 충족 '+rows.length+'곳');
 else popStatus(province==='경북'?'경북 2026년 10월 기본 목록 · 인구 8만 이상 '+rows.length+'곳':
   '이 시·도의 인구 자료가 없습니다. 행정안전부 시·군 CSV를 불러오세요.');
 $('batchStart').disabled=busy||!rows.length;
}
async function history(){return (await chrome.storage.local.get(KEY))[KEY]||{};}
const saveHistory=async value=>chrome.storage.local.set({[KEY]:value});
function getJobs(){
 const province=$('batchProvince').value,office=$('batchOffice').value;
 if(!OFFICE_URLS[office])throw Error('플레이스 지사를 먼저 선택하세요. 임의 지사를 자동 추정하지 않습니다.');
 const titleCount=integer('batchTitleCount',1,100),dailyLimit=integer('batchDailyLimit',1,100000),postLimit=integer('batchTotalLimit',1,100000);
 const rows=provinceRows().filter(r=>selected.has(cityKey(r.province,r.formalName)));
 if(!rows.length)throw Error('시·군을 하나 이상 선택하세요.');
 return rows.map(row=>({provinceShort:province,provinceFull:PROVINCES[province],formalName:row.formalName,
  shortName:stripSuffix(row.formalName),population:row.population,titleCount,dailyLimit,postLimit,
  office,placeUrl:OFFICE_URLS[office]}));
}
function formatPreview(jobs){return jobs.map((j,i)=>`${i+1}. ${j.formalName} → ${j.shortName} | 제목 ${j.titleCount} | 하루 ${j.dailyLimit} / 전체 ${j.postLimit} | ${j.office}`).join('\n');}
async function saveWorkbook(info){
 if(!folder)return;
 if((await folder.queryPermission({mode:'readwrite'}))!=='granted')throw Error('제목 저장 폴더 쓰기 권한을 다시 허용하세요.');
 const file=await folder.getFileHandle(info.filename,{create:true}),w=await file.createWritable();
 try{await w.write(info.generated.blob);await w.close();}catch(e){await w.abort().catch(()=>{});throw e;}
}
async function run(){
 if(busy)return;busy=true;stopRequested=false;
 $('batchStart').disabled=true;
 let sessionStarted=false,finished=0;
 try{
  const jobs=getJobs();
  const old=await history(),completed=jobs.filter(j=>old[cityKey(j.provinceShort,j.formalName)]?.status==='prepared');
  const uncertain=jobs.filter(j=>['running','review'].includes(old[cityKey(j.provinceShort,j.formalName)]?.status));
  if(uncertain.length)throw Error('완료 여부 확인이 필요한 도시: '+uncertain.map(j=>j.shortName).join(', ')+'\n티모 캠페인 목록에서 중복 생성 여부를 확인하고 수동 정리하세요. 자동 재등록하지 않습니다.');
  const pending=jobs.filter(j=>!completed.includes(j));
  if(!pending.length)throw Error('선택한 시·군은 이전에 일괄배포를 완료했습니다. 중복 등록을 방지하기 위해 재실행하지 않습니다.');
  if(!confirm('인구 8만 이상 시·군 배포 캠페인 생성\n\n'+formatPreview(pending)+'\n\n모든 도시를 순서대로 신규 등록합니다. 배포 방식은 사이트 기본 선택을 그대로 두고 확인하지 않습니다. 수동 시작을 설정하며 마지막 [진행]은 누르지 않습니다. PC 화면을 닫지 마세요. 실행합니까?'))return;
  await window.timoBatchBridge.begin();sessionStarted=true;
  for(const j of pending){
   if(stopRequested){status('사용자가 중단을 요청했습니다. 완료 '+finished+'곳');break;}
   const id=cityKey(j.provinceShort,j.formalName);
   const current=await history();current[id]={status:'running',startedAt:new Date().toISOString(),office:j.office};await saveHistory(current);
   status(j.formalName+' 등록 진행 중 · '+(finished+1)+'/'+pending.length+' · 제목 → 캠페인 → 파일 등록');
   try{
    const done=await window.timoBatchBridge.one(j,saveWorkbook);
    const next=await history();next[id]={status:'prepared',campaignId:done.campaignId,campaignName:done.campaignName,
      placeUrl:j.placeUrl,completedAt:new Date().toISOString(),titleCount:done.generated.titleCount};await saveHistory(next);
    finished++;
    status(j.formalName+' 설정 저장 및 파일 선택 완료 (캠페인 ID '+done.campaignId+') · '+finished+'/'+pending.length+' · 다음 도시로 이동');
   }catch(e){
    const next=await history();next[id]={status:'review',error:e.message,failedAt:new Date().toISOString()};await saveHistory(next);
    throw Error(j.formalName+'에서 중단: '+e.message+'\n해당 도시는 티모에서 저장·업로드 여부를 확인한 뒤 다시 처리하세요.');
   }
  }
  if(!stopRequested)status('일괄 준비 완료 · 새 캠페인 '+finished+'개 저장 및 파일 선택칸 전달. 서버 업로드·실제 발행 성공은 확인되지 않았습니다. 티모에서 검수하세요. [진행]은 누르지 않았습니다.');
 }catch(e){status('일괄 작업 중단 · '+e.message,true);}
 finally{
  if(sessionStarted)await window.timoBatchBridge.end().catch(e=>status('설정 원복 실패: '+e.message,true));
  busy=false;render();
 }
}
function init(){
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
