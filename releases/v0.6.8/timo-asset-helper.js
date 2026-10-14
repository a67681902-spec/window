'use strict';
(() => {
  const hostOK=['xn--v52b175b.site','www.xn--v52b175b.site'].includes(location.hostname);
  const m=location.pathname.match(/^\/posts\/places\/(\d+)\/(images|references|templates|features)\/?$/);
  if(!hostOK||!m){alert('티모 배포의 리소스 이미지·참고원고·제목 템플릿·기능 이미지 화면에서 실행해 주세요.');return;}
  const existing=document.getElementById('timo-asset-helper-032');
  if(existing){existing.remove();return;}
  const type=m[2];
  const config={
    images:{title:'리소스 이미지 등록',hint:'기존 39장 리소스 이미지 등록에 사용하는 다중 이미지 업로드 영역입니다.',extensions:['.jpg','.png','.jpeg'],expectedMultiple:true},
    references:{title:'참고원고 등록',hint:'참고원고용 .txt, .docx, .doc 파일을 선택합니다.',extensions:['.txt','.docx','.doc'],expectedMultiple:true},
    templates:{title:'제목 템플릿 등록',hint:'제목 생성기에서 만든 Excel(.xlsx)을 업로드합니다. 필수 기재 텍스트 업로드와 다른 위치입니다.',extensions:['.xls','.xlsx','.txt'],expectedMultiple:false},
    features:{title:'기능 이미지 등록',hint:'선택 가능한 업로드 칸이 여러 개입니다. 각 목적에 맞는 칸을 골라 등록하세요. 리소스 이미지 39장 칸이 아닙니다.',extensions:[],expectedMultiple:null}
  }[type];

  const candidates=[...document.querySelectorAll('input[type="file"]')].filter(el=>!el.disabled);
  const allowed=(input,exts)=>{
    const actual=(input.accept||'').toLowerCase().replace(/\s+/g,'').split(',').filter(Boolean);
    return exts.length?exts.every(x=>actual.includes(x)):true;
  };
  const fields=type==='features'?candidates:candidates.filter(x=>allowed(x,config.extensions)&&x.multiple===config.expectedMultiple);
  const parent=document.createElement('div');
  parent.id='timo-asset-helper-032';
  parent.style.cssText='position:fixed;right:16px;top:16px;width:370px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);z-index:2147483647;box-shadow:0 10px 36px #18284655;border-radius:11px;';
  const shadow=parent.attachShadow({mode:'open'});
  shadow.innerHTML=[
    '<style>*{box-sizing:border-box}.shell{font:13px/1.55 system-ui,"Malgun Gothic",sans-serif;color:#263c5e;background:#fff;border:1px solid #bac9e1;border-radius:11px;padding:16px;max-height:calc(100vh - 32px);overflow:auto}',
    'h2{font-size:16px;margin:0 0 6px}p{color:#61748f;font-size:12px;margin:8px 0}button{font:600 13px system-ui,"Malgun Gothic",sans-serif;padding:10px 11px;border-radius:8px;border:1px solid #bbcae4;background:#eaf0fe;color:#28519a;cursor:pointer}',
    'button:disabled{opacity:.5;cursor:not-allowed}.primary{background:#2c5ddb;color:#fff;border-color:#2c5ddb}.close{float:right;background:#f1f3f7;padding:4px 9px}',
    'select{width:100%;padding:9px;border:1px solid #b7c7e2;border-radius:8px;margin:8px 0;background:#fff;color:#253754;font:inherit}',
    'button.fill{width:100%;margin-top:10px}.status{margin-top:12px;padding:10px;border-radius:8px;background:#eef4fd;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.warn{background:#fff5e4;color:#8d5d1c;border-radius:7px;padding:9px;margin:9px 0;font-size:12px}strong{color:#1a427e}</style>',
    '<div class="shell"><button type="button" id="close" class="close">닫기 ×</button>',
    '<h2>'+config.title+'</h2><p id="description"></p><div id="choice"></div>',
    '<button type="button" class="primary fill" id="pick">티모 원래 파일 선택창 열기</button>',
    '<div class="status" id="status" role="status" aria-live="polite"></div>',
    '<div class="warn">사용자가 파일을 고르면 티모 사이트가 즉시 업로드할 수 있습니다. 이 도우미는 파일 내용을 읽거나 업로드 결과를 위조하지 않으며, 삭제·저장·배포·진행 버튼을 누르지 않습니다.</div></div>'
  ].join('');
  document.body.appendChild(parent);
  const $=id=>shadow.getElementById(id);
  $('description').textContent=config.hint;
  $('close').addEventListener('click',()=>parent.remove());
  const state=$('status'),picker=$('pick');
  const describe=input=>{
    const accept=(input.accept||'').trim()||'모든 파일';
    const label=(input.closest('label')?.innerText||input.parentElement?.parentElement?.innerText||'').replace(/\s+/g,' ').trim().slice(0,50);
    return accept+' · '+(input.multiple?'여러 파일':'1개 파일')+(label?' · '+label:'');
  };
  const options=fields.map((input,index)=>({input,index,label:describe(input)}));
  let chosen=options[0]?.input;
  if(type==='features'&&options.length){
    const label=document.createElement('label');label.textContent='어느 업로드 칸에 넣을까요?';
    label.style.cssText='font-weight:700;display:block;margin-top:10px;';
    const select=document.createElement('select');select.id='targetSlot';
    options.forEach(({index,label})=>{
      const opt=document.createElement('option');opt.value=String(index);opt.textContent='칸 '+(index+1)+' — '+label;select.append(opt);
    });
    select.addEventListener('change',()=>{chosen=options[Number(select.value)]?.input;state.textContent='선택된 칸: '+describe(chosen);});
    $('choice').append(label,select);
  }
  if(!fields.length||type!=='features'&&fields.length!==1){
    picker.disabled=true;
    state.textContent='알맞은 업로드 입력칸을 '+fields.length+'개 찾았습니다. 잘못된 곳에 넣지 않도록 중단합니다. 티모 화면이 완전히 열렸는지 확인해 주세요.';
    return;
  }
  state.textContent='선택 가능한 업로드 칸 '+fields.length+'개 확인.\n'+(type==='features'?'업로드 위치를 먼저 선택하세요.':'티모의 기존 파일 선택창을 열 수 있습니다.');
  let currentInput=null,abortListener=null;
  picker.addEventListener('click',()=>{
    if(!chosen||!chosen.isConnected||chosen.disabled){
      state.textContent='티모의 입력칸이 변경되거나 비활성화됐습니다. 새로고침 후 다시 실행하세요.';return;
    }
    if(currentInput&&abortListener)currentInput.removeEventListener('change',abortListener);
    currentInput=chosen;
    abortListener=()=>{
      const count=chosen.files?.length||0;
      const mismatch=(type==='images'&&count!==39)?'\n참고: 기존 이미지 묶음은 39장으로 사용하셨습니다. 현재 선택 파일 개수를 확인하세요.':'';
      state.textContent=count+'개 파일 선택 확인 ('+describe(chosen)+').'+mismatch+
        '\n파일 선택은 확인됐지만 티모 서버 업로드 성공 여부는 해당 화면의 목록·상태로 반드시 확인하세요.';
    };
    chosen.addEventListener('change',abortListener,{once:true});
    state.textContent='파일 선택창을 엽니다. 지원 형식: '+(chosen.accept||'지정 없음')+'.';
    // Direct human click on the picker opens the original site input.
    chosen.click();
  });
})();