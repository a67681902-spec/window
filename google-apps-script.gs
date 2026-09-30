/**
 * 창개토대왕 무료견적 랜딩페이지 → Google Sheets
 * 1) SHEET_ID에 견적을 받을 구글시트 ID 입력
 * 2) 웹앱으로 배포: 실행 사용자=나, 액세스 권한=모든 사용자
 * 3) 배포 URL을 랜딩페이지 config.js에 입력
 */
const SHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";
const SHEET_NAME = "랜딩페이지견적";
function doGet(){return ContentService.createTextOutput(JSON.stringify({ok:true,service:"changgaeto-landing"})).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){
  try{
    const body=JSON.parse(e.postData.contents||"{}");
    const ss=SpreadsheetApp.openById(SHEET_ID);
    let sheet=ss.getSheetByName(SHEET_NAME);
    if(!sheet){sheet=ss.insertSheet(SHEET_NAME);sheet.appendRow(["접수 ID","접수일시","성함","휴대폰 번호","거주지역","건물 유형","교체 범위","상담 내용","유입 경로","신청 페이지","기기","개인정보 동의"]);sheet.setFrozenRows(1);}
    const id=Utilities.getUuid();const now=new Date();
    sheet.appendRow([id,now,safe(body.name),safe(body.phone),safe(body.region),safe(body.buildingType),safe(body.scope),safe(body.message),safe(body.source),safe(body.page),safe(body.device),body.privacy?"동의":"미동의"]);
    return json({ok:true,id});
  }catch(err){console.error(err);return json({ok:false,error:String(err)});}
}
function safe(v){if(v===null||v===undefined)return"";const s=String(v).trim();return/^[=+\-@]/.test(s)?"'"+s:s;}
function json(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
