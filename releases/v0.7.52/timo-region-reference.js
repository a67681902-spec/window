'use strict';
/* v0.7.47 - Regional TXT reference adaptation. Zero writes to original folder. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.timoRegionReference=api;
})(typeof window!=='undefined'?window:null,function(){
 const KEYWORDS=/(샷시교체|샤시교체|창호교체|그린리모델링|샷시|샤시|창호|창문|창틀|방충망|유리|단열|시공|견적|교체|업체|리모델링|상담|시스템창호)/;
 const ESC=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const count=(s,city)=>city?(String(s).match(new RegExp(ESC(city),'g'))||[]).length:0;
 const cleanCity=city=>{
  const s=String(city||'').trim();
  if(!/^[가-힣]{2,12}$/.test(s))throw Error('E_BODY_REGION · 유효한 지역명이 아닙니다.');
  return s;
 };
 const desired=n=>{
  const count=Number(n);
  if(!Number.isInteger(count)||count<7||count>30)throw Error('E_BODY_MIN · 지역명 횟수는 7~30회로 설정하세요.');
  return count;
 };
 function transform(text,city,minCount=7){
  city=cleanCity(city);minCount=desired(minCount);
  const original=String(text||'');
  if(original.length<90)throw Error('E_BODY_SHORT · 원고가 너무 짧습니다. 자연스러운 지역명 추가를 위해 충분한 문장으로 작성해 주세요.');
  // Explicit placeholders permit reliable localization without guessing a city name.
  let source=original.replace(/\{\{\s*지역명\s*\}\}|\[지역명\]|\{지역명\}/g,city);
  const before=count(original,city),already=count(source,city);
  const missing=Math.max(0,minCount-already);
  if(missing===0)return {text:source,originalCount:before,count:already,added:already-before,minCount};
  // Split at *sentence boundaries*, not arbitrary character positions.
  // Captured separators are preserved exactly when joining again.
  const parts=source.split(/(\r?\n+|(?<=[.!?。！？])\s+(?=[가-힣A-Za-z(「『]))/);
  const candidates=[];
  for(let i=0;i<parts.length;i+=2){
   const segment=parts[i];
   if(!segment||segment.trim().length<15||!/[가-힣]/.test(segment)||segment.includes(city))continue;
   if(KEYWORDS.test(segment))candidates.push({index:i,keyword:true});
  }
  // Prefer a relevant industry term. Never pad with an artificial keyword list.
  if(candidates.length<missing){
   for(let i=0;i<parts.length;i+=2){
    if(candidates.some(v=>v.index===i))continue;
    const seg=parts[i];
    if(seg&&seg.trim().length>=22&&/[가-힣]/.test(seg)&&!seg.includes(city))candidates.push({index:i,keyword:false});
   }
  }
  if(candidates.length<missing)
   throw Error('E_BODY_SENTENCES · '+city+'을(를) '+minCount+'회 넣을 자연스러운 문장이 부족합니다. 원고를 문장 단위로 늘리거나 [지역명] 표시를 추가해 주세요. (기존 '+already+'회, 삽입 가능 '+candidates.length+'회)');
  // Spread inserted instances across the whole body instead of clustering them.
  candidates.sort((a,b)=>a.index-b.index);
  const indexes=[];
  for(let k=0;k<missing;k++)indexes.push(candidates[Math.floor((k+0.5)*candidates.length/missing)]);
  for(const {index,keyword} of indexes){
   if(keyword){
    parts[index]=parts[index].replace(KEYWORDS,(term)=>city+' '+term);
   }else{
    const prefix=/^(\s*)/.exec(parts[index])[1];
    parts[index]=prefix+city+'에서 '+parts[index].slice(prefix.length);
   }
  }
  const out=parts.join(''),actual=count(out,city);
  if(actual<minCount)throw Error('E_BODY_VERIFY · 원고 지역명 반복 수가 '+actual+'회로 목표 '+minCount+'회보다 적습니다.');
  return {text:out,originalCount:before,count:actual,added:actual-before,minCount};
 }
 // Count keyword substrings, including compounds like "샷시교체" and "샤시교체".
 // Zero disables automatic additions without changing existing text.
 const keywordDesired=(n,word)=>{
  const value=Number(n);
  if(!Number.isInteger(value)||value<0||value>80)
   throw Error('E_BODY_KEYWORD_MIN · '+word+' 횟수는 0~80회로 설정하세요. 0회는 자동 보정 안 함을 의미합니다.');
  return value;
 };
 function ensureKeyword(text,word,target){
  target=keywordDesired(target,word);
  const originalCount=count(text,word);
  // Authors may place an explicit [샷시] or [샤시] placeholder in their TXT.
  const placeholder=new RegExp('\\{\\{\\s*'+ESC(word)+'\\s*\\}\\}|\\['+ESC(word)+'\\]|\\{'+ESC(word)+'\\}','g');
  let out=text.replace(placeholder,word);
  let present=count(out,word);
  const missing=target-present;
  if(missing<=0)return {text:out,originalCount,count:present,added:present-originalCount,minCount:target};
  // Only add immediately before a relevant noun at a word boundary. Do not
  // insert inside existing words or stack "샷시 샤시" on the same noun.
  const trigger=/(^|[\s(（「『,，:：;；])(?:시공업체|시공비|견적서|시공|교체|견적|단열|업체|가격|비용|유리|자재|공사|작업|보수|상담|제품|계약|선택|점검|품질|성능|유지관리|사후관리)/gm;
  const candidates=[];let match;
  while((match=trigger.exec(out))!==null){
   const position=match.index+match[1].length;
   const prior=out.slice(Math.max(0,position-9),position);
   // Skip another matching word's modifier; limit adjacent keyword clumps.
   if(/(?:샷시|샤시)\s*$/.test(prior))continue;
   // Avoid adjacent insertion points so one clause is not overstuffed.
   if(candidates.length&&position-candidates[candidates.length-1]<10)continue;
   candidates.push(position);
  }
  if(candidates.length<missing)
   throw Error('E_BODY_KEYWORD_SENTENCES · '+word+' 최소 '+target+'회를 자연스럽게 배치할 문장 위치가 부족합니다. '+
     '(기존 '+present+'회, 추가 가능 '+candidates.length+'회) 목표 횟수를 낮추거나 원고에 '+word+' 관련 문장을 보강하세요.');
  const chosen=[];
  for(let i=0;i<missing;i++)chosen.push(candidates[Math.floor((i+0.5)*candidates.length/missing)]);
  for(let i=chosen.length-1;i>=0;i--)out=out.slice(0,chosen[i])+word+' '+out.slice(chosen[i]);
  present=count(out,word);
  if(present<target)throw Error('E_BODY_KEYWORD_VERIFY · '+word+' '+present+'회로 목표 '+target+'회에 못 미칩니다.');
  return {text:out,originalCount,count:present,added:present-originalCount,minCount:target};
 }
 async function decode(file){
  const data=await file.arrayBuffer();
  let utf8=new TextDecoder('utf-8',{fatal:false}).decode(data);
  if(utf8.includes('\uFFFD')){
   try{const euc=new TextDecoder('euc-kr',{fatal:true}).decode(data);if(!euc.includes('\uFFFD'))utf8=euc;}catch{}
  }
  return utf8.replace(/^\uFEFF/,'');
 }
 async function transformFiles(originalFiles,{city,minCount=7,shatsiMinCount=0,shasiMinCount=0}={}){
  city=cleanCity(city);minCount=desired(minCount);
  shatsiMinCount=keywordDesired(shatsiMinCount,'샷시');
  shasiMinCount=keywordDesired(shasiMinCount,'샤시');
  if(!originalFiles?.length)throw Error('E_BODY_EMPTY · 참고원고 폴더가 비어 있습니다.');
  const unsupported=originalFiles.filter(f=>!(/\.txt$/i.test(f.name)));
  if(unsupported.length)throw Error('E_BODY_DOCX · 지역별 원고 보정은 TXT만 지원합니다. 다음 파일을 TXT로 저장해 참고원고 폴더에 넣어 주세요: '+unsupported.map(x=>x.name).slice(0,4).join(', '));
  const generated=[],summaries=[];
  for(const [index,file] of originalFiles.entries()){
   const input=await decode(file);
   let converted;
   let shatsi,shasi;
   try{
     converted=transform(input,city,minCount);
     shatsi=ensureKeyword(converted.text,'샷시',shatsiMinCount);
     shasi=ensureKeyword(shatsi.text,'샤시',shasiMinCount);
   }catch(e){throw Error(file.name+' · '+e.message);}
   const safeBase=file.name.replace(/\.txt$/i,'').replace(/[^\w가-힣-]/g,'_').slice(0,85);
   const filename=city+'_'+String(index+1).padStart(2,'0')+'_'+safeBase+'.txt';
   const clone=new File(['\uFEFF',shasi.text],filename,{type:'text/plain;charset=utf-8'});
   generated.push(clone);
   summaries.push({filename,sourceName:file.name,originalCount:converted.originalCount,
     count:converted.count,added:converted.added,
     shatsiOriginal:count(input,'샷시'),shatsiCount:count(shasi.text,'샷시'),
     shasiOriginal:count(input,'샤시'),shasiCount:count(shasi.text,'샤시'),
     originalPreview:input.slice(0,350),preview:shasi.text.slice(0,600)});
  }
  return {files:generated,summaries,city,minCount,shatsiMinCount,shasiMinCount};
 }
 return {transform,transformFiles,count,desired,cleanCity,keywordDesired,ensureKeyword};
});
