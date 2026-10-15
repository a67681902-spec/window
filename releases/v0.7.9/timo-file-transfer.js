'use strict';
(() => {
  const key='__TIMO_FILE_TRANSFER_V060';
  if(globalThis[key])return;
  const TAG='TIMO_TRANSFER_V060';
  let session=null;
  const pathMatch=location.pathname.match(/^\/posts\/places\/([0-9]+)\/(images|references|templates)\/?$/);
  if(!['xn--v52b175b.site','www.xn--v52b175b.site'].includes(location.hostname)||!pathMatch)return;
  const page={campaignId:pathMatch[1],kind:pathMatch[2]};
  const requirements={
    images:{extensions:['.jpg','.jpeg','.png'],multi:true,maxCount:100},
    references:{extensions:['.txt','.doc','.docx'],multi:true,maxCount:60},
    templates:{extensions:['.xls','.xlsx','.txt'],multi:false,maxCount:1}
  };
  const isAccepted=(input,config)=>{
    const ac=String(input.accept||'').toLowerCase().split(',').map(s=>s.trim());
    return !!input&&!input.disabled&&input.type==='file'&&input.multiple===config.multi&&config.extensions.every(e=>ac.includes(e));
  };
  const chooseField=()=>{
    const config=requirements[page.kind];
    const matches=[...document.querySelectorAll('input[type=file]')].filter(el=>isAccepted(el,config));
    if(matches.length!==1)throw Error('E_UPLOAD_FIELD · '+page.kind+' 업로드 대상 '+matches.length+'개. 잘못된 등록 방지를 위해 중단했습니다.');
    return matches[0];
  };
  const fail=(msg)=>({ok:false,error:String(msg||'업로드 전송 실패').slice(0,400)});
  const success=(data)=>({ok:true,...data});
  function initialize(msg){
    if(String(msg.campaignId)!==page.campaignId||msg.kind!==page.kind)
      throw Error('E_CAMPAIGN_ID · 대상 캠페인 ID가 다릅니다.');
    const config=requirements[page.kind];
    const files=msg.files;
    if(!Array.isArray(files)||!files.length||files.length>config.maxCount)throw Error('E_FILE_COUNT · 파일 개수 확인 실패');
    if(page.kind==='images'&&files.length!==39)throw Error('E_IMAGE_COUNT · 리소스 이미지가 39장이 아닙니다.');
    if(page.kind==='templates'&&files.length!==1)throw Error('E_TITLE_COUNT · 제목 엑셀은 1개만 가능합니다.');
    const fields=files.map((f,i)=>{
      const filename=String(f.name||'').trim();
      if(!filename||filename.length>200||!config.extensions.some(ext=>filename.toLowerCase().endsWith(ext)))
        throw Error('E_FILE_FORMAT · '+(i+1)+'번 파일명/형식이 올바르지 않습니다.');
      const size=Number(f.size);
      if(!Number.isSafeInteger(size)||size<1||size>30*1024*1024)
        throw Error('E_FILE_SIZE · '+filename+' 용량이 30MB를 초과하거나 잘못되었습니다.');
      return {name:filename,size,type:String(f.type||''),chunks:[],received:0};
    });
    if(fields.reduce((sum,f)=>sum+f.size,0)>200*1024*1024)
      throw Error('E_FILE_TOTAL · 전체 파일 크기가 200MB를 초과했습니다.');
    chooseField();
    session={id:String(msg.session),kind:page.kind,files:fields};
    return success({state:'READY',path:location.pathname});
  }
  function acceptChunk(msg){
    if(!session||session.id!==String(msg.session))throw Error('E_SESSION · 파일 전송 세션이 다릅니다.');
    const f=session.files[Number(msg.fileIndex)];
    if(!f||Number(msg.chunkIndex)!==f.chunks.length)
      throw Error('E_CHUNK_ORDER · 파일 조각의 순서가 맞지 않습니다.');
    const input=String(msg.payload||'');
    if(!input||input.length>780000)throw Error('E_CHUNK_SIZE · 파일 조각이 비어 있거나 너무 큽니다.');
    const decoded=atob(input);
    const bytes=new Uint8Array(decoded.length);
    for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
    f.received+=bytes.length;
    if(f.received>f.size)throw Error('E_CHUNK_OVERFLOW · 파일 크기 초과');
    f.chunks.push(bytes);
    return success({state:'RECEIVED',fileIndex:msg.fileIndex,bytes:f.received});
  }
  function commit(msg){
    if(!session||session.id!==String(msg.session))throw Error('E_SESSION · 파일 전송 세션이 다릅니다.');
    for(const f of session.files)if(f.received!==f.size)throw Error('E_INCOMPLETE · '+f.name+' 파일 미완료');
    const input=chooseField();
    const dt=new DataTransfer();
    for(const f of session.files){
      const blob=new File(f.chunks,f.name,{type:f.type||'application/octet-stream'});
      if(blob.size!==f.size)throw Error('E_REASSEMBLY · 파일 복원 크기가 다릅니다.');
      dt.items.add(blob);
    }
    // May trigger TiMO network uploads. Caller explicitly opted in.
    input.files=dt.files;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    const selected=input.files?.length||0;
    const count=session.files.length;
    session=null;
    if(selected!==count)throw Error('E_FILE_INPUT · 티모 파일 선택칸에 '+selected+'개만 표시됩니다.');
    return success({
      state:'FILES_SELECTED',selectedCount:selected,kind:page.kind,
      uploadConfirmed:false,
      message:'티모 파일 선택칸에 '+selected+'개 전달. 서버 업로드 성공 여부는 아직 확인되지 않았습니다.'
    });
  }
  chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(!msg||msg.tag!==TAG)return;
    try{
      if(msg.cmd==='INIT')sendResponse(initialize(msg));
      else if(msg.cmd==='CHUNK')sendResponse(acceptChunk(msg));
      else if(msg.cmd==='COMMIT')sendResponse(commit(msg));
      else if(msg.cmd==='CANCEL'){session=null;sendResponse(success({state:'CANCELLED'}));}
      else sendResponse(fail('알 수 없는 요청'));
    }catch(err){
      session=null;
      sendResponse(fail(err.message));
    }
    return false;
  });
  globalThis[key]=true;
})();