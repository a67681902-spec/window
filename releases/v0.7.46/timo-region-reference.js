'use strict';
/* v0.7.46 - Regional TXT reference adaptation. Zero writes to original folder. */
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
 async function decode(file){
  const data=await file.arrayBuffer();
  let utf8=new TextDecoder('utf-8',{fatal:false}).decode(data);
  if(utf8.includes('\uFFFD')){
   try{const euc=new TextDecoder('euc-kr',{fatal:true}).decode(data);if(!euc.includes('\uFFFD'))utf8=euc;}catch{}
  }
  return utf8.replace(/^\uFEFF/,'');
 }
 async function transformFiles(originalFiles,{city,minCount=7}={}){
  city=cleanCity(city);minCount=desired(minCount);
  if(!originalFiles?.length)throw Error('E_BODY_EMPTY · 참고원고 폴더가 비어 있습니다.');
  const unsupported=originalFiles.filter(f=>!(/\.txt$/i.test(f.name)));
  if(unsupported.length)throw Error('E_BODY_DOCX · 지역별 원고 보정은 TXT만 지원합니다. 다음 파일을 TXT로 저장해 참고원고 폴더에 넣어 주세요: '+unsupported.map(x=>x.name).slice(0,4).join(', '));
  const generated=[],summaries=[];
  for(const [index,file] of originalFiles.entries()){
   const input=await decode(file);
   let converted;
   try{converted=transform(input,city,minCount);}catch(e){throw Error(file.name+' · '+e.message);}
   const safeBase=file.name.replace(/\.txt$/i,'').replace(/[^\w가-힣-]/g,'_').slice(0,85);
   const filename=city+'_'+String(index+1).padStart(2,'0')+'_'+safeBase+'.txt';
   const clone=new File(['\uFEFF',converted.text],filename,{type:'text/plain;charset=utf-8'});
   generated.push(clone);
   summaries.push({filename,sourceName:file.name,originalCount:converted.originalCount,
     count:converted.count,added:converted.added,originalPreview:input.slice(0,350),preview:converted.text.slice(0,600)});
  }
  return {files:generated,summaries,city,minCount};
 }
 return {transform,transformFiles,count,desired,cleanCity};
});
