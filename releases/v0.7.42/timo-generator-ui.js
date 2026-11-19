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
  title.textContent='새 플레이스 배포 만들기';
  const intro=doc.createElement('p');
  intro.textContent='제목을 만들었으면 배포 설정 탭에서 플레이스 주소를 확인하고 [새 배포 1건 자동입력 시험]을 실행하세요.';
  const send=doc.createElement('button');
  send.type='button';send.textContent='새 배포 등록 설정으로 이동';
  const note=doc.createElement('div');note.className='tm-direct-output';
  note.setAttribute('role','status');note.setAttribute('aria-live','polite');
  const manual=doc.createElement('p');
  manual.textContent='제목 엑셀 다운로드는 백업용으로 유지합니다. 자동으로 새 배포를 만든 뒤 제목을 등록하는 연결은 다음 검증 단계입니다.';
  container.append(title,intro,send,note,manual);
  preview.closest('.actionbar')?.after(container);


  send.addEventListener('click',()=>{
    const button=window.parent.document.getElementById('tabDeploy');
    if(!button){note.textContent='배포 설정 탭을 열지 못했습니다. 통합 생성기에서 다시 실행하세요.';note.classList.add('tm-fail');return;}
    button.click();
    note.classList.remove('tm-fail');
    note.textContent='2. 배포 설정·오류 탭으로 이동했습니다. 플레이스 주소를 확인하고 신규 배포 시험을 시작하세요.';
  });
})();
