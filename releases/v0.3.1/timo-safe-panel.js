'use strict';
(() => {
  if (!['xn--v52b175b.site','www.xn--v52b175b.site'].includes(location.hostname)
      || !location.pathname.startsWith('/posts/places/')) {
    alert('티모 플레이스 배포 설정 화면에서 실행해 주세요.');
    return;
  }
  const prior=document.getElementById('timo-safe-031');
  if(prior){prior.remove();return;}
  const overlay=document.createElement('div');
  overlay.id='timo-safe-031';
  overlay.style.cssText='position:fixed;right:15px;top:15px;z-index:2147483647;width:365px;max-width:calc(100vw - 30px);max-height:calc(100vh - 30px);box-shadow:0 8px 26px #1b355e55;border-radius:12px';
  const shadow=overlay.attachShadow({mode:'open'});
  shadow.innerHTML=[
    '<style>*{box-sizing:border-box}.panel{font:13px/1.5 system-ui,"Malgun Gothic",sans-serif;background:#fff;color:#293953;padding:16px;border:1px solid #cdd9ec;border-radius:11px;max-height:calc(100vh - 30px);overflow:auto}',
    'h2{margin:0;font-size:17px}.desc{font-size:12px;color:#627188;margin:5px 0 12px}label{display:block;font-weight:700;margin-top:12px}',
    'input,select{font:inherit;width:100%;padding:9px;border:1px solid #bdcce2;border-radius:7px;margin-top:4px;background:white;color:#293953}',
    '.actions{display:flex;gap:7px;margin-top:15px}.actions button{flex:1}button{border:1px solid #bbceef;background:#eaf1ff;color:#285298;border-radius:7px;font:600 12px system-ui;padding:9px 8px;cursor:pointer}',
    '.primary{background:#315fe1;color:#fff;border-color:#315fe1}.close{float:right;background:#f2f3f5;border-color:#f2f3f5}',
    '.warning{background:#fff4e2;color:#805a23;padding:9px;border-radius:7px;margin-top:12px;font-size:12px}',
    '#status{background:#eef4ff;white-space:pre-wrap;padding:10px;border-radius:8px;margin-top:12px;overflow-wrap:anywhere}',
    '</style>',
    '<div class="panel"><button class="close" id="close" type="button">닫기 ×</button><h2>티모 안전 입력 도우미</h2>',
    '<p class="desc">확인된 항목만 화면에 입력합니다. 저장·배포 버튼은 자동으로 누르지 않습니다.</p>',
    '<label for="keywords">생성시 포함할 키워드 (선택)</label><input id="keywords" type="text" placeholder="예: 대구샷시, 대구창호"/>',
    '<p class="desc">각 키워드 10자 이내 · 쉼표로 구분</p>',
    '<label for="daily">하루 제한 (선택)</label><input id="daily" type="number" min="1" max="100000" placeholder="빈칸이면 변경 안 함"/>',
    '<label for="gen">원고 생성 방식</label><select id="gen"><option value="">기존 설정 유지</option><option>자동 생성</option><option>주제 기반 생성</option><option>참고원고 기반 생성</option><option>업로드 원고 사용</option></select>',
    '<label for="publish">배포 방식</label><select id="publish"><option value="">기존 설정 유지</option><option>검수 후 배포</option><option>생성 후 자동배포</option></select>',
    '<div class="warning">제목 엑셀, 플레이스 주소, 참고원고, 이미지 파일은 아직 연결 위치가 확인되지 않아 자동 입력하지 않습니다.</div>',
    '<div class="actions"><button type="button" id="apply" class="primary">화면에만 입력</button><button type="button" id="diagnose">상세 구조 JSON 저장</button></div>',
    '<div id="status" role="status">설정 입력 또는 상세 구조 분석을 선택하세요.</div>',
    '<p class="desc">기존 배포 변경 화면입니다. 입력 후 화면에서 값이 맞는지 확인해 주세요.</p></div>'
  ].join('');
  document.body.appendChild(overlay);
  const $=id=>shadow.getElementById(id);
  $('close').addEventListener('click',()=>overlay.remove());
  const terse=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,120);
  function fillText(element,value){
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    if(!setter)throw Error('입력 요소 업데이트를 지원하지 않습니다.');
    setter.call(element,value);
    element.dispatchEvent(new Event('input',{bubbles:true}));
    element.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function radio(name,word){
    const candidates=[...document.querySelectorAll('input[type="radio"][name="'+name+'"]')].filter(el=>
      !el.disabled && terse(el.closest('label')?.textContent).includes(word));
    if(candidates.length!==1)throw Error('선택 항목 "'+word+'" 확인 실패 ('+candidates.length+'개). 중단합니다.');
    return candidates[0];
  }
  $('apply').addEventListener('click',()=>{
    try{
      const words=$('keywords').value.split(/[,，\n]/).map(s=>s.trim()).filter(Boolean);
      if(words.some(w=>[...w].length>10))throw Error('각 키워드는 10자 이내입니다.');
      const changes=[];
      if(words.length){
        const found=[...document.querySelectorAll('input')].filter(e=>e.placeholder==='예) 맛집, 분위기'&&!e.disabled);
        if(found.length!==1)throw Error('생성 키워드 칸을 유일하게 식별하지 못했습니다: '+found.length);
        changes.push(()=>{fillText(found[0],words.join(', '));return '생성 키워드';});
      }
      if($('daily').value.trim()){
        const n=Number($('daily').value);
        const el=document.getElementById('dailyLimit');
        if(!Number.isInteger(n)||n<1||n>100000)throw Error('하루 제한은 1~100000 범위의 정수만 지원합니다.');
        if(!el||el.disabled)throw Error('하루 제한 입력칸을 찾지 못했습니다.');
        changes.push(()=>{fillText(el,String(n));return '하루 제한';});
      }
      const gen=$('gen').value,pub=$('publish').value;
      const gr=gen?radio('genType',gen):null,pr=pub?radio('autoPublish',pub):null;
      if(gr)changes.push(()=>{(gr.closest('label')||gr).click();return '원고 생성 방식';});
      if(pr)changes.push(()=>{(pr.closest('label')||pr).click();return '배포 방식';});
      if(!changes.length)throw Error('선택한 변경 항목이 없습니다.');
      const done=changes.map(fn=>fn());
      $('status').textContent='화면 입력 시도: '+done.join(', ')+'\n실제 반영 여부를 검토해 주세요. 수정 완료·배포 버튼은 누르지 않았습니다.';
    }catch(error){$('status').textContent='중단: '+error.message;}
  });
  function selector(e){
    if(e.id)return '#'+CSS.escape(e.id);
    const bits=[];let node=e;
    for(let depth=0;node && depth<6 && node.nodeType===1;depth++,node=node.parentElement){
      const tag=node.tagName.toLowerCase();
      const same=node.parentElement?[...node.parentElement.children].filter(x=>x.tagName===node.tagName):[];
      bits.unshift(tag+(same.length>1?':nth-of-type('+(same.indexOf(node)+1)+')':''));
    }
    return bits.join(' > ');
  }
  function attrs(e){
    return Object.fromEntries(['id','name','role','type','placeholder','aria-label','title','accept','data-testid'].map(key=>
      [key,terse(e.getAttribute(key))]).filter(([,v])=>v));
  }
  $('diagnose').addEventListener('click',()=>{
    try{
      const inputs=[...document.querySelectorAll('input,select,textarea,[role="combobox"],[role="spinbutton"],[role="textbox"],[contenteditable="true"],[class*="ant-upload"],[class*="ant-select"]')].slice(0,450);
      const fields=inputs.map((e,i)=>{
        const g=e.closest('.ant-form-item,fieldset,[role="group"],.ant-modal-body,.ant-card');
        const labels=g?[...g.querySelectorAll('.ant-form-item-label label,legend,.ant-card-head-title')].slice(0,4).map(x=>terse(x.textContent)).filter(Boolean):[];
        return {index:i,tag:e.tagName.toLowerCase(),selector:selector(e),attributes:attrs(e),groupLabels:labels,visible:!!e.getClientRects().length,disabled:!!e.disabled};
      });
      const groups=[...document.querySelectorAll('form,.ant-form-item,[role="dialog"],.ant-modal,[class*="upload-drag"],[class*="ant-tabs-tab"]')].slice(0,180).map(e=>({
        tag:e.tagName.toLowerCase(),selector:selector(e),className:terse(typeof e.className==='string'?e.className:''),labels:[...e.querySelectorAll('legend,.ant-form-item-label label,.ant-modal-title,[role="tab"]')].slice(0,4).map(x=>terse(x.textContent)).filter(Boolean)
      }));
      const data={schemaVersion:2,notice:'Structure only; does not include field values, selections, cookies, tokens, request bodies, or uploaded file names.',hostname:location.hostname,pathname:location.pathname,date:new Date().toISOString(),fields,groups};
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');link.href=url;
      link.download='TIMO_FORM_DETAIL_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),15000);
      $('status').textContent='상세 구조 파일 저장 요청 완료 ('+fields.length+'개 요소, '+groups.length+'개 그룹). 파일을 ChatGPT에 보내주세요.';
    }catch(error){$('status').textContent='진단 실패: '+error.message;}
  });
})();