// 스크립트 속성 SHEETS_TOKEN에 Cloudflare와 같은 비밀값을 저장하세요.
const SPREADSHEET_ID='1Nh4zK7zSSNyvPBLWCpamoigFQtusxWXCvFBvFiDqLAk';
function doPost(e){
 const response=o=>ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
 let lock=LockService.getScriptLock();
 try{
  const data=JSON.parse(e.postData.contents), token=PropertiesService.getScriptProperties().getProperty('SHEETS_TOKEN');
  if(!token||data.token!==token)return response({ok:false});
  const r=data.row;if(!r||!/^cf-[a-f0-9-]{36}$/.test(r.id)||!r.name||!r.phone)return response({ok:false});
  lock.waitLock(20000);const sheet=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('견적요청');
  if(!sheet)throw new Error('Missing tab');
  const last=sheet.getLastRow();const ids=last?sheet.getRange(1,1,last,1).getDisplayValues().flat():[];
  if(!ids.includes(r.id)){
   const values=[r.id,Utilities.formatDate(new Date(r.created_at),'Asia/Seoul','yyyy-MM-dd HH:mm:ss'),r.name,r.phone,r.region,r.building,r.scope,r.detail,r.source,r.landing,r.device].map(v=>String(v??''));
   const range=sheet.getRange(last+1,1,1,11);range.setNumberFormat('@');range.setValues([values.map(v=>/^[=+@-]/.test(v)?"'"+v:v)]);SpreadsheetApp.flush();
  }
  return response({ok:true});
 }catch{return response({ok:false});}finally{if(lock.hasLock())lock.releaseLock();}
}
