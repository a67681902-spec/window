'use strict';
(()=>{
const $=id=>document.getElementById(id),K='timoAutomationSettingsV1',KG='timoGenerationKeywordGroupsV1',KGB='timoGenerationKeywordGroupsBackupV1',HM='timoHandleMetaV1',DB='TIMO_HANDLES_V1',BDB='TIMO_STATE_BACKUP_V1';
const keys=['images','references','titles'],exclusion=['대출','이자'];
const ext={images:/\.(jpg|jpeg|png)$/i,references:/\.(txt|doc|docx)$/i,titles:/\.(xls|xlsx|txt)$/i};
const DEFAULT_OTHER_URLS="https://windowking.pages.dev/\nhttps://windowking.pages.dev/1\nhttps://windowking.pages.dev/2\nhttps://windowking.pages.dev/3\nhttps://windowking.pages.dev/4";
let prefs={placeUrls:'',districts:'',extraKeywords:'',imagesPath:'',referencesPath:'',otherUrls:DEFAULT_OTHER_URLS,dailyLimit:'',newPostType:'',newGenType:'참고원고 기반 생성'};
let context={keywords:[],regions:[],districts:[],titlesCount:0,uniqueComplexCount:null,updatedAt:''},handles={},handleMeta={};
let keywordGroups=[],activeKeywordGroupId='';
const defaultKeywordGroups=()=>[{
 id:'shashi-replace',name:'샷시교체',selected:true,items:[
  {id:'k1',text:'샷시교체',enabled:true},
  {id:'k2',text:'창호교체',enabled:true},
  {id:'k3',text:'샤시',enabled:true},
  {id:'k4',text:'샷시',enabled:true},
  {id:'k5',text:'샤시교체',enabled:true},
  {id:'k6',text:'아파트 샷시',enabled:true},
  {id:'k7',text:'베란다 샷시',enabled:true},
  {id:'k8',text:'샷시 교체',enabled:true},
  {id:'k9',text:'그린리모델링',enabled:true}
 ]
}];
const uid=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);

const logs=[];
function note(message,err=false,code='INFO'){
 $('status').textContent=message;$('status').className='status '+(err?'err':'ok');
 if(err){logs.push({time:new Date().toISOString(),code,message});$('diagnostic').textContent=logs.slice().reverse().map(x=>x.time+' ['+x.code+'] '+x.message).join('\n\n');}
}
const split=s=>[...new Set(String(s||'').split(/[,，\n]/).map(x=>x.trim()).filter(Boolean))];
const folderPath=key=>String(prefs[key+'Path']||'').trim();
const ambiguousDistricts=new Set(['중구','동구','서구','남구','북구','강서구']);
const db=new Promise((ok,no)=>{
 const r=indexedDB.open(DB,1);
 r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('handles'))r.result.createObjectStore('handles');};
 r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
});
const backupDb=new Promise((ok,no)=>{
 const r=indexedDB.open(BDB,1);
 r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state');};
 r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
});
async function backupPut(key,value){
 try{
  const x=await backupDb;
  await new Promise((ok,no)=>{const tx=x.transaction('state','readwrite');const r=tx.objectStore('state').put(value,key);r.onsuccess=()=>ok();r.onerror=()=>no(r.error);});
  return true;
 }catch{return false;}
}
async function backupGet(key){
 try{
  const x=await backupDb;
  return await new Promise((ok,no)=>{const tx=x.transaction('state','readonly');const r=tx.objectStore('state').get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
 }catch{return undefined;}
}
async function saveHandleMeta(key,h){
 const meta={name:String(h?.name||''),kind:String(h?.kind||''),savedAt:new Date().toISOString()};
 handleMeta={...handleMeta,[key]:meta};
 try{await chrome.storage.local.set({[HM]:handleMeta});}catch{}
 try{localStorage.setItem(HM,JSON.stringify(handleMeta));}catch{}
}
async function put(key,value){
 const x=await db;return new Promise((ok,no)=>{const tx=x.transaction('handles','readwrite');
 const r=tx.objectStore('handles').put(value,key);r.onsuccess=()=>ok();r.onerror=()=>no(r.error);});
}
async function get(key){
 const x=await db;return new Promise((ok,no)=>{const tx=x.transaction('handles','readonly');
 const r=tx.objectStore('handles').get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
}
async function permission(h,request=false){
 if(!h)return 'missing';
 try{let v=await h.queryPermission({mode:'read'});if(v!=='granted'&&request)v=await h.requestPermission({mode:'read'});return v;}
 catch(e){return 'error:'+e.message;}
}
async function files(key){
 const h=handles[key];if(!h)return [];
 if(key==='titles'){const f=await h.getFile();return ext.titles.test(f.name)?[f]:[];}
 const out=[];for await(const [,child] of h.entries()){
 if(child.kind==='file'&&ext[key].test(child.name))out.push(await child.getFile());
 if(out.length>500)break;
 }return out;
}
async function renderHandle(key){
 const out=$(key+'Name'),h=handles[key],savedPath=folderPath(key);
 if(!h){
  const meta=handleMeta[key],known=meta?.name?'이전 선택: '+meta.name:'폴더 연결 없음';
  out.textContent=known+(savedPath?'\n고정 경로: '+savedPath:'')+'\n실제 파일 사용 전 [폴더 선택 / 변경]으로 연결해 주세요.';
  return;
 }
 const p=await permission(h);
 let message=h.name+' · '+(p==='granted'?'접근 허용':'다시 접근 허용 필요');
 if(p==='granted'){try{message+=' · '+(await files(key)).length+'개 파일';}catch(e){message+=' · 오류: '+e.message;}}
 if(savedPath)message+='\n고정 경로: '+savedPath;
 out.textContent=message;
}
async function pick(key){
 try{
 let h;
 if(key==='titles'){
  if(!('showOpenFilePicker'in window))throw Error('파일 선택 API 미지원');
  const opts={multiple:false,id:'timo-titles-file'};if(handles[key])opts.startIn=handles[key];
  let result;
  try{result=await showOpenFilePicker(opts);}
  catch(e){if(e.name==='AbortError')throw e;result=await showOpenFilePicker({multiple:false,id:'timo-titles-file'});}
  h=result[0];
 }else{
  if(!('showDirectoryPicker'in window))throw Error('폴더 선택 API 미지원');
  const opts={mode:'read',id:'timo-'+key+'-folder'};if(handles[key])opts.startIn=handles[key];
  try{h=await showDirectoryPicker(opts);}
  catch(e){if(e.name==='AbortError')throw e;h=await showDirectoryPicker({mode:'read',id:'timo-'+key+'-folder'});}
 }
 handles[key]=h;
 await put(key,h);
 await backupPut('handle:'+key,h);
 await saveHandleMeta(key,h);
 await renderHandle(key);
 note(h.name+' 선택 저장 완료. '+(folderPath(key)?'고정 경로와 ':'')+'폴더 권한을 함께 기억합니다.');
 }catch(e){if(e.name!=='AbortError')note('E_FOLDER_SAVE · 선택/저장 실패: '+e.message+'\nChrome 브라우저에서 폴더 권한을 허용한 뒤 재시도하세요.',true,'E_FOLDER_SAVE');}
}
async function allow(key){
 if(!handles[key])return note('E_FOLDER_MISSING · 실제 폴더 연결이 없습니다.'+(folderPath(key)?' 저장된 경로: '+folderPath(key)+'.':'')+' [폴더 선택 / 변경]으로 연결해 주세요.',true,'E_FOLDER_MISSING');
 const p=await permission(handles[key],true);await renderHandle(key);
 if(p!=='granted')note('E_PERMISSION · 파일 접근 권한이 없습니다: '+p+'\n폴더 권한을 다시 허용하거나 재선택하세요.',true,'E_PERMISSION');
 else note('파일 접근 권한 확인 완료: '+handles[key].name);
}
function takeForm(){for(const f of Object.keys(prefs))prefs[f]=$(f).value;return prefs;}
function loadForm(){for(const f of Object.keys(prefs))$(f).value=prefs[f]||'';}
async function save(silent=false){
 takeForm();
 try{await chrome.storage.local.set({[K]:prefs});if(!silent)note('설정 저장 완료 · 다음 실행에도 URL/지역/키워드 입력값을 유지합니다.');}
 catch(e){note('E_STORAGE · 설정 저장 실패: '+e.message,true,'E_STORAGE');}
}
function normalizeKeywordGroups(raw){
 const groups=Array.isArray(raw)?raw:[];
 return groups.filter(g=>g&&typeof g.name==='string'&&g.name.trim()).slice(0,50).map((g,gi)=>({
  id:typeof g.id==='string'&&g.id?g.id:'group-'+gi+'-'+Date.now().toString(36),
  name:g.name.trim().slice(0,30),
  selected:g.selected!==false,
  items:(Array.isArray(g.items)?g.items:[]).filter(x=>x&&typeof x.text==='string'&&x.text.trim()).slice(0,100).map((x,ii)=>({
   id:typeof x.id==='string'&&x.id?x.id:'item-'+gi+'-'+ii,
   text:x.text.trim().slice(0,40),
   enabled:x.enabled!==false
  }))
 }));
}
async function saveKeywordGroups(){
 try{
  const snapshot=JSON.parse(JSON.stringify(keywordGroups));
  await chrome.storage.local.set({[KG]:snapshot,[KGB]:snapshot});
  try{localStorage.setItem(KGB,JSON.stringify(snapshot));}catch{}
  await backupPut('keywordGroups',snapshot);
 }catch(e){note('E_KEYWORD_GROUP_SAVE · 키워드 묶음 저장 실패: '+e.message,true,'E_KEYWORD_GROUP_SAVE');}
}
async function loadKeywordGroups(){
 const saved=await chrome.storage.local.get([KG,KGB]);
 let localBackup=null,idbBackup=null;
 try{localBackup=JSON.parse(localStorage.getItem(KGB)||'null');}catch{}
 idbBackup=await backupGet('keywordGroups');
 const candidates=[saved[KG],saved[KGB],localBackup,idbBackup]
   .map(normalizeKeywordGroups).filter(x=>x.length);
 const score=groups=>groups.length*1000+groups.reduce((n,g)=>n+(g.items?.length||0),0);
 keywordGroups=candidates.sort((a,b)=>score(b)-score(a))[0]||defaultKeywordGroups();
 await saveKeywordGroups();
 if(!keywordGroups.some(g=>g.id===activeKeywordGroupId))activeKeywordGroupId=keywordGroups[0]?.id||'';
}
function selectedGroupWords(){
 const out=[];
 for(const group of keywordGroups){
  if(!group.selected)continue;
  for(const item of group.items||[])if(item.enabled&&item.text.trim())out.push(item.text.trim());
 }
 return [...new Set(out)];
}
function renderKeywordGroups(){
 const tabs=$('keywordGroupTabs'),items=$('keywordGroupItems');
 if(!tabs||!items)return;
 tabs.textContent='';items.textContent='';
 if(!keywordGroups.length){
  activeKeywordGroupId='';
  $('keywordGroupEditorTitle').textContent='대키워드가 없습니다';
  $('deleteKeywordGroup').disabled=true;$('addKeywordItem').disabled=true;$('newKeywordItem').disabled=true;
  items.innerHTML='<div class="kg-empty">위 입력칸에서 대키워드를 추가하세요.</div>';
  updateWords();return;
 }
 if(!keywordGroups.some(g=>g.id===activeKeywordGroupId))activeKeywordGroupId=keywordGroups[0].id;
 for(const group of keywordGroups){
  const wrap=document.createElement('div');wrap.className='kg-tab'+(group.id===activeKeywordGroupId?' active':'');
  const check=document.createElement('input');check.type='checkbox';check.checked=!!group.selected;check.title='이 묶음을 생성시 포함 키워드에 사용';
  check.addEventListener('change',async e=>{e.stopPropagation();group.selected=check.checked;await saveKeywordGroups();renderKeywordGroups();});
  const btn=document.createElement('button');btn.type='button';btn.textContent=group.name;btn.title='하부키워드 보기/편집';
  btn.addEventListener('click',()=>{activeKeywordGroupId=group.id;renderKeywordGroups();});
  wrap.append(check,btn);tabs.append(wrap);
 }
 const group=keywordGroups.find(g=>g.id===activeKeywordGroupId);
 $('keywordGroupEditorTitle').textContent=group.name+' · 하부키워드';
 $('deleteKeywordGroup').disabled=false;$('addKeywordItem').disabled=false;$('newKeywordItem').disabled=false;
 if(!(group.items||[]).length)items.innerHTML='<div class="kg-empty">하부키워드가 없습니다. 아래에서 추가하세요.</div>';
 for(const item of group.items||[]){
  const row=document.createElement('div');row.className='kg-item';
  const check=document.createElement('input');check.type='checkbox';check.checked=!!item.enabled;check.title='이 하부키워드 사용';
  const input=document.createElement('input');input.type='text';input.maxLength=40;input.value=item.text;
  const del=document.createElement('button');del.type='button';del.textContent='삭제';
  check.addEventListener('change',async()=>{item.enabled=check.checked;await saveKeywordGroups();updateWords();});
  input.addEventListener('change',async()=>{const v=input.value.trim().replace(/\s+/g,' ');if(v)item.text=v;else input.value=item.text;await saveKeywordGroups();renderKeywordGroups();});
  del.addEventListener('click',async()=>{group.items=group.items.filter(x=>x.id!==item.id);await saveKeywordGroups();renderKeywordGroups();});
  row.append(check,input,del);items.append(row);
 }
 updateWords();
}
async function addKeywordGroup(){
 const input=$('newKeywordGroupName'),name=input.value.trim().replace(/\s+/g,' ');
 if(!name){input.focus();return;}
 if(keywordGroups.some(g=>g.name===name)){activeKeywordGroupId=keywordGroups.find(g=>g.name===name).id;input.value='';renderKeywordGroups();return;}
 const group={id:uid('group'),name:name.slice(0,30),selected:true,items:[{id:uid('item'),text:name.slice(0,40),enabled:true}]};
 keywordGroups.push(group);activeKeywordGroupId=group.id;input.value='';await saveKeywordGroups();renderKeywordGroups();
}
async function addKeywordItem(){
 const group=keywordGroups.find(g=>g.id===activeKeywordGroupId),input=$('newKeywordItem');
 if(!group)return;
 const text=input.value.trim().replace(/\s+/g,' ');
 if(!text){input.focus();return;}
 if(!group.items.some(x=>x.text===text))group.items.push({id:uid('item'),text:text.slice(0,40),enabled:true});
 input.value='';await saveKeywordGroups();renderKeywordGroups();input.focus();
}

// Geographic words left in the title generator are preserved but must not be
// used for a different province. This is NOT a silent edit of the user's titles.
const provinceAliases=[
 ['서울',['서울','서울특별시']],['부산',['부산','부산광역시']],
 ['대구',['대구','대구광역시']],['인천',['인천','인천광역시']],
 ['광주',['광주','광주광역시']],['대전',['대전','대전광역시']],
 ['울산',['울산','울산광역시']],['세종',['세종','세종특별자치시']],
 ['경기',['경기','경기도']],['강원',['강원','강원도','강원특별자치도']],
 ['충북',['충북','충청북도']],['충남',['충남','충청남도']],
 ['전북',['전북','전라북도','전북특별자치도']],['전남',['전남','전라남도']],
 ['경북',['경북','경상북도']],['경남',['경남','경상남도']],
 ['제주',['제주','제주도','제주특별자치도']]
];
function provinceOf(word){
 const value=String(word||'').trim(),compact=value.replace(/\s+/g,''),first=value.split(/\s+/)[0]||'';
 if(compact==='충북소도시')return '충북';
 if(compact==='충남소도시')return '충남';
 for(const [key,aliases] of provinceAliases)if(aliases.includes(value)||aliases.includes(first))return key;
 return null;
}
function foreignRegionKeywords(){
 const expected=new Set((context.regions||[]).map(provinceOf).filter(Boolean));
 if(!expected.size)return [];
 return (context.keywords||[]).filter(word=>{
   const region=provinceOf(word);return region&&!expected.has(region);
 });
}
function regionKeywordWords(){
 const regionWords=(context.regions||[]).map(word=>provinceOf(word)||String(word||'').trim()).filter(Boolean);
 const districtWords=split($('districts').value).filter(word=>!ambiguousDistricts.has(word));
 return [...new Set([...regionWords,...districtWords])];
}
function keywords(){
 return [...new Set([...selectedGroupWords(),...regionKeywordWords()])];
}
function updateWords(){
 $('titleKeywords').textContent=context.keywords.length?
 context.keywords.join(', ')+' · 제목 생성 '+(context.titlesCount||0)+'개 · 제목 전용':'제목 생성기에서 제목을 만들면 여기에 표시됩니다.';
 const groupWords=selectedGroupWords(),regionWords=regionKeywordWords(),list=keywords(),long=list.filter(x=>[...x].length>10);
 const selectedNames=keywordGroups.filter(g=>g.selected).map(g=>g.name);
 $('keywordSummary').textContent='대키워드 '+(selectedNames.length?selectedNames.join(', '):'미선택')+
    ' · 하부키워드 '+groupWords.length+'개 + 지역키워드 '+regionWords.length+'개 → 총 '+list.length+'개'+
    (long.length?' / 10자 초과: '+long.join(', '):'')+' / 고정 제외어: '+exclusion.join(', ');
 const foreign=foreignRegionKeywords();
 $('keywordPreview').textContent=(foreign.length
   ?'지역 불일치 제목키워드 감지: '+foreign.join(', ')+'\n제목 생성기에서 지역을 확인해 주세요.\n\n'
   :'')+(list.length?list.join(' · '):'전송할 생성 키워드가 없습니다.');
 $('keywordPreview').className='status'+(foreign.length?' err':'');
}
async function titleSync(){
 try{
 const val=(await chrome.storage.local.get('timoTitleContext')).timoTitleContext;
 if(val&&Array.isArray(val.keywords)){
 context={
  keywords:val.keywords.filter(x=>typeof x==='string'),
  districts:Array.isArray(val.districts)?val.districts:[],
  regions:Array.isArray(val.regions)?val.regions.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean):[],
  updatedAt:typeof val.updatedAt==='string'?val.updatedAt:'',
  titlesCount:val.titlesCount||0,
  uniqueComplexCount:Number.isSafeInteger(val.uniqueComplexCount)&&val.uniqueComplexCount>0?val.uniqueComplexCount:null
};
 // Only a NEW title generation refreshes the regional districts. Reopening
 // the same generation preserves manual corrections made in this settings UI.
 if(context.regions.length && context.updatedAt){
   const syncKey='timoRegionContextSyncedAt';
   const last=(await chrome.storage.local.get(syncKey))[syncKey];
   if(context.updatedAt!==last){
     $('districts').value=context.districts.join(', ');
     await save(true);
     await chrome.storage.local.set({[syncKey]:context.updatedAt});
   }
 }else if(!$('districts').value.trim()&&context.districts.length){
   $('districts').value=context.districts.join(', ');
   await save(true);
 }
 }
 $('selectedRegions').textContent=context.regions.length
   ?context.regions.join(', ')+' (제목 생성기에서 불러옴)'
   :'선택한 배포지역 정보를 확인할 수 없습니다. 제목 생성기에서 제목을 다시 생성해 주세요.';
 const count=context.uniqueComplexCount;
 if(Number.isSafeInteger(count)&&count>0&&count<=100000){
   $('dailyLimit').value=String(count);
   prefs.dailyLimit=String(count);
   $('limitSummary').textContent='고유 단지 '+count.toLocaleString('ko-KR')+'개 → 하루 제한 '+count.toLocaleString('ko-KR')+
     '건 / 전체 제한 '+count.toLocaleString('ko-KR')+'건 (생성 제목 '+context.titlesCount.toLocaleString('ko-KR')+'개와 별도)';
 }else{
   $('dailyLimit').value='';
   prefs.dailyLimit='';
   $('limitSummary').textContent='고유 단지 수를 확인할 수 없습니다. 제목 생성 탭에서 조건 확정 후 제목을 다시 생성해 주세요.';
 }
 updateWords();
 }catch(e){note('E_TITLE_SYNC · 제목 키워드 읽기 실패: '+e.message,true,'E_TITLE_SYNC');}
}
function buildCampaignName(regions,districts,clock=new Date()){
 const list=[...new Set((districts||[]).map(s=>String(s).trim()).filter(x=>/^[가-힣]{1,12}(시|군|구)$/.test(x)))];
 if(!list.length)throw Error('E_CAMPAIGN_DISTRICT · 캠페인명에 사용할 시군구를 확인하지 못했습니다. 제목 생성기에서 다시 생성해 주세요.');
 const provinceKeys=[...new Set((regions||[]).map(provinceOf).filter(Boolean))];
 const majorRaw=provinceKeys[0]||String((regions||[])[0]||'').trim();
 const map={'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천',
  '광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종',
  '경기도':'경기','강원특별자치도':'강원','충청북도':'충북','충청남도':'충남',
  '전북특별자치도':'전북','전라북도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주'};
 const major=(map[majorRaw]||majorRaw.replace(/\s+/g,'')).replace(/[^가-힣0-9]/g,'');
 if(!major)throw Error('E_CAMPAIGN_REGION · 제목 생성기에서 선택한 지역이 없습니다.');
 const regionSuffix=provinceKeys.length>1?'외'+(provinceKeys.length-1)+'지역':'';
 const districtPart=list.slice(0,2).join('-')+(list.length>2?'외'+(list.length-2)+'곳':'');
 const two=n=>String(n).padStart(2,'0');
 const stamp=''+clock.getFullYear()+two(clock.getMonth()+1)+two(clock.getDate())+'_'+two(clock.getHours())+two(clock.getMinutes());
 return (major+regionSuffix+'_'+districtPart+'_'+stamp).slice(0,85);
}
function validURL(url){
 try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)&&!!u.hostname;}catch{return false;}
}
function otherUrls(){
 return [...new Set(String(prefs.otherUrls||'').split(/\r?\n|[,，]/).map(x=>x.trim()).filter(Boolean))];
}
async function validate(){
 takeForm();const problems=[],push=(code,msg,fix)=>problems.push(code+' · '+msg+'\n해결: '+fix);
 if(!context.regions.length)push('E_REGION_MISSING','제목 생성기의 배포지역 선택 정보가 없습니다.','지역을 선택하고 제목을 다시 생성해 주세요.');
 if(!Number.isSafeInteger(context.uniqueComplexCount)||context.uniqueComplexCount<=0||context.uniqueComplexCount>100000)
 push('E_UNIQUE_COUNT','조건에 맞는 고유 단지 수를 확인할 수 없습니다.','제목 생성기에서 제목을 다시 생성해 주세요.');
 if(context.uniqueComplexCount&&prefs.dailyLimit!==String(context.uniqueComplexCount))
 push('E_QUOTA_MISMATCH','하루 제한이 고유 단지 수와 다릅니다.','키워드 다시 읽기를 실행해 주세요.');
 const foreign=foreignRegionKeywords();
 if(foreign.length)push('E_FOREIGN_REGION_KEYWORD','선택 지역과 맞지 않는 제목 키워드: '+foreign.join(', '),'제목 생성기의 키워드를 수정하고 제목을 다시 생성하세요.');
 const urls=split(prefs.placeUrls);
 if(!urls.length||urls.some(u=>!validURL(u)))push('E_PLACE_URL','플레이스 주소 누락/오류','실제 플레이스 URL을 줄마다 입력하세요.');
 const extraUrls=otherUrls();
 if(!extraUrls.length)push('E_OTHER_URL_EMPTY','기타 URL이 없습니다.','기타 URL 목록에 한 줄 이상 입력하세요.');
 const badUrls=extraUrls.filter(u=>!validURL(u));
 if(badUrls.length)push('E_OTHER_URL','기타 URL 오류: '+badUrls.join(', '),'각 줄을 http:// 또는 https:// 전체 주소로 입력하세요.');
 if(prefs.dailyLimit&&(!/^\d+$/.test(prefs.dailyLimit)||+prefs.dailyLimit<1||+prefs.dailyLimit>100000))
 push('E_DAILY_LIMIT','하루 제한 오류','1~100000 범위의 숫자만 입력하세요.');
 const words=keywords(),long=words.filter(s=>[...s].length>10);
 if(!context.keywords.length||!split(prefs.districts).length)push('E_KEYWORDS','제목 생성 결과 또는 시군구 없음','제목을 생성하고 시군구를 확인하세요.');
 if(!selectedGroupWords().length)push('E_GEN_KEYWORD_GROUP','선택된 생성 키워드 묶음이 없습니다.','샷시교체 등 사용할 대키워드 묶음을 하나 이상 체크하세요.');
 if(long.length)push('E_KEYWORD_LIMIT','10자 초과: '+long.join(', '),'각 키워드를 10자 이내로 수정하세요. 자동으로 자르지 않습니다.');
 const bad=words.filter(x=>exclusion.some(w=>x.includes(w)));
 if(bad.length)push('E_EXCLUDED','고정 제외어 포함: '+bad.join(', '),'대출·이자 문구를 키워드에서 빼세요.');
 for(const key of keys){
  const h=handles[key];if(!h){
   if(key==='titles')continue;
   const savedPath=folderPath(key);
   push('E_MISSING_'+key,key+' 미연결'+(savedPath?' · 저장 경로 '+savedPath:''),
     savedPath?'고정 경로는 기억되어 있습니다. [폴더 선택 / 변경]에서 실제 폴더 접근만 다시 연결하세요.':'폴더를 선택해 주세요.');
   continue;
  }
  const p=await permission(h);
  if(p!=='granted'){push('E_PERMISSION_'+key,key+' 파일 권한 없음','[접근 권한 다시 확인]을 누르세요.');continue;}
  try{
    const fs=await files(key);
    if(key==='images'&&fs.length!==39)push('E_IMAGE_COUNT','리소스 이미지 '+fs.length+'장','선택한 폴더의 최상위에 39장의 JPG/PNG 이미지를 준비하세요.');
    if(key==='references'&&!fs.length)push('E_REFERENCES','참고원고 없음','TXT/DOC/DOCX 파일을 폴더에 넣으세요.');
    if(key==='titles'&&fs.length!==1)push('E_TITLES','제목 엑셀 오류','제목 생성기의 XLSX 파일을 선택하세요.');
  }catch(e){push('E_FILES_'+key,'파일 읽기 실패: '+e.message,'파일/폴더 위치와 접근 권한을 확인하세요.');}
 }
 if(problems.length){
  problems.forEach(p=>logs.push({time:new Date().toISOString(),code:'PREFLIGHT',message:p}));
  $('diagnostic').textContent=problems.join('\n\n');
  note('사전 검사 실패 ('+problems.length+'건)\n\n'+problems.join('\n\n'),true,'PREFLIGHT');
  return false;
 }
 note('사전 검사 통과: 이미지 39장, 참고원고, 플레이스 주소 '+urls.length+'개, 생성 키워드 '+words.length+'개 확인.\n티모 사이트에 업로드/등록됐다는 뜻은 아닙니다.');
 return true;
}
function downloadLogs(){
 const body=JSON.stringify({version:'0.5.3',date:new Date().toISOString(),logs},null,2);
 const u=URL.createObjectURL(new Blob([body],{type:'application/json'}));
 const a=document.createElement('a');a.href=u;a.download='TIMO_ERROR_LOG_'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);
}
async function init(){
 try{
  try{if(navigator.storage?.persist)await navigator.storage.persist();}catch{}
  const all=await chrome.storage.local.get([K,HM]);
  const s=all[K];
  if(s&&typeof s==='object'){
    prefs={...prefs,...s};
    if(!String(prefs.otherUrls||'').trim()){
      const legacy=String(s.otherUrl||'').trim();
      prefs.otherUrls=legacy&&legacy!=='https://windowking.pages.dev/'?
        [...new Set([legacy,...DEFAULT_OTHER_URLS.split(/\n/).filter(Boolean)])].join('\n'):
        DEFAULT_OTHER_URLS;
    }
  }
  let localMeta=null;try{localMeta=JSON.parse(localStorage.getItem(HM)||'null');}catch{}
  handleMeta=(all[HM]&&typeof all[HM]==='object'?all[HM]:(localMeta&&typeof localMeta==='object'?localMeta:{}));
  if(!prefs.newGenType)prefs.newGenType='참고원고 기반 생성';loadForm();
  await loadKeywordGroups();renderKeywordGroups();
  for(const k of keys){
   try{
    let h=await get(k);
    if(!h)h=await backupGet('handle:'+k);
    if(h){
      handles[k]=h;
      try{await put(k,h);}catch{}
      await backupPut('handle:'+k,h);
      await saveHandleMeta(k,h);
    }
    await renderHandle(k);
   }catch(e){
    await renderHandle(k);
    note('E_FOLDER_LOAD · '+k+' 정보 확인 실패: '+e.message,true,'E_FOLDER_LOAD');
   }
  }
  await titleSync();
 }catch(e){note('E_INIT · 이전 설정 불러오기 실패: '+e.message,true,'E_INIT');}
}
for(const k of keys){
 const label=k[0].toUpperCase()+k.slice(1);
 $('pick'+label).addEventListener('click',()=>pick(k));
 $('allow'+label).addEventListener('click',()=>allow(k));
}
for(const id of Object.keys(prefs)){
 const node=$(id);if(!node)continue;
 node.addEventListener('change',()=>{save(true);updateWords();if(id==='imagesPath')renderHandle('images');if(id==='referencesPath')renderHandle('references');});
}
for(const id of ['imagesPath','referencesPath']){
 let timer=null;
 $(id).addEventListener('input',()=>{
  clearTimeout(timer);
  timer=setTimeout(()=>{save(true);renderHandle(id==='imagesPath'?'images':'references');},250);
 });
}
$('save').addEventListener('click',async()=>{await save();await saveKeywordGroups();});
$('addKeywordGroup').addEventListener('click',addKeywordGroup);
$('newKeywordGroupName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addKeywordGroup();}});
$('addKeywordItem').addEventListener('click',addKeywordItem);
$('newKeywordItem').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addKeywordItem();}});
$('deleteKeywordGroup').addEventListener('click',async()=>{
 const group=keywordGroups.find(g=>g.id===activeKeywordGroupId);if(!group)return;
 if(!confirm('대키워드 "'+group.name+'" 묶음을 삭제할까요?'))return;
 keywordGroups=keywordGroups.filter(g=>g.id!==group.id);activeKeywordGroupId=keywordGroups[0]?.id||'';await saveKeywordGroups();renderKeywordGroups();
});
$('refreshTitle').addEventListener('click',titleSync);
$('validate').addEventListener('click',validate);
$('exportLogs').addEventListener('click',downloadLogs);
$('openTimo').addEventListener('click',()=>chrome.tabs.create({url:'https://xn--v52b175b.site/posts/places'}));
// First run is intentionally non-committing: no click on [저장] / [진행].
let staging=false;
const waitTabReady=(id,limit=25000)=>new Promise(async(resolve,reject)=>{
 let finished=false;
 let timeout=null;
 function end(error){if(finished)return;finished=true;clearTimeout(timeout);chrome.tabs.onUpdated.removeListener(onUpdate);error?reject(error):resolve();}
 function onUpdate(tabId,change){if(tabId===id&&change.status==='complete')end();}
 chrome.tabs.onUpdated.addListener(onUpdate);
 timeout=setTimeout(()=>end(new Error('E_PAGE_LOAD · 티모 화면 로딩이 25초를 초과했습니다.')),limit);
 try{const tab=await chrome.tabs.get(id);if(tab.status==='complete')end();}catch(e){end(e);}
});
$('start').addEventListener('click',async()=>{
 if(staging)return;
 staging=true;$('start').disabled=true;
 try{
  // Pull the canonical address freshly from storage before starting the campaign.
  const savedAddress=(await chrome.storage.local.get(K))[K]?.placeUrls;
  if(savedAddress!==undefined){
    $('placeUrls').value=String(savedAddress);
    prefs.placeUrls=String(savedAddress);
  }
  await save(true);await titleSync();takeForm();
  // Compare the *currently visible* title-generator region with the last
  // successfully generated title context. Region edits alone must not launch
  // a campaign using old apartment counts, old district names or old titles.
  const generatorFrame=window.parent.document.getElementById('generator');
  const generatorDoc=generatorFrame?.contentDocument;
  const currentRegionField=generatorDoc?.getElementById('regions');
  if(!currentRegionField)
    throw Error('E_REGION_SOURCE · 제목 생성기의 현재 배포지역 입력칸을 찾지 못했습니다. 통합 제목 생성기를 다시 열어 주세요.');
  const currentRegions=split(currentRegionField.value);
  const storedRegions=context.regions||[];
  const regionKey=list=>[...new Set(list.map(x=>String(x).trim()).filter(Boolean))].sort().join('|');
  if(!currentRegions.length)
    throw Error('E_REGION_EMPTY · 제목 생성기의 배포지역이 비어 있습니다. 지역을 선택하세요.');
  if(regionKey(currentRegions)!==regionKey(storedRegions))
    throw Error('E_REGION_STALE · 현재 제목 생성기 배포지역 ['+currentRegions.join(', ')+']과 마지막 제목 생성 결과 ['+storedRegions.join(', ')+']가 다릅니다. 제목 생성 탭에서 [대상 단지 추출 · 제목 생성]을 다시 눌러 새 지역으로 생성해 주세요.');
  // Only the matched complexes' districts are safe to use as the default.
  // If a manually retained district list diverges, stop before naming a
  // campaign using another area's past input.
  if(regionKey(split(prefs.districts))!==regionKey(context.districts||[]))
    throw Error('E_DISTRICT_STALE · 현재 배포 설정 시군구 ['+split(prefs.districts).join(', ')+']와 제목 생성 결과 시군구 ['+(context.districts||[]).join(', ')+']가 다릅니다. 제목 생성 후 배포 설정의 시군구를 확인하고 수정해 주세요.');
  const placeUrls=split(prefs.placeUrls);
  if(placeUrls.length!==1)throw Error('E_PLACE_COUNT · 이번 시험은 플레이스 주소 1개만 지원합니다. 한 줄에 실제 주소 1개만 입력해 주세요.');
  const placeUrl=placeUrls[0];
  const u=new URL(placeUrl);
  if(!['http:','https:'].includes(u.protocol)||!(/(^|\.)naver\.com$/.test(u.hostname)||/(^|\.)naver\.me$/.test(u.hostname)))
    throw Error('E_PLACE_URL · 네이버 플레이스 주소인지 확인하세요.');
  if(!context.regions.length)throw Error('E_REGION_MISSING · 제목 생성기에서 배포지역을 선택하고 제목을 다시 생성해 주세요.');
  const unique=context.uniqueComplexCount;
  if(!Number.isSafeInteger(unique)||unique<=0||unique>100000)
    throw Error('E_UNIQUE_COUNT · 제목 생성기의 조건별 고유 단지 수를 확인할 수 없습니다. 다시 생성해 주세요.');
  if(prefs.dailyLimit!==String(unique))
    throw Error('E_QUOTA_MISMATCH · 제한값과 고유 단지 수가 다릅니다. 다시 읽기를 실행해 주세요.');
  const foreign=foreignRegionKeywords();
  if(foreign.length)throw Error('E_FOREIGN_REGION_KEYWORD · 선택 배포지역 ['+context.regions.join(', ')+']에 맞지 않는 제목 생성기 키워드 ['+foreign.join(', ')+']가 있습니다. 제목 생성기에서 수정 후 다시 생성하세요.');
  const words=keywords();
  if(!context.keywords.length)throw Error('E_TITLE_CONTEXT · 제목 생성기에서 제목을 먼저 생성하세요. 이후 [키워드 다시 읽기]를 누르세요.');
  if(!selectedGroupWords().length)throw Error('E_GEN_KEYWORD_GROUP · 생성시 포함할 대키워드 묶음을 하나 이상 선택하세요.');
  if(!split(prefs.districts).length)throw Error('E_DISTRICT · 시·군·구 키워드를 확인하세요.');
  if(words.some(w=>[...w].length>10))
    throw Error('E_KEYWORD_LIMIT · 티모 10자 제한을 초과했습니다: '+words.filter(w=>[...w].length>10).join(', '));
  if(words.some(w=>exclusion.some(x=>w.includes(x))))
    throw Error('E_EXCLUDED · 생성 키워드에 고정 제외어 대출 또는 이자가 포함되어 있습니다.');
  const extraUrls=otherUrls();
  if(!extraUrls.length)throw Error('E_OTHER_URL_EMPTY · 기타 URL을 하나 이상 입력하세요.');
  const invalidUrls=extraUrls.filter(u=>!validURL(u));
  if(invalidUrls.length)throw Error('E_OTHER_URL · 기타 URL 형식 오류: '+invalidUrls.join(', '));
  if(prefs.dailyLimit&&(!/^\d+$/.test(prefs.dailyLimit)||+prefs.dailyLimit<1||+prefs.dailyLimit>100000))
    throw Error('E_DAILY_LIMIT · 하루 발행 제한 값을 확인하세요.');
  const type=prefs.newPostType||'',genType=prefs.newGenType||'참고원고 기반 생성';
  if(!confirm(
    '새 티모 배포 설정 자동입력 시험\n\n캠페인명: '+buildCampaignName(context.regions,context.districts)+'\n플레이스: '+placeUrl+
    '\n배포지역: '+context.regions.join(', ')+
    '\n생성 키워드: '+words.join(', ')+
    '\n기타 URL '+extraUrls.length+'개: '+extraUrls.join(', ')+
    '\n제목 템플릿: 미등록 (생성한 제목을 별도로 연결해야 함)'+
    '\n배포 유형: '+(type||'티모 선택 유지')+
    '\n원고 방식: '+(genType||'티모 선택 유지')+
    '\n\n[등록]부터 자동으로 입력하지만 마지막 [저장]과 [진행]은 누르지 않습니다. 실행할까요?'))return;
  const campaignName=buildCampaignName(context.regions,context.districts);
  const config={placeUrl,campaignName,keywords:words,type,genType,
    dailyLimit:String(unique),postLimit:String(unique),uniqueComplexCount:unique,
    deploymentRegions:[...context.regions],
    otherUrls:[...extraUrls],requestedAt:new Date().toISOString()};
  await chrome.storage.local.set({timoNewCampaignPendingV1:config});
  note('새 배포 시험 중: 티모 목록 열기 → [등록] → [조회] → 기본설정 → [저장] 직전 대기');
  const tab=await chrome.tabs.create({url:'https://xn--v52b175b.site/posts/places',active:true});
  await waitTabReady(tab.id);
  // The wizard is packaged as an extension file and returns only a stage result.
  const result=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['timo-new-campaign.js']});
  const outcome=result?.[0]?.result;
  if(!outcome)throw Error('E_RESULT · 티모 화면에서 실행 결과가 돌아오지 않았습니다. 시험용 탭을 확인하세요.');
  if(outcome.ok&&outcome.code==='STAGED'){
    await chrome.storage.local.set({timoNewCampaignStagedV1:{tabId:tab.id,placeUrl,created:false,stagedAt:new Date().toISOString()}});
    note('STAGED · '+outcome.message+'\n\n확인됨: 플레이스 조회 및 기본설정 입력 단계까지 도달\n아직 미검증: 저장 후 기타 URL 지속 여부\n미실행: [저장], [진행], 이미지·원고·제목 템플릿 업로드\n\n저장만 눌러서는 생성 제목이 티모에 등록되지 않습니다. 제목 템플릿을 별도로 확인해야 합니다.');
  }else{
    throw Error((outcome.code||'E_STEP')+' · '+(outcome.stage||'알 수 없는 단계')+' · '+(outcome.message||'입력 실패'));
  }
 }catch(e){note('신규 배포 시험 중단: '+e.message+'\n\n티모 테스트 탭을 확인하고, 오류 기록을 내려받아 보내주세요.',true,'E_NEW_CAMPAIGN');}
 finally{staging=false;$('start').disabled=false;}
});

// Single source of truth for the place URL. Title generator edits the URL.
$('editPlaceUrl').addEventListener('click',()=>{
  try{
    const top=window.parent.document;
    const tab=top.getElementById('tabGenerator');
    if(!tab)throw Error('통합 제목 생성기 탭을 찾지 못했습니다.');
    tab.click();
    const input=top.getElementById('generator')?.contentDocument?.getElementById('placeUrl');
    if(input){input.scrollIntoView({block:'center',behavior:'smooth'});input.focus();}
  }catch(error){note('E_PLACE_EDIT · '+error.message,true,'E_PLACE_EDIT');}
});
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local'||!changes[K])return;
  const value=String(changes[K].newValue?.placeUrls||'');
  if($('placeUrls').value!==value)$('placeUrls').value=value;
  prefs.placeUrls=value;
});

// Region edits always happen in the existing title generator to avoid duplicate settings.
$('editRegion').addEventListener('click',()=>{
  try{
    const outer=window.parent.document;
    const button=outer.getElementById('tabGenerator');
    if(!button)throw Error('통합 제목 생성기 탭을 찾지 못했습니다.');
    button.click();
    const input=outer.getElementById('generator')?.contentDocument?.getElementById('regions');
    if(input){input.scrollIntoView({block:'center',behavior:'smooth'});input.focus();}
  }catch(e){note('E_REGION_EDIT · '+e.message,true,'E_REGION_EDIT');}
});
// Switching to the deployment tab after building new titles refreshes the region and count.
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.timoTitleContext)titleSync();
});

// TIMO 0.6.0 — explicit, per-resource transfer after a newly created
// campaign was SAVED. No deletion, no publish, no unverified success claim.
const transferTag='TIMO_TRANSFER_V060';
let transferBusy=false;
const kindSpecs={
 images:{path:'images',label:'리소스 이미지',max:39},
 references:{path:'references',label:'참고원고',max:60},
 titles:{path:'templates',label:'제목 템플릿',max:1}
};
const statusAsset=(message,bad=false)=>{
 $('assetStatus').className='status'+(bad?' err':'');
 $('assetStatus').textContent=message;
 if(bad){logs.push({time:new Date().toISOString(),code:'E_ASSET_TRANSFER',message});}
};
// v0.6.2 SAFETY: never select an arbitrary open campaign as a destination.
// A browser tab does not establish that the campaign was just created.
const discoverCampaign=async()=>{
 // READ-ONLY correlation with the exact tab opened by this new-campaign run.
 // Do not reuse an arbitrary tab or treat a matching row as save-response proof.
 $('campaignId').value='';
 const state=await chrome.storage.local.get(['timoNewCampaignPendingV1','timoNewCampaignStagedV1']);
 const pending=state.timoNewCampaignPendingV1,staged=state.timoNewCampaignStagedV1;
 if(!pending?.campaignName||!staged?.tabId)
   throw Error('E_CAMPAIGN_TRACE_MISSING · 이번 확장프로그램에서 시작한 신규 캠페인 기록이 없습니다. 먼저 신규 배포 설정 시험을 실행하세요.');
 if(staged.created!==false||staged.placeUrl!==pending.placeUrl)
   throw Error('E_CAMPAIGN_TRACE_CHANGED · 시작 기록과 저장 대기 기록이 일치하지 않습니다.');
 let tab;try{tab=await chrome.tabs.get(staged.tabId);}
 catch{throw Error('E_ORIGINAL_TAB_CLOSED · 새 배포를 시작했던 티모 탭이 닫혀 있어 저장 결과를 대조할 수 없습니다.');}
 const url=new URL(tab.url||'about:blank');
 if(!['xn--v52b175b.site','www.xn--v52b175b.site'].includes(url.hostname)
    ||url.pathname!=='/posts/places')
   throw Error('E_LIST_NOT_OPEN · 신규 캠페인 시험에서 열린 티모 탭이 배포 목록으로 돌아오지 않았습니다. 저장 결과를 확인할 수 없습니다.');
 const inspected=await chrome.scripting.executeScript({
   target:{tabId:staged.tabId},
   func:(expected)=>{
     if(location.pathname!=='/posts/places')return {ok:false,code:'E_PAGE_CHANGED'};
     const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
     const rows=[...document.querySelectorAll('tbody tr')];
     // Match the *whole* campaign name inside one table cell, not substring.
     const matches=rows.filter(row=>[...row.querySelectorAll('td')]
       .some(td=>clean(td.innerText||td.textContent)===expected));
     if(matches.length!==1)return {ok:false,code:matches.length?'E_AMBIGUOUS_CAMPAIGN':'E_CAMPAIGN_NOT_ON_PAGE',
       matches:matches.length,visibleRows:rows.length};
     const row=matches[0];
     const headers=[...document.querySelectorAll('thead th')].map(th=>clean(th.innerText||th.textContent));
     const cells=[...row.querySelectorAll('td')];
     const idHeaderIndex=headers.findIndex(t=>t==='ID'||t==='아이디'||t==='번호');
     const possible=[];
     if(idHeaderIndex>=0&&cells[idHeaderIndex]){
       const c=clean(cells[idHeaderIndex].innerText||cells[idHeaderIndex].textContent);
       if(/^\d{3,12}$/.test(c))possible.push({value:c,source:'ID 열'});
     }
     const links=[...row.querySelectorAll('a[href]')];
     for(const a of links){
       try{
         const u=new URL(a.href,location.href);
         const m=u.pathname.match(/^\/posts\/places\/(\d{3,12})(?:\/|$)/);
         if(m)possible.push({value:m[1],source:'해당 행의 상세 링크'});
       }catch{}
     }
     const values=[...new Set(possible.map(x=>x.value))];
     return {ok:true,matchedCampaignName:true,visibleRows:rows.length,matchingRows:1,
       candidateId:values.length===1?values[0]:null,
       candidateSource:values.length===1?possible[0].source:null,
       idAmbiguous:values.length>1,source:'현재 티모 목록의 캠페인 이름 일치 행'};
   },
   args:[pending.campaignName]
 });
 const res=inspected?.[0]?.result;
 if(!res?.ok){
   const errorCodes={E_PAGE_CHANGED:'검사 중 화면이 바뀌었습니다.',
     E_AMBIGUOUS_CAMPAIGN:'같은 캠페인 이름을 가진 행이 여러 개 있습니다.',
     E_CAMPAIGN_NOT_ON_PAGE:'현재 목록에 이번 캠페인 이름과 완전히 일치하는 행이 없습니다. 목록 페이지 정렬 또는 검색 결과를 확인해 주세요.'};
   throw Error((res?.code||'E_SCAN_FAILED')+' · '+(errorCodes[res?.code]||'티모 목록을 읽지 못했습니다.'));
 }
 // Read-only evidence; never treat a matching row as authenticated save.
 const candidate=res.candidateId
   ?'후보 ID '+res.candidateId+' ('+res.candidateSource+')'
   :'ID 열/상세 링크에서 ID를 찾지 못했습니다.';
 const checked={campaignName:pending.campaignName,placeUrl:pending.placeUrl,
   candidateId:res.candidateId||null,candidateSource:res.candidateSource||null,
   tabId:staged.tabId,checkedAt:new Date().toISOString(),
   matchingRows:res.matchingRows,verifiedNewSave:false};
 await chrome.storage.local.set({timoCampaignListCandidateV064:checked});
 statusAsset('목록 대조 완료 (읽기 전용)\n캠페인명: '+pending.campaignName+
   '\n'+candidate+
   '\n검사 일시: '+new Date(checked.checkedAt).toLocaleString('ko-KR')+
   '\n저장 응답 미검증 · 업로드 안전 잠금 유지');

};
$('findCampaignId').addEventListener('click',()=>discoverCampaign().catch(e=>statusAsset(e.message,true)));
function readTitleWorkbook(){
 return new Promise((resolve,reject)=>{
   const req=indexedDB.open('TIMO_GENERATED_TITLE_V1',1);
   req.onerror=()=>reject(req.error||Error('제목 XLSX 저장소 읽기 실패'));
   req.onsuccess=()=>{
     const db=req.result;
     if(!db.objectStoreNames.contains('title')){db.close();reject(Error('제목을 다시 생성해 주세요.'));return;}
     const tx=db.transaction('title','readonly');
     const r=tx.objectStore('title').get('latest');
     r.onsuccess=()=>{db.close();resolve(r.result);};
     r.onerror=()=>{db.close();reject(r.error);};
   };
 });
}
async function transferFiles(kind){
 const spec=kindSpecs[kind];
 if(!spec)throw Error('E_TRANSFER_KIND · 지원하지 않는 자료 종류');
 const id=String($('campaignId').value||'').trim();
 if(!/^[0-9]{3,12}$/.test(id))throw Error('E_CAMPAIGN_ID · 저장한 신규 배포의 숫자 ID를 확인해 주세요.');
 let fs=[];
 if(kind==='titles'){
   const foreign=foreignRegionKeywords();
   if(foreign.length)throw Error('E_TITLE_REGION · 제목에 다른 지역 키워드 '+foreign.join(', ')+'가 포함되어 있습니다. 제목 생성기에서 수정 후 다시 생성하세요.');
   const result=await readTitleWorkbook();
   if(!result?.blob||!(result.blob instanceof Blob))throw Error('E_WORKBOOK_MISSING · 생성 제목 XLSX를 찾지 못했습니다. 제목 생성기에서 다시 생성해 주세요.');
   if(result.titleCount!==context.titlesCount||result.uniqueComplexCount!==context.uniqueComplexCount)
     throw Error('E_WORKBOOK_STALE · 제목 XLSX와 현재 생성기 단지/제목 수가 다릅니다. 제목을 다시 생성해 주세요.');
   const normalizeRegions=v=>[...new Set((v||[]).map(x=>String(x).trim()))].sort().join('|');
   if(normalizeRegions(result.regions)!==normalizeRegions(context.regions))
     throw Error('E_WORKBOOK_REGION · 생성 제목 파일의 배포지역이 다릅니다. 다시 제목을 생성해 주세요.');
   fs=[new File([result.blob],'TIMO_generated_titles_'+String(result.createdAt||'').slice(0,10)+'.xlsx',
     {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})];
 }else{
   const key=kind;
   if(!handles[key])throw Error('E_FOLDER_MISSING · '+spec.label+' 폴더가 실제로 연결되지 않았습니다.'+(folderPath(key)?' 저장된 경로: '+folderPath(key)+'.':'')+' [폴더 선택 / 변경]으로 접근을 연결해 주세요.');
   const p=await permission(handles[key]);
   if(p!=='granted')throw Error('E_FOLDER_PERMISSION · '+spec.label+' 폴더 접근 권한을 다시 허용하세요.');
   fs=await files(key);
   if(kind==='images'&&fs.length!==39)
     throw Error('E_IMAGE_COUNT · 리소스 이미지 39장이 필요합니다. 현재 '+fs.length+'장입니다.');
   if(kind==='references'&&fs.length<1)
     throw Error('E_REFERENCE_COUNT · 참고원고 폴더에 DOC/TXT 파일이 없습니다.');
 }
 const total=fs.reduce((sum,f)=>sum+f.size,0);
 if(total>200*1024*1024)throw Error('E_UPLOAD_SIZE · 전체 파일이 200MB를 초과합니다.');
 const pending=(await chrome.storage.local.get('timoNewCampaignPendingV1')).timoNewCampaignPendingV1;
 const name=String(pending?.campaignName||'확인 필요');
 if(!confirm('자료 등록 시험\n\n캠페인 ID: '+id+'\n최근 생성 캠페인명: '+name+
     '\n자료: '+spec.label+'\n파일: '+fs.length+'개 ('+Math.round(total/1024/1024*10)/10+' MB)\n\n기존 자료는 삭제하지 않습니다. 잘못된 ID에 보내면 기존 자료에 추가될 수 있습니다. 이 배포가 신규로 저장한 캠페인인지 직접 확인하셨습니까?'))return;
 const target='https://xn--v52b175b.site/posts/places/'+id+'/'+spec.path;
 const tab=await chrome.tabs.create({url:target,active:false});
 let loaded=false;
 for(let retries=0;retries<35;retries++){
   const state=await chrome.tabs.get(tab.id);
   if(state.status==='complete'){loaded=true;break;}
   await new Promise(resolve=>setTimeout(resolve,400));
 }
 if(!loaded)throw Error('E_TAB_LOAD · 티모 자료 화면이 열리지 않습니다.');
 // Manual-ID safety check: TiMO renders the campaign header after the tab
 // reports complete, so retry the check for up to 10 seconds. Transfer only
 // when both the exact resource path and latest campaign name are present.
 const expectedName=String(pending?.campaignName||'').trim();
 if(!expectedName)throw Error('E_CAMPAIGN_NAME_MISSING · 최근 생성 캠페인명이 없습니다. 신규 배포 설정 시험부터 다시 실행해 주세요.');
 const expectedPath='/posts/places/'+id+'/'+spec.path;
 let check=null;
 for(let attempt=1;attempt<=20;attempt++){
   const verified=await chrome.scripting.executeScript({
     target:{tabId:tab.id},
     func:(expected,pathExpected)=>{
       const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
       const bodyText=clean(document.body?.innerText||document.body?.textContent||'');
       const heading=[...document.querySelectorAll('h1,h2,h3')]
         .map(x=>clean(x.innerText||x.textContent)).join(' | ');
       return {
         ok:location.pathname===pathExpected&&(heading.includes(expected)||bodyText.includes(expected)),
         heading,path:location.pathname,ready:document.readyState,
         textSample:bodyText.slice(0,240)
       };
     },
     args:[expectedName,expectedPath]
   });
   check=verified?.[0]?.result||null;
   if(check?.ok)break;
   if(attempt<20)await new Promise(resolve=>setTimeout(resolve,500));
 }
 if(!check?.ok){
   await chrome.tabs.update(tab.id,{active:true}).catch(()=>{});
   throw Error('E_CAMPAIGN_TARGET_MISMATCH · 입력한 ID '+id+' 화면에서 최근 캠페인명 "'+
     expectedName+'"을 10초 동안 확인하지 못했습니다. 현재 경로: '+(check?.path||'확인불가')+
     ' · 화면 제목: '+(check?.heading||'없음')+' · 파일은 전송하지 않았습니다.');
 }
 statusAsset('캠페인 대상 확인 완료 · ID '+id+' · '+spec.label+' 전송을 시작합니다.');
 await chrome.scripting.executeScript({target:{tabId:tab.id},files:['timo-file-transfer.js']});
 const send=async msg=>{
   const answer=await chrome.tabs.sendMessage(tab.id,{tag:transferTag,...msg});
   if(!answer?.ok)throw Error(answer?.error||'티모 파일 전송 응답이 없습니다.');
   return answer;
 };
 const session='asset-'+Date.now()+'-'+kind;
 try{
   await send({cmd:'INIT',session,kind:spec.path,campaignId:id,
     files:fs.map(f=>({name:f.name,size:f.size,type:f.type||''}))});
   const maxChunk=256*1024;
   for(let i=0;i<fs.length;i++){
     const file=fs[i];let chunkIndex=0;
     for(let at=0;at<file.size;at+=maxChunk){
       const buffer=new Uint8Array(await file.slice(at,at+maxChunk).arrayBuffer());
       let binary='';
       for(let j=0;j<buffer.length;j+=32768)
         binary+=String.fromCharCode(...buffer.subarray(j,j+32768));
       await send({cmd:'CHUNK',session,fileIndex:i,chunkIndex:chunkIndex++,payload:btoa(binary)});
     }
     statusAsset(spec.label+' 전송 중: '+(i+1)+'/'+fs.length+'개 · 캠페인 ID '+id);
   }
   const reply=await send({cmd:'COMMIT',session});
   if(reply.state!=='FILES_SELECTED'||reply.selectedCount!==fs.length)
     throw Error('E_TRANSFER_CONFIRM · 티모의 파일 선택칸에 모두 전달되지 않았습니다.');
   statusAsset(spec.label+' '+fs.length+'개가 티모 파일 선택칸에 전달됐습니다.\n서버 등록 성공 여부는 미확인입니다. 티모 화면에서 실제 업로드 목록/건수를 확인하세요.\n캠페인 ID: '+id);
   await chrome.tabs.update(tab.id,{active:true});
 }catch(e){
   await send({cmd:'CANCEL',session}).catch(()=>{});
   throw e;
 }
}
for(const [kind,button] of [['images','uploadImageSet'],['references','uploadReferenceSet'],['titles','uploadTitleSet']]){
 $(button).addEventListener('click',async()=>{
   if(transferBusy)return;
   transferBusy=true;
   for(const id of ['uploadImageSet','uploadReferenceSet','uploadTitleSet'])$(id).disabled=true;
   try{await transferFiles(kind);}
   catch(e){statusAsset(e.message,true);}
   finally{
     transferBusy=false;
     for(const id of ['uploadImageSet','uploadReferenceSet','uploadTitleSet'])$(id).disabled=false;
   }
 });
}

function setupFolding(){
 if(new URLSearchParams(location.search).get('embedded')==='1')document.body.classList.add('embedded');
 const sections=[...document.querySelectorAll('section.panel')];
 let saved={};try{saved=JSON.parse(localStorage.getItem('timo-deploy-fold-v1')||'{}')||{};}catch{}
 sections.forEach((section,i)=>{
   const h=section.querySelector(':scope > h2');if(!h)return;
   const button=document.createElement('button');button.type='button';button.className='tm-toggle';
   const change=hidden=>{
     section.classList.toggle('tm-folded',hidden);
     button.textContent=hidden?'펼치기 ＋':'접기 −';
     button.setAttribute('aria-expanded',String(!hidden));
   };
   change(Boolean(saved[i]));
   button.addEventListener('click',()=>{
     const hidden=!section.classList.contains('tm-folded');change(hidden);
     saved[i]=hidden;try{localStorage.setItem('timo-deploy-fold-v1',JSON.stringify(saved));}catch{}
   });h.append(button);
 });
}
// v0.6.5 manual-ID trial. The user confirms the newly saved TiMO campaign ID,
 // and each upload re-checks that the target page shows the latest campaign name.
$('campaignId').value='';
$('campaignId').readOnly=false;
const syncManualCampaignId=()=>{
 const id=String($('campaignId').value||'').trim();
 const ok=/^[0-9]{3,12}$/.test(id);
 for(const key of ['uploadImageSet','uploadReferenceSet','uploadTitleSet'])$(key).disabled=!ok||transferBusy;
 if(ok)statusAsset('배포 ID '+id+' 입력됨. 업로드 직전에 캠페인명을 다시 확인합니다.');
 else statusAsset('티모에서 확인한 신규 배포 ID를 숫자로 입력하세요. ID 확인 전에는 자료를 전송하지 않습니다.');
};
$('campaignId').addEventListener('input',syncManualCampaignId);
syncManualCampaignId();
setupFolding();
init();
})();