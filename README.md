# 창개토대왕 무료견적 랜딩페이지

무료 운영 구성:
- GitHub: 원본 소스 보관
- Cloudflare Pages: 실제 공개/배포
- Google Apps Script + Google Sheets: 견적 접수 저장

## 파일
- `index.html` : 랜딩페이지
- `style.css` : PC/모바일 반응형 디자인
- `app.js` : 견적폼 처리, UTM/기기 정보 기록
- `config.js` : Google Apps Script 배포 URL 설정
- `google-apps-script.gs` : Google Sheets 저장용 Apps Script

## Google Sheets 연결
1. Google Sheets를 만듭니다.
2. 주소에서 `/d/`와 `/edit` 사이 값을 복사합니다.
3. Google Sheets > 확장 프로그램 > Apps Script.
4. `google-apps-script.gs` 내용을 붙여넣고 SHEET_ID 변경.
5. 배포 > 새 배포 > 웹 앱.
6. 실행 사용자: 나 / 액세스 권한: 모든 사용자.
7. 나온 `/exec` URL을 `config.js`에 입력.

## Cloudflare Pages
1. Cloudflare Dashboard > Workers & Pages > Create
2. Pages > Connect to Git
3. 이 저장소 선택
4. Framework preset: None
5. Build command: 비움
6. Build output directory: /
7. Deploy
