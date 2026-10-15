'use strict';
(() => {
  if (!/^\/posts\/places\/[0-9]+\/templates\/?$/.test(location.pathname)
      || !['xn--v52b175b.site','www.xn--v52b175b.site'].includes(location.hostname)) {
    alert('티모의 제목 템플릿 화면에서 실행해 주세요.');
    return;
  }
  const prior=document.getElementById('timo-template-upload-031');
  if (prior) {prior.remove();return;}
  const isSupported=fileInput=>{
    if(fileInput.type!=='file'||fileInput.disabled)return false;
    const extensions=(fileInput.accept||'').toLowerCase().replace(/\s/g,'').split(',');
    return ['.xls','.xlsx','.txt'].every(ext=>extensions.includes(ext));
  };
  const targets=[...document.querySelectorAll('input[type="file"]')].filter(isSupported);
  const pane=document.createElement('div');
  pane.id='timo-template-upload-031';
  pane.style.cssText='position:fixed;z-index:2147483647;top:18px;right:18px;width:360px;max-width:calc(100vw - 36px);border-radius:12px;box-shadow:0 10px 35px #17345c66';
  const shadow=pane.attachShadow({mode:'open'});
  shadow.innerHTML=[
    '<style>*{box-sizing:border-box}.panel{background:#fff;color:#263850;border:1px solid #b9cbe9;border-radius:12px;padding:16px;font:13px/1.6 system-ui,"Malgun Gothic",sans-serif;}',
    'h2{font-size:17px;margin:0 0 5px}.muted{color:#5b6d89;font-size:12px;margin:7px 0}button{cursor:pointer;padding:10px;border:1px solid #b9c9e5;border-radius:8px;background:#edf2fc;color:#2554a1;font:600 13px system-ui}',
    '.primary{background:#2e5edc;color:#fff;border-color:#2e5edc;width:100%;margin:10px 0}.close{float:right;padding:4px 9px;background:#f3f4f6}',
    '.notice{background:#f1f6ff;border-radius:7px;padding:9px;margin-top:10px;white-space:pre-wrap}.warning{background:#fff6e6;border-radius:7px;color:#805b26;padding:9px;margin-top:9px;font-size:12px}</style>',
    '<div class="panel"><button id="close" class="close" type="button">닫기 ×</button><h2>티모 제목 엑셀 업로드</h2>',
    '<p class="muted">현재 배포 건의 <b>제목 템플릿</b>에만 연결합니다.</p>',
    '<p class="muted">제목 생성기에서 내려받은 XLSX 파일을 준비해 주세요.</p>',
    '<button id="pick" type="button" class="primary">티모 업로드 파일 선택</button>',
    '<div id="status" role="status" class="notice">티모의 원래 파일 선택창을 열어 업로드합니다.</div>',
    '<div class="warning">파일을 선택하면 티모 자체 업로드가 바로 시작될 수 있습니다. 기존 제목 삭제·배포 실행·수정 완료 버튼은 자동으로 누르지 않습니다. 업로드 결과 건수는 티모 화면에서 확인해 주세요.</div>',
    '</div>'
  ].join('');
  document.body.appendChild(pane);
  const $=id=>shadow.getElementById(id);
  $('close').addEventListener('click',()=>pane.remove());
  const pick=$('pick'),status=$('status');
  if(targets.length!==1) {
    pick.disabled=true;
    status.textContent='업로드 파일 선택칸이 '+targets.length+'개 발견되어 안전하게 중단했습니다. 현재 제목 템플릿 페이지가 완전히 열렸는지 확인하세요.';
    return;
  }
  const input=targets[0];
  input.addEventListener('change',()=>{
    status.textContent='티모 입력칸에 파일이 선택됐습니다. 티모 사이트의 업로드 결과와 제목 개수를 확인해 주세요. 성공 여부는 사이트 응답으로 판단해야 합니다.';
  },{once:true});
  pick.addEventListener('click',()=>{
    if(!document.contains(input)||input.disabled) {
      status.textContent='입력칸이 바뀌었습니다. 화면 새로고침 후 다시 실행하세요.';
      return;
    }
    status.textContent='파일 선택 창을 여는 중입니다…\n지원 형식: .xlsx, .xls, .txt';
    // User gesture opens TIMO's actual upload input. No file contents are read
    // by the extension and no synthetic "upload complete" claim is made.
    input.click();
  });
})();