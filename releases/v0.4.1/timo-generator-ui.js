'use strict';
(()=>{
  // Runs inside the existing title generator (same-origin extension iframe).
  const doc=document;
  if(doc.getElementById('timo-integrated-ui-041'))return;
  const panels=[...doc.querySelectorAll('main > .panel')];
  const styles=doc.createElement('style');
  styles.id='timo-integrated-ui-041';
  styles.textContent=[
    '.tm-collapse{float:right;border:1px solid #cbd8ee;border-radius:8px;background:#f1f5ff;color:#2d50a1;padding:6px 11px;font:700 12px system-ui;cursor:pointer}',
    '.panel.tm-folded > :not(h2){display:none!important}',
    '.tm-fold-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:12px 0 4px}',
    '.tm-fold-actions button{font:700 12px system-ui;border:1px solid #bfd0ef;border-radius:7px;padding:8px 11px;color:#335b9c;background:#f1f5ff;cursor:pointer}',
    '.tm-direct{border:1px solid #aec7e7;border-radius:10px;padding:13px;margin-top:14px;background:#f3f8ff}',
    '.tm-direct button{background:#2b5ddc;border:none;border-radius:8px;color:#fff;padding:11px 15px;font:750 14px system-ui;cursor:pointer}',
    '.tm-direct button:disabled{opacity:.55;cursor:wait}',
    '.tm-direct p{font-size:12px;color:#61718a;margin:7px 0}',
    '.tm-direct-output{margin-top:9px;white-space:pre-wrap;font-size:12px;line-height:1.7;color:#365886}',
    '.tm-direct-output.tm-fail{color:#a4312b}'
  ].join('');
  doc.head.append(styles);
  const controls=doc.createElement('div');
  controls.className='tm-fold-actions';
  const foldAll=doc.createElement('button');foldAll.type='button';foldAll.textContent='항목 모두 접기';
  const unfoldAll=doc.createElement('button');unfoldAll.type='button';unfoldAll.textContent='항목 모두 펼치기';
  controls.append(foldAll,unfoldAll);
  if(panels.length)panels[0].before(controls);
  let saved={};
  try{saved=JSON.parse(localStorage.getItem('timo-panel-folds-v1')||'{}')||{};}catch{}
  function record(){
    const v={};panels.forEach((p,i)=>v['section'+i]=p.classList.contains('tm-folded'));
    try{localStorage.setItem('timo-panel-folds-v1',JSON.stringify(v));}catch{}
  }
  function set(p,btn,closed){
    p.classList.toggle('tm-folded',!!closed);
    btn.textContent=closed?'펼치기 ＋':'접기 −';
    btn.setAttribute('aria-expanded',String(!closed));
  }
  const toggles=[];
  panels.forEach((panel,i)=>{
    const heading=panel.querySelector(':scope > h2');
    if(!heading)return;
    const button=doc.createElement('button');
    button.className='tm-collapse';button.type='button';
    button.setAttribute('aria-label',heading.textContent.trim()+' 접기 또는 펼치기');
    button.addEventListener('click',()=>{set(panel,button,!panel.classList.contains('tm-folded'));record();});
    heading.append(button);toggles.push([panel,button]);
    set(panel,button,!!saved['section'+i]);
  });
  foldAll.addEventListener('click',()=>{toggles.forEach(([p,b])=>set(p,b,true));record();});
  unfoldAll.addEventListener('click',()=>{toggles.forEach(([p,b])=>set(p,b,false));record();});

  const preview=doc.getElementById('xlsxBtn');
  if(!preview)return;
  const container=doc.createElement('div');
  container.className='tm-direct';
  const title=doc.createElement('strong');
  title.textContent='티모 제목 템플릿 직접 등록 (엑셀 다운로드 불필요)';
  const intro=doc.createElement('p');
  intro.textContent='제목 생성 후 티모의 해당 배포 건 [제목 템플릿] 탭을 열어 두세요. 직접 전송은 티모 사이트의 업로드 기능을 사용합니다.';
  const send=doc.createElement('button');
  send.type='button';send.textContent='생성한 제목을 티모에 바로 등록';
  const note=doc.createElement('div');note.className='tm-direct-output';
  note.setAttribute('role','status');note.setAttribute('aria-live','polite');
  const manual=doc.createElement('p');
  manual.textContent='기존 XLSX 다운로드 버튼은 백업·수동 등록용으로 유지합니다. 자동 등록은 아직 전체 캠페인 생성까지 연결되지 않았습니다.';
  container.append(title,intro,send,note,manual);
  preview.closest('.actionbar')?.after(container);

  const report=(code,message,bad=true)=>{
    note.classList.toggle('tm-fail',bad);
    note.textContent=code+' · '+message;
  };
  const toBase64=async(blob)=>{
    const bytes=new Uint8Array(await blob.arrayBuffer());
    if(bytes.byteLength>5*1024*1024)throw Error('자동 전송 XLSX가 5MB보다 큽니다.');
    let text='';
    const block=32768;
    for(let i=0;i<bytes.length;i+=block)text+=String.fromCharCode(...bytes.subarray(i,i+block));
    return btoa(text);
  };
  function injectXlsx(encoded,name){
    if(!['xn--v52b175b.site','www.xn--v52b175b.site'].includes(location.hostname)
        || !/^\/posts\/places\/\d+\/templates\/?$/.test(location.pathname))
      return {ok:false,reason:'티모 제목 템플릿 페이지가 아닙니다.'};
    const targets=[...document.querySelectorAll('input[type="file"]')].filter(el=>{
      const formats=(el.accept||'').toLowerCase().split(',').map(x=>x.trim());
      return !el.disabled&&formats.includes('.xls')&&formats.includes('.xlsx')&&formats.includes('.txt')&&!el.multiple;
    });
    if(targets.length!==1)return {ok:false,reason:'엑셀 업로드 위치가 '+targets.length+'개 검색돼 안전상 중단했습니다.'};
    try{
      const binary=atob(encoded),data=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)data[i]=binary.charCodeAt(i);
      const file=new File([data],name,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const transfer=new DataTransfer();transfer.items.add(file);
      targets[0].files=transfer.files;
      targets[0].dispatchEvent(new Event('change',{bubbles:true}));
      return {ok:true,bytes:file.size,notice:'티모 파일 선택 입력칸에 데이터 전달 완료. 서버 업로드 결과는 티모 화면에서 확인해야 합니다.'};
    }catch(error){return {ok:false,reason:'티모 파일 선택 입력칸 설정 실패: '+error.message};}
  }
  send.addEventListener('click',async()=>{
    if(send.disabled)return;
    send.disabled=true;
    try{
      if(typeof output==='undefined'||!Array.isArray(output)||!output.length)
        throw Error('먼저 [대상 단지 추출 · 제목 생성]을 눌러 제목을 생성하세요.');
      if(typeof xlsxBlob!=='function')throw Error('기존 제목 생성기 XLSX 기능을 불러오지 못했습니다.');
      const tabs=await chrome.tabs.query({url:['https://xn--v52b175b.site/posts/places/*','https://www.xn--v52b175b.site/posts/places/*']});
      const matches=tabs.filter(t=>{
        try{return /^\/posts\/places\/\d+\/templates\/?$/.test(new URL(t.url).pathname);}catch{return false;}
      });
      if(matches.length!==1)throw Error('티모 제목 템플릿 탭이 '+matches.length+'개 열려 있습니다. 업로드할 배포 건의 템플릿 탭 하나만 열어 주세요.');
      const count=output.length,tab=matches[0];
      if(!confirm('티모 배포 건의 제목 템플릿 화면에 '+count+'개 제목을 바로 업로드합니다.\n기존 목록이 있다면 중복될 수 있습니다. 계속하시겠습니까?'))return;
      report('TIMO_UPLOAD','제목 '+count+'개를 XLSX 형식으로 변환 중…',false);
      const blob=xlsxBlob(output);
      const base64=await toBase64(blob);
      report('TIMO_UPLOAD','티모 사이트의 원래 파일 업로드 기능을 호출 중…',false);
      const response=await chrome.scripting.executeScript({
        target:{tabId:tab.id},func:injectXlsx,args:[base64,'TIMO_generated_titles_'+new Date().toISOString().slice(0,10)+'.xlsx']
      });
      const result=response[0]?.result;
      if(!result?.ok)throw Error(result?.reason||'티모에서 응답을 받지 못했습니다.');
      report('TIMO_SENT','제목 '+count+'개 파일 선택 전달 · '+result.bytes+'바이트.\n티모 화면에서 업로드 결과와 등록 건수를 확인하세요. (서버 성공 미확인)',false);
    }catch(e){report('TIMO_ERROR',e.message);}
    finally{send.disabled=false;}
  });
})();
