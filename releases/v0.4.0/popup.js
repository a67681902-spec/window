'use strict';
const FEED = 'https://raw.githubusercontent.com/a67681902-spec/window/timo-updates/releases/latest.json';
const HOST = 'com.timo.updater';
const manifest = chrome.runtime.getManifest();
const $ = id => document.getElementById(id);
$('ver').textContent = 'v' + manifest.version;
function setStatus(message, state = '') {
  $('status').textContent = message;
  $('status').className = 'notice' + (state ? ' ' + state : '');
}
function compareVersions(a, b) {
  const A = String(a).split('.').map(Number);
  const B = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (A[i] !== B[i]) return A[i] > B[i] ? 1 : -1;
  }
  return 0;
}
async function checkLatest() {
  const response = await fetch(FEED + '?timo=' + Date.now(), { cache: 'no-store' });
  if (!response.ok) throw Error('GitHub 응답 오류: ' + response.status);
  const data = await response.json();
  if (data.appId !== 'timo-title-extension' || !/^\d+\.\d+\.\d+$/.test(data.version)) throw Error('업데이트 정보를 확인할 수 없습니다.');
  $('latest').textContent = 'v' + data.version;
  return data.version;
}
$('open').addEventListener('click', () => chrome.tabs.create({url: chrome.runtime.getURL('title-generator-v2.html')}));
$('checkRelease').addEventListener('click', async () => {
  $('checkRelease').disabled = true;
  setStatus('GitHub에서 최신 버전을 확인하고 있습니다…');
  try {
    const latest = await checkLatest();
    setStatus(compareVersions(latest, manifest.version) > 0 ? `새 버전 v${latest}이 있습니다. [지금 업데이트 실행]을 눌러주세요.` : '이미 최신 버전입니다.', 'ok');
  } catch (error) {
    setStatus('확인 실패: ' + error.message + '\n인터넷 연결 또는 GitHub 접속 상태를 확인하세요.', 'err');
  } finally { $('checkRelease').disabled = false; }
});
$('updateNow').addEventListener('click', () => {
  $('updateNow').disabled = true;
  setStatus('PC 업데이트 도우미를 호출했습니다. 완료될 때까지 기다려주세요…');
  chrome.runtime.sendNativeMessage(HOST, {command:'check'}, response => {
    const error = chrome.runtime.lastError;
    $('updateNow').disabled = false;
    if (error) {
      setStatus('PC 연결 도우미를 찾을 수 없거나 실행할 수 없습니다.\n최초 1회 설치가 필요합니다. 오류: ' + error.message, 'err');
    } else if (!response || !response.ok) {
      setStatus('업데이트 확인 실패: ' + (response?.message || '응답 없음') + '\nPC의 update.log를 확인해 주세요.', 'err');
    } else {
      setStatus('업데이트 검사 완료 · PC 설치 버전 v' + response.installedVersion + '\n화면이 즉시 바뀌지 않으면 크롬 확장프로그램을 새로고침해 주세요.', 'ok');
      $('latest').textContent = 'v' + response.installedVersion;
    }
  });
});
checkLatest().then(latest => {
  setStatus(compareVersions(latest, manifest.version) > 0 ? '새 버전이 있습니다. 업데이트 버튼으로 바로 적용할 수 있습니다.' : '최신 버전을 사용 중입니다.', 'ok');
}).catch(() => { setStatus('GitHub 최신 버전 정보 확인은 버튼을 눌러 다시 시도할 수 있습니다.'); });


// TIMO 0.3.0 — user-triggered, read-only form schema inspector.
const TIMO_HOSTS = new Set(['xn--v52b175b.site','www.xn--v52b175b.site']);
$('openTimo').addEventListener('click', () => {
  chrome.tabs.create({url:'https://xn--v52b175b.site/'});
});
function inspectTimoPage() {
  // Self-contained Chrome scripting function: does not read input values,
  // cookies, localStorage, form payloads, tokens, or page scripts.
  const txt=(value,max=100)=>{
    let s=String(value||'').replace(/\s+/g,' ').trim();
    s=s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]');
    s=s.replace(/\b(?:01[016789]|0\d{1,2})[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g,'[phone]');
    return s.slice(0,max);
  };
  const isVisible=element=>{
    const st=getComputedStyle(element);
    const r=element.getBoundingClientRect();
    return st.display!=='none'&&st.visibility!=='hidden'&&(r.width>0&&r.height>0);
  };
  const css=element=>{
    if(element.id) return '#'+CSS.escape(element.id);
    const parts=[];let current=element;
    for(let i=0;current&&current.nodeType===1&&i<6;i++,current=current.parentElement){
      const tag=current.tagName.toLowerCase();
      const siblings=current.parentElement?Array.from(current.parentElement.children).filter(n=>n.tagName===current.tagName):[];
      const nth=siblings.length>1?':nth-of-type('+(siblings.indexOf(current)+1)+')':'';
      parts.unshift(tag+nth);
      if(current.id){parts[0]='#'+CSS.escape(current.id);break;}
    }
    return parts.join(' > ');
  };
  const label=element=>{
    const linked=element.labels&&element.labels.length?Array.from(element.labels).map(x=>x.innerText).join(' '):'';
    const nearest=element.closest('label')?.innerText || '';
    const aria=element.getAttribute('aria-label')||element.getAttribute('title')||'';
    return txt(linked||nearest||aria,110);
  };
  const urlPath=url=>{
    try{const u=new URL(url,location.href);return u.origin+u.pathname;}
    catch{return '';}
  };
  const nodes=Array.from(document.querySelectorAll(
    'input,textarea,select,button,[role="button"],[contenteditable="true"]'
  )).slice(0,1200);
  const fields=[],buttons=[];
  for(const node of nodes){
    const tag=node.tagName.toLowerCase(),type=tag==='input'?(node.type||'text').toLowerCase():tag;
    if(tag==='button'||node.getAttribute('role')==='button'||['button','submit','reset','image'].includes(type)){
      const t=txt(node.innerText||node.getAttribute('aria-label')||node.getAttribute('title')||'',110);
      buttons.push({selector:css(node),tag,type,label:t,visible:isVisible(node),disabled:!!node.disabled});
      continue;
    }
    if(type==='hidden')continue;
    const info={
      selector:css(node),tag,type,
      label:label(node),
      id:txt(node.id,90),
      name:txt(node.name,90),
      placeholder:txt(node.getAttribute('placeholder'),100),
      required:!!node.required,
      disabled:!!node.disabled,
      visible:isVisible(node)
    };
    if(type==='file'){
      info.accept=txt(node.accept,110);info.multiple=!!node.multiple;
    }
    if(tag==='select'){
      info.optionLabels=Array.from(node.options).slice(0,18).map(o=>txt(o.textContent,55));
      info.totalOptions=node.options.length;
      // Do not read the currently selected option.
    }
    fields.push(info);
  }
  const headings=Array.from(document.querySelectorAll('h1,h2,h3,legend'))
    .slice(0,40).map(x=>txt(x.textContent,120)).filter(Boolean);
  const links=Array.from(document.querySelectorAll('a[href]'))
    .slice(0,180).map(x=>({
      text:txt(x.innerText||x.getAttribute('aria-label'),95),
      path:urlPath(x.href)
    })).filter(x=>x.text && /배포|설정|제목|플레이스|리소스|원고|등록|신규|추가|작성/i.test(x.text)).slice(0,55);
  const frames=Array.from(document.querySelectorAll('iframe'))
    .slice(0,35).map(x=>({
      id:txt(x.id,80),name:txt(x.name,80),
      title:txt(x.title,90),srcPath:urlPath(x.getAttribute('src')||''),
      visible:isVisible(x)
    }));
  const forms=Array.from(document.forms).slice(0,25).map(form=>({
    id:txt(form.id,90),name:txt(form.name,90),
    actionPath:urlPath(form.action),method:txt(form.method,12),
    selector:css(form)
  }));
  return {
    schemaVersion:1,
    notice:'DOM structure only: NO field values, login credentials, cookies, or request bodies. No click or submission was performed.',
    hostname:location.hostname,
    pathname:location.pathname,
    pageTitle:txt(document.title,120),
    timestamp:new Date().toISOString(),
    counts:{fields:fields.length,buttons:buttons.length,frames:frames.length,forms:forms.length},
    headings,fields,buttons,links,frames,forms
  };
}
$('inspectTimo').addEventListener('click', async () => {
  const button=$('inspectTimo');button.disabled=true;
  setStatus('현재 크롬 탭의 입력 화면 구조를 확인하고 있습니다…');
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab||!tab.id)throw Error('열린 탭을 찾지 못했습니다.');
    let origin;
    try{origin=new URL(tab.url);}catch{throw Error('일반 웹사이트 탭에서만 실행할 수 있습니다.');}
    if(!TIMO_HOSTS.has(origin.hostname))throw Error('티모 사이트 탭을 먼저 열어주세요. 현재 사이트: '+origin.hostname);
    const res=await chrome.scripting.executeScript({
      target:{tabId:tab.id},func:inspectTimoPage
    });
    const map=res?.[0]?.result;
    if(!map||!Array.isArray(map.fields))throw Error('화면 요소를 읽지 못했습니다.');
    const data=JSON.stringify(map,null,2);
    const blob=new Blob([data],{type:'application/json;charset=utf-8'});
    const objectUrl=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=objectUrl;
    const now=new Date().toISOString().replace(/[:.]/g,'-');
    link.download='TIMO_FORM_MAP_'+now+'.json';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),25000);
    let msg='분석 파일 저장 요청 완료\n입력칸 '+map.counts.fields+'개 · 버튼 '+map.counts.buttons+
      '개 · iframe '+map.counts.frames+'개\n다운로드된 TIMO_FORM_MAP_*.json 파일을 이 대화에 첨부해 주세요.';
    if(map.counts.frames)msg+='\n※ iframe 안의 입력칸은 추가 확인이 필요할 수 있습니다.';
    setStatus(msg,'ok');
  }catch(error){
    setStatus('분석 실패: '+(error?.message||String(error))+
      '\n티모의 플레이스 배포 설정 화면을 현재 탭에 열고 다시 눌러주세요.','err');
  }finally{button.disabled=false;}
});


// 0.3.1 — retain TIMO's original Excel-based title-template import.
async function activeCampaign() {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id||!tab.url)throw Error('티모 사이트의 배포 화면을 먼저 열어주세요.');
  const url=new URL(tab.url);
  if(!['xn--v52b175b.site','www.xn--v52b175b.site'].includes(url.hostname))
    throw Error('티모 사이트 탭에서 실행해야 합니다.');
  const match=url.pathname.match(/^\/posts\/places\/(\d+)(?:\/|$)/);
  if(!match)throw Error('플레이스 배포에서 해당 캠페인을 먼저 선택해 주세요.');
  return {tab,url,campaignId:match[1]};
}
$('openTemplatePage').addEventListener('click',async()=>{
  const btn=$('openTemplatePage');btn.disabled=true;
  try {
    const {campaignId,url}=await activeCampaign();
    const destination=url.origin+'/posts/places/'+campaignId+'/templates';
    await chrome.tabs.create({url:destination});
    setStatus('제목 템플릿 화면을 새 탭으로 열었습니다. 화면이 열린 뒤 [제목 템플릿 엑셀 업로드]를 눌러주세요.','ok');
  }catch(e){setStatus('화면 열기 실패: '+e.message,'err');}
  finally{btn.disabled=false;}
});
$('pickTemplateExcel').addEventListener('click',async()=>{
  const btn=$('pickTemplateExcel');btn.disabled=true;
  try{
    const {tab,url}=await activeCampaign();
    if(!/^\/posts\/places\/\d+\/templates\/?$/.test(url.pathname))
      throw Error('현재 탭이 제목 템플릿 화면이 아닙니다. [현재 배포의 제목 템플릿 화면 열기]부터 실행해 주세요.');
    await chrome.scripting.executeScript({
      target:{tabId:tab.id},
      files:['timo-template-upload.js']
    });
    setStatus('티모 화면 오른쪽 위에 엑셀 업로드 안내창을 표시했습니다. 해당 화면에서 파일 선택을 진행해 주세요.','ok');
  }catch(e){setStatus('엑셀 업로드 준비 실패: '+e.message,'err');}
  finally{btn.disabled=false;}
});


// TIMO 0.3.2 — separate native upload entry points (never delete or publish).
const TIMO_ASSET_TYPES=new Set(['images','features','references','templates']);
$('openAssetTab').addEventListener('click',async()=>{
  const btn=$('openAssetTab');btn.disabled=true;
  try{
    const {url,campaignId}=await activeCampaign();
    const resource=$('timoAssetType').value;
    if(!TIMO_ASSET_TYPES.has(resource))throw Error('지원하지 않는 자료 종류입니다.');
    const destination=url.origin+'/posts/places/'+campaignId+'/'+resource;
    await chrome.tabs.create({url:destination});
    setStatus('자료 등록 화면을 새 탭에서 열었습니다. 티모 화면으로 이동한 후 [현재 화면에서 파일 선택 도우미 실행]을 눌러주세요.','ok');
  }catch(e){setStatus('화면 열기 실패: '+e.message,'err');}
  finally{btn.disabled=false;}
});
$('assistAsset').addEventListener('click',async()=>{
  const btn=$('assistAsset');btn.disabled=true;
  try{
    const {url,tab}=await activeCampaign();
    const resource=$('timoAssetType').value;
    if(!TIMO_ASSET_TYPES.has(resource))throw Error('지원하지 않는 자료 종류입니다.');
    if(!new RegExp('/'+resource+'/?$').test(url.pathname))
      throw Error('현재 화면이 선택한 자료 종류와 다릅니다. 먼저 [선택한 자료 등록 화면 열기]를 눌러주세요.');
    await chrome.scripting.executeScript({
      target:{tabId:tab.id},files:['timo-asset-helper.js']
    });
    setStatus('티모 화면에 자료별 파일 선택 도우미가 나타났습니다. 해당 화면에서 자료를 선택해 주세요.','ok');
  }catch(e){setStatus('자료 선택 도우미 실행 실패: '+e.message,'err');}
  finally{btn.disabled=false;}
});

// Open the saved local-folder and diagnostic dashboard.
$('openAutoSetup').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('timo-auto-setup.html')}));
