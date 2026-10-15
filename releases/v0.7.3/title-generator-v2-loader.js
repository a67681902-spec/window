'use strict';
const frame = document.getElementById('generator');
function attachEnhancedGenerator() {
  try {
    if (frame.dataset.enhanced === 'true') return;
    const doc = frame.contentDocument;
    if (!doc || !doc.getElementById('makeBtn')) return;
    frame.dataset.enhanced = 'true';
    const script = doc.createElement('script');
    script.src = chrome.runtime.getURL('title-generator-enhance.js');
    script.onerror = () => {
      const notice = doc.createElement('div');
      notice.textContent = '추가 기능을 불러오지 못했습니다. 크롬 확장 프로그램을 새로고침해 주세요.';
      notice.style.cssText = 'padding:14px;color:#8d2d28;background:#ffe9e5';
      doc.body.prepend(notice);
    };
    script.onload = () => {
      const patch = doc.createElement('script');
      patch.src = chrome.runtime.getURL('apartment-master-autoload.js');
      patch.onerror = () => {
        const warning=doc.createElement('div');
        warning.textContent='GitHub 데이터 연결 기능을 불러오지 못했습니다.';
        warning.style.cssText='padding:12px;background:#fff1e8;color:#823920';
        doc.body.prepend(warning);
      };
      patch.onload = () => {
        const reorder=doc.createElement('script');
        reorder.src=chrome.runtime.getURL('title-order-editor.js');
        reorder.onerror=()=>{ const note=doc.createElement('div');note.textContent='제목 순서 편집기를 읽지 못했습니다. 확장프로그램을 새로고침해 주세요.';note.style.cssText='padding:10px;background:#fff0ec;color:#a33925';doc.body.prepend(note); };
        reorder.onload=()=>{
          const integration=doc.createElement('script');
          integration.src=chrome.runtime.getURL('timo-generator-ui.js');
          integration.onerror=()=>{
            const box=doc.createElement('div');
            box.textContent='통합 UI를 불러오지 못했습니다. 확장프로그램을 새로고침하세요.';
            box.style.cssText='background:#fff0eb;color:#a43729;padding:10px';
            doc.body.prepend(box);
          };
          doc.body.appendChild(integration);
        };
        doc.body.appendChild(reorder);
      };
      doc.body.appendChild(patch);
    };
    doc.body.appendChild(script);
  } catch (error) {
    const alert = document.createElement('p');
    alert.textContent = '제목 생성기 확장 기능 로드 실패: ' + error.message;
    alert.style.cssText = 'position:fixed;top:10px;left:10px;padding:14px;background:#ffe9e5;color:#8d2d28;z-index:100';
    document.body.appendChild(alert);
  }
}
frame.addEventListener('load', attachEnhancedGenerator);
if (frame.contentDocument && frame.contentDocument.readyState === 'complete') attachEnhancedGenerator();


// v0.4.0: sync actual generator selections into the automation configuration.
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow)return;
  const d=event.data;
  if(!d||d.type!=='TIMO_TITLE_CONTEXT_V1')return;
  const norm=list=>Array.isArray(list)?[...new Set(list.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean))].slice(0,120):[];
  const next={
    keywords:norm(d.keywords),
    districts:norm(d.districts),
    regions:norm(d.regions),
    titlesCount:Number.isFinite(d.titlesCount)?Math.max(0,Math.floor(d.titlesCount)):0,
    uniqueComplexCount:Number.isSafeInteger(d.uniqueComplexCount)&&d.uniqueComplexCount>0?d.uniqueComplexCount:null,
    updatedAt:new Date().toISOString()
  };
  chrome.storage.local.set({timoTitleContext:next}).catch(e=>console.warn('TIMO title sync:',e.message));
});


// v0.5.1: One place address, shared by the title generator and deployment form.
// The generator input is the editing source; deploy form displays the same saved URL.
const TIMO_SHARED_SETTINGS='timoAutomationSettingsV1';
function bindSharedPlaceUrl(){
  const input=frame.contentDocument?.getElementById('placeUrl');
  if(!input||input.dataset.timoShared==='1')return;
  input.dataset.timoShared='1';
  let changingFromStorage=false, pending=null, previous='';
  const alertUser=message=>{
    let box=frame.contentDocument.getElementById('timo-place-sync-note');
    if(!box){
      box=frame.contentDocument.createElement('div');box.id='timo-place-sync-note';
      box.style.cssText='font-size:12px;color:#28558d;background:#edf5ff;padding:8px;border-radius:6px;margin:5px 0';
      input.parentElement.append(box);
    }
    box.textContent=message;
  };
  async function savePlace(){
    if(changingFromStorage)return;
    const url=input.value.trim();
    if(url===previous)return;
    try{
      const stored=(await chrome.storage.local.get(TIMO_SHARED_SETTINGS))[TIMO_SHARED_SETTINGS]||{};
      // Merge the one field; do not overwrite district, folder handles, keywords or URL defaults.
      await chrome.storage.local.set({[TIMO_SHARED_SETTINGS]:{...stored,placeUrls:url}});
      previous=url;
      alertUser(url?'배포 설정에도 같은 플레이스 주소가 자동 반영됩니다.':'플레이스 주소를 비웠습니다. 배포 주소도 비워집니다.');
    }catch(e){alertUser('주소 연동 실패: '+e.message);}
  }
  input.addEventListener('input',()=>{
    if(changingFromStorage)return;
    clearTimeout(pending);pending=setTimeout(savePlace,280);
  });
  input.addEventListener('change',()=>{clearTimeout(pending);savePlace();});
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local'||!changes[TIMO_SHARED_SETTINGS])return;
    const incoming=String(changes[TIMO_SHARED_SETTINGS].newValue?.placeUrls||'').trim();
    if(input===frame.contentDocument?.activeElement)return;
    if(input.value.trim()===incoming){previous=incoming;return;}
    changingFromStorage=true;
    input.value=incoming;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    changingFromStorage=false;
    previous=incoming;
  });
  chrome.storage.local.get(TIMO_SHARED_SETTINGS).then(result=>{
    const stored=String(result[TIMO_SHARED_SETTINGS]?.placeUrls||'').trim();
    const entered=input.value.trim();
    if(entered&&!stored){
      previous='';savePlace();
    }else if(!entered&&stored){
      changingFromStorage=true;
      input.value=stored;input.dispatchEvent(new Event('input',{bubbles:true}));
      changingFromStorage=false;previous=stored;
      alertUser('기존 배포 설정의 플레이스 주소를 불러왔습니다.');
    }else if(entered&&stored&&entered!==stored){
      // Existing campaigns can have different addresses; do not silently select one.
      alertUser('주의: 기존 배포 주소와 제목 생성기에 저장된 주소가 다릅니다. 사용할 주소를 수정한 뒤 이 칸에서 벗어나 확정해 주세요.');
      previous=stored;
    }else{previous=entered;}
  }).catch(e=>alertUser('저장 주소를 확인하지 못했습니다: '+e.message));
}
frame.addEventListener('load',bindSharedPlaceUrl);
if(frame.contentDocument?.readyState==='complete')bindSharedPlaceUrl();


// TIMO 0.6.0 — persist exact in-memory XLSX to IndexedDB, not chrome.storage
// quota, while retaining its origin and title counts for upload verification.
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow || event.origin!==location.origin)return;
  const d=event.data;
  if(!d||d.type!=='TIMO_GENERATED_XLSX_V1')return;
  if(!(d.blob instanceof Blob)||d.blob.size>20*1024*1024||d.blob.size<100
     ||!Number.isSafeInteger(d.titleCount)||d.titleCount<1)return;
  const request=indexedDB.open('TIMO_GENERATED_TITLE_V1',1);
  request.onupgradeneeded=()=>{
    if(!request.result.objectStoreNames.contains('title'))request.result.createObjectStore('title');
  };
  request.onerror=()=>console.warn('TIMO: title workbook storage unavailable',request.error);
  request.onsuccess=()=>{
    const db=request.result,tx=db.transaction('title','readwrite');
    tx.objectStore('title').put({
      blob:d.blob,titleCount:d.titleCount,uniqueComplexCount:d.uniqueComplexCount,
      regions:Array.isArray(d.regions)?d.regions:[],createdAt:d.createdAt
    },'latest');
    tx.oncomplete=()=>{
      db.close();
      chrome.storage.local.set({timoGeneratedWorkbookMeta:{
        titleCount:d.titleCount,uniqueComplexCount:d.uniqueComplexCount,
        regions:d.regions,createdAt:d.createdAt,bytes:d.blob.size
      }}).catch(e=>console.warn('TIMO: workbook metadata save failed',e));
    };
    tx.onerror=()=>{db.close();console.warn('TIMO: workbook store failed',tx.error);};
  };
});
