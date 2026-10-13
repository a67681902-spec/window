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
