# 창개토대왕 Cloudflare Pages 이전본
기존 Sites v16 디자인, 실제 텍스트, 원본 이미지/로고를 정적 HTML/CSS로 옮겼습니다.
Cloudflare Pages: branch main, framework None, build command empty, output directory root.

## 아직 필요한 계정 설정
1. Cloudflare D1 DB 생성 후 setup/schema.sql 실행.
2. Pages Settings > Bindings에서 D1을 DB라는 이름으로 연결.
3. Google Sheets의 확장 프로그램 > Apps Script에서 setup/GoogleAppsScript.gs 저장.
4. Apps Script 설정의 스크립트 속성 SHEETS_TOKEN에 충분히 긴 임의 비밀값 저장.
5. 웹 앱으로 배포: 실행 계정 본인, 접근 누구나. 연결된 시트 접근 승인 필요.
6. Cloudflare Pages 환경변수/Secrets에 SHEETS_WEBHOOK_URL(웹앱 /exec 주소), SHEETS_TOKEN(같은 비밀값) 저장. 다시 배포.

설정 전에는 신청 버튼을 비활성화하고 기존 Sites 신청 링크를 제공합니다.
설정 후 신청은 새 Cloudflare D1에 먼저 저장한 다음 Apps Script로 시트에 전송합니다.
ID는 cf-UUID로 기존 Sites 숫자 ID와 겹치지 않으며, 시트 A열로 중복을 방지합니다.
개인정보 동의 여부와 문구 버전을 D1에 함께 기록합니다.
시트 전송 실패시 D1에는 남지만 자동 재시도 작업은 아직 추가하지 않았습니다.
기존 ChatGPT 시간별 자동화는 기존 Sites DB만 읽습니다. 이전 완료 전까지 유지하세요.
배포 성공만으로 견적 기능 완성을 의미하지 않습니다. 실제 접수/시트 기록 확인이 필요합니다.
공개 저장소에 토큰, 실제 고객 정보, 계정 비밀값을 저장하지 마세요.
