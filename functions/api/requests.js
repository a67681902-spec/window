const regions=new Set(["서울특별시","부산광역시","대구광역시","인천광역시","광주광역시","대전광역시","울산광역시","세종특별자치시","경기도 남부","경기도 북부","강원특별자치도","충청북도","충청남도","전북특별자치도","전라남도","경상북도","경상남도","제주특별자치도"]);
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function onRequestGet({env}){return json({ready:Boolean(env.DB&&env.SHEETS_WEBHOOK_URL&&env.SHEETS_TOKEN)});}
export async function onRequestPost({request,env}){
 if(!env.DB||!env.SHEETS_WEBHOOK_URL||!env.SHEETS_TOKEN)return json({error:'접수 연결을 준비 중입니다. 기존 사이트를 이용해 주세요.'},503);
 try {
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);
  const data=await request.json();const value=(k,n=500)=>String(data[k]??'').trim().slice(0,n);
  if(data.consent!==true||!value('name',80)||!/^01[016789]-?\d{3,4}-?\d{4}$/.test(value('phone',20).replace(/\s/g,''))||!regions.has(value('region',30)))return json({error:'입력 내용을 확인해 주세요.'},400);
  const row={id:'cf-'+crypto.randomUUID(),created_at:new Date().toISOString(),name:value('name',80),phone:value('phone',20),region:value('region',30),building:value('building',40),scope:value('scope',50),detail:value('detail',1000),source:value('source',1000),landing:value('landing',1000),device:value('device',20)};
  await env.DB.prepare('INSERT INTO requests (id,created_at,name,phone,region,building,scope,detail,source,landing,device,consent,consent_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...Object.values(row),1,'2026-09-30').run();
  try {const r=await fetch(env.SHEETS_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:env.SHEETS_TOKEN,row}),signal:AbortSignal.timeout(12000)});const result=await r.json();if(r.ok&&result.ok)await env.DB.prepare('UPDATE requests SET sheets_synced_at=? WHERE id=?').bind(new Date().toISOString(),row.id).run();}catch{}
  return json({ok:true});
 }catch{return json({error:'接수되지 않았습니다. 잠시 후 다시 시도해 주세요.'.replace('接','접')},500);}
}
