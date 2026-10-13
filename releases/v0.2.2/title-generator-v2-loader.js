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
