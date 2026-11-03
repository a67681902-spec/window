const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/releases/v0.7.27/timo-file-transfer.js','utf8');
function fixture(path,{duplicate=false,headerCount=0,mode=false}={}){
 let listener;
 const field=(accept,multiple)=>({type:'file',accept,multiple,disabled:false,events:[],dispatchEvent(e){this.events.push(e.type)}});
 const title=field('.xls,.xlsx,.txt',false),reference=field('.txt,.docx',true),header=field('.jpg,.png,.jpeg,.gif,.webp',true),overlay=field('.png',true),intro=field('.png',true);
 const radio={checked:mode,disabled:false};
 const modeLabel={textContent:'제목·원고 따로 발행',querySelector:()=>radio,click:()=>radio.checked=true};
 const layoutRadio={checked:true};
 const layout={textContent:'가로',querySelector:()=>layoutRadio,click:()=>layoutRadio.checked=true};
 const section=(name,input)=>({textContent:name,querySelectorAll(s){return s==='label'?[layout]:[input]},querySelector(){return {textContent:`업로드 (${headerCount}/5)`}}});
 const hs=section('헤더용 이미지',header),os=section('오버레이 이미지',overlay),is=section('소개용 텍스트 투명이미지',intro);
 header.closest=()=>hs;
 const inputs=path==='features'?[header,overlay,intro]:[title,reference,...(duplicate?[field('.xls,.xlsx,.txt',false)]:[])];
 const context={location:{hostname:'xn--v52b175b.site',pathname:'/posts/places/123/'+path},document:{querySelectorAll(s){return s==='.pd-feature-head'?[hs,os,is]:s==='label'?[modeLabel]:inputs}},chrome:{runtime:{onMessage:{addListener(fn){listener=fn}}}},Uint8Array,atob,Event:class{constructor(type){this.type=type}},File:class{constructor(parts,name,opts){this.size=parts.reduce((a,x)=>a+x.length,0);this.name=name}},DataTransfer:class{constructor(){this.files=[];this.items={add:f=>this.files.push(f)}}},setTimeout:fn=>fn()};
 vm.runInNewContext(code,context);
 const send=msg=>new Promise(resolve=>listener({tag:'TIMO_TRANSFER_V060',...msg},{},resolve));
 async function upload(kind,name,id='123'){
  let r=await send({cmd:'INIT',session:'x',kind,campaignId:id,headerLayout:'가로',files:[{name,size:3}]});if(!r.ok)return r;
  r=await send({cmd:'CHUNK',session:'x',fileIndex:0,chunkIndex:0,payload:btoa('abc')});assert.equal(r.ok,true);
  return send({cmd:'COMMIT',session:'x'});
 }
 return {upload,send,title,reference,header,overlay,intro};
}
(async()=>{
 let f=fixture('references');assert.equal((await f.upload('templates','titles.xlsx')).ok,true);assert.equal(f.title.files.length,1);assert.equal(f.reference.files,undefined);
 f=fixture('references');assert.equal((await f.upload('references','draft.docx')).ok,true);assert.equal(f.reference.files.length,1);assert.equal(f.title.files,undefined);
 f=fixture('references');assert.equal((await f.upload('references','draft.doc')).ok,false);
 f=fixture('references');assert.equal((await f.upload('templates','titles.xlsx','999')).ok,false);assert.equal(f.title.files,undefined);
 f=fixture('references',{duplicate:true});assert.equal((await f.upload('templates','titles.xlsx')).ok,false);
 f=fixture('features');assert.equal((await f.upload('headers','01.png')).ok,true);assert.equal(f.header.files.length,1);assert.equal(f.overlay.files,undefined);
 f=fixture('features');assert.equal((await f.upload('overlays','mark.png')).ok,true);assert.equal(f.overlay.files.length,1);assert.equal(f.intro.files,undefined);
 f=fixture('features');assert.equal((await f.upload('overlays','mark.jpg')).ok,false);
 f=fixture('features',{headerCount:5});assert.equal((await f.upload('headers','01.png')).ok,false);assert.equal(f.header.files,undefined);
 f=fixture('references');assert.equal((await f.send({cmd:'INIT',session:'x',kind:'templates',campaignId:'123',files:[{name:'a.txt',size:3}]})).ok,true);assert.equal((await f.send({cmd:'COMMIT',session:'x'})).ok,false);
 console.log('PASS: 10 upload scenarios (routing, isolation, format, campaign ID, capacity, incomplete transfer, mode selection)');
})().catch(e=>{console.error(e);process.exitCode=1});
