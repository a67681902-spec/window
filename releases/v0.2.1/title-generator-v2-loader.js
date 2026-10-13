'use strict';
const frame = document.getElementById('generator');
frame.addEventListener('load', () => {
  try {
    const doc = frame.contentDocument;
    if (!doc || !doc.getElementById('makeBtn')) throw Error('Title generator frame unavailable');
    const script = doc.createElement('script');
    script.src = chrome.runtime.getURL('title-generator-enhance.js');
    doc.body.appendChild(script);
  } catch (error) {
    const alert = document.createElement('p');
    alert.textContent = '제목 생성기 확장 기능 로드 실패: ' + error.message;
    alert.style.cssText = 'position:fixed;top:10px;left:10px;padding:14px;background:#ffe9e5;color:#8d2d28;z-index:100';
    document.body.appendChild(alert);
  }
});
