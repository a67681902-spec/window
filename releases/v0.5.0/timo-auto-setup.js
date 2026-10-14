'use strict';
(()=>{
const $=id=>document.getElementById(id),K='timoAutomationSettingsV1',DB='TIMO_HANDLES_V1';
const keys=['images','references','titles'],exclusion=['대출','이자'];
const ext={images:/\.(jpg|jpeg|png)$/i,references:/\.(txt|doc|docx)$/i,titles:/\.(xls|xlsx|txt)$/i};
let prefs={placeUrls:'',districts:'',extraKeywords:'',otherUrl:'',dailyLimit:'',newPostType:'',newGenType:''};
let context={keywords:[],districts:[],titlesCount:0},handles={};
const logs=[];
function note(message,err=false,code='INFO'){
 $('status').textContent=message;$('status').className='status '+(err?'err':'ok');
 if(err){logs.push({time:new Date().toISOString(),code,message});$('diagnostic').textContent=logs.slice().reverse().map(x=>x.time+' ['+x.code+'] '+x.message).join('\n\n');}
}
const split=s=>[...new Set(String(s||'').split(/[,，\n]/).map(x=>x.trim()).filter(Boolean))];
const db=new Promise((ok,no)=>{
 const r=indexedDB.open(DB,1);
 r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('handles'))r.result.createObjectStore('handles');};
 r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
});
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
 const out=$(key+'Name'),h=handles[key];if(!h){out.textContent='선택되지 않음';return;}
 const p=await permission(h);
 let message=h.name+' · '+(p==='granted'?'접근 허용':'다시 접근 허용 필요');
 if(p==='granted'){try{message+=' · '+(await files(key)).length+'개 파일';}catch(e){message+=' · 오류: '+e.message;}}
 out.textContent=message;
}
async function pick(key){
 try{
 let h;
 if(key==='titles'){
 if(!('showOpenFilePicker'in window))throw Error('파일 선택 API 미지원');
 const result=await showOpenFilePicker({multiple:false});h=result[0];
 }else{
 if(!('showDirectoryPicker'in window))throw Error('폴더 선택 API 미지원');
 h=await showDirectoryPicker({mode:'read'});
 }
 handles[key]=h;await put(key,h);await renderHandle(key);note(h.name+' 선택 저장 완료. 다음 실행에도 이 선택을 기억합니다.');
 }catch(e){if(e.name!=='AbortError')note('E_FOLDER_SAVE · 선택/저장 실패: '+e.message+'\nChrome 브라우저에서 폴더 권한을 허용한 뒤 재시도하세요.',true,'E_FOLDER_SAVE');}
}
async function allow(key){
 if(!handles[key])return note('E_FOLDER_MISSING · 먼저 폴더/파일을 선택하세요.',true,'E_FOLDER_MISSING');
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
function keywords(){return [...new Set([...context.keywords,...split($('districts').value),...split($('extraKeywords').value)])];}
function updateWords(){
 $('titleKeywords').textContent=context.keywords.length?
 context.keywords.join(', ')+' · 제목 생성 '+(context.titlesCount||0)+'개':'제목 생성기에서 제목을 만든 후 여기서 [다시 읽기]를 누르세요.';
 const list=keywords(),long=list.filter(x=>[...x].length>10);
 $('keywordSummary').textContent='생성시 포함할 키워드 '+list.length+'개'+(long.length?' / 10자 초과: '+long.join(', '):'')+
 ' / 고정 제외어: '+exclusion.join(', ');
}
async function titleSync(){
 try{
 const val=(await chrome.storage.local.get('timoTitleContext')).timoTitleContext;
 if(val&&Array.isArray(val.keywords)){
 context={keywords:val.keywords.filter(x=>typeof x==='string'),districts:Array.isArray(val.districts)?val.districts:[],titlesCount:val.titlesCount||0};
 if(!$('districts').value.trim()&&context.districts.length){$('districts').value=context.districts.join(', ');await save(true);}
 }
 updateWords();
 }catch(e){note('E_TITLE_SYNC · 제목 키워드 읽기 실패: '+e.message,true,'E_TITLE_SYNC');}
}
function validURL(url){
 try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)&&!!u.hostname;}catch{return false;}
}
async function validate(){
 takeForm();const problems=[],push=(code,msg,fix)=>problems.push(code+' · '+msg+'\n해결: '+fix);
 const urls=split(prefs.placeUrls);
 if(!urls.length||urls.some(u=>!validURL(u)))push('E_PLACE_URL','플레이스 주소 누락/오류','실제 플레이스 URL을 줄마다 입력하세요.');
 if(prefs.otherUrl&&!validURL(prefs.otherUrl))push('E_OTHER_URL','기타 URL 오류','https:// 주소로 변경하세요.');
 if(prefs.dailyLimit&&(!/^\d+$/.test(prefs.dailyLimit)||+prefs.dailyLimit<1||+prefs.dailyLimit>100000))
 push('E_DAILY_LIMIT','하루 제한 오류','1~100000 범위의 숫자만 입력하세요.');
 const words=keywords(),long=words.filter(s=>[...s].length>10);
 if(!context.keywords.length||!split(prefs.districts).length)push('E_KEYWORDS','제목 키워드 또는 시군구 없음','제목을 생성하고 시군구를 확인하세요.');
 if(long.length)push('E_KEYWORD_LIMIT','10자 초과: '+long.join(', '),'각 키워드를 10자 이내로 수정하세요. 자동으로 자르지 않습니다.');
 const bad=words.filter(x=>exclusion.some(w=>x.includes(w)));
 if(bad.length)push('E_EXCLUDED','고정 제외어 포함: '+bad.join(', '),'대출·이자 문구를 키워드에서 빼세요.');
 for(const key of keys){
  const h=handles[key];if(!h){if(key==='titles')continue;push('E_MISSING_'+key,key+' 미선택','폴더 또는 파일을 선택하세요.');continue;}
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
 const body=JSON.stringify({version:'0.4.1',date:new Date().toISOString(),logs},null,2);
 const u=URL.createObjectURL(new Blob([body],{type:'application/json'}));
 const a=document.createElement('a');a.href=u;a.download='TIMO_ERROR_LOG_'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);
}
async function init(){
 try{
  const s=(await chrome.storage.local.get(K))[K];if(s&&typeof s==='object')prefs={...prefs,...s};loadForm();
  for(const k of keys){try{handles[k]=await get(k);await renderHandle(k);}catch(e){note('E_FOLDER_LOAD · '+k+' 정보 확인 실패: '+e.message,true,'E_FOLDER_LOAD');}}
  await titleSync();
 }catch(e){note('E_INIT · 이전 설정 불러오기 실패: '+e.message,true,'E_INIT');}
}
for(const k of keys){
 const label=k[0].toUpperCase()+k.slice(1);
 $('pick'+label).addEventListener('click',()=>pick(k));
 $('allow'+label).addEventListener('click',()=>allow(k));
}
for(const id of Object.keys(prefs))$(id).addEventListener('change',()=>{save(true);updateWords();});
$('save').addEventListener('click',()=>save());
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
  await save(true);await titleSync();readFields();
  const placeUrls=split(prefs.placeUrls);
  if(placeUrls.length!==1)throw Error('E_PLACE_COUNT · 이번 시험은 플레이스 주소 1개만 지원합니다. 한 줄에 실제 주소 1개만 입력해 주세요.');
  const placeUrl=placeUrls[0];
  const u=new URL(placeUrl);
  if(!['http:','https:'].includes(u.protocol)||!u.hostname.endsWith('naver.com'))
    throw Error('E_PLACE_URL · 네이버 플레이스 주소인지 확인하세요.');
  const words=keywords();
  if(!context.keywords.length)throw Error('E_TITLE_CONTEXT · 제목 생성기에서 제목을 먼저 생성하세요. 이후 [키워드 다시 읽기]를 누르세요.');
  if(!split(prefs.districts).length)throw Error('E_DISTRICT · 시·군·구 키워드를 확인하세요.');
  if(words.some(w=>[...w].length>10))
    throw Error('E_KEYWORD_LIMIT · 티모 10자 제한을 초과했습니다: '+words.filter(w=>[...w].length>10).join(', '));
  if(words.some(w=>exclusion.some(x=>w.includes(x))))
    throw Error('E_EXCLUDED · 생성 키워드에 고정 제외어 대출 또는 이자가 포함되어 있습니다.');
  if(prefs.otherUrl&&!validURL(prefs.otherUrl))throw Error('E_OTHER_URL · 기타 URL 형식 오류입니다.');
  if(prefs.dailyLimit&&(!/^\d+$/.test(prefs.dailyLimit)||+prefs.dailyLimit<1||+prefs.dailyLimit>100000))
    throw Error('E_DAILY_LIMIT · 하루 발행 제한 값을 확인하세요.');
  const type=prefs.newPostType||'',genType=prefs.newGenType||'';
  if(!confirm(
    '새 티모 배포 설정 자동입력 시험\n\n플레이스: '+placeUrl+
    '\n키워드: '+words.length+'개\n배포 유형: '+(type||'티모 선택 유지')+
    '\n원고 방식: '+(genType||'티모 선택 유지')+
    '\n\n[등록]부터 자동으로 입력하지만 마지막 [저장]과 [진행]은 누르지 않습니다. 실행할까요?'))return;
  const config={placeUrl,keywords:words,type,genType,dailyLimit:prefs.dailyLimit,otherUrl:prefs.otherUrl,requestedAt:new Date().toISOString()};
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
    note('STAGED · '+outcome.message+'\n\n성공: 플레이스 조회 및 기본 설정 화면까지 이동\n미실행: [저장], [진행], 이미지·원고·제목 업로드\n\n시험용 티모 화면의 입력값을 확인해 주세요.');
  }else{
    throw Error((outcome.code||'E_STEP')+' · '+(outcome.stage||'알 수 없는 단계')+' · '+(outcome.message||'입력 실패'));
  }
 }catch(e){note('신규 배포 시험 중단: '+e.message+'\n\n티모 테스트 탭을 확인하고, 오류 기록을 내려받아 보내주세요.',true,'E_NEW_CAMPAIGN');}
 finally{staging=false;$('start').disabled=false;}
});

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
setupFolding();
init();
})();