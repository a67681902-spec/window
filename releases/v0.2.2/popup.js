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
