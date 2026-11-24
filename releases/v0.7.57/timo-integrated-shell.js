'use strict';
(()=>{
 const a=document.getElementById('tabGenerator'),b=document.getElementById('tabDeploy'),c=document.getElementById('tabBatch');
 const gen=document.getElementById('generator'),dep=document.getElementById('deployPanel');
 function set(which){
   const batch=which==='batch',deploy=which==='deploy';
   a.setAttribute('aria-selected',String(!deploy&&!batch));
   b.setAttribute('aria-selected',String(deploy));
   c.setAttribute('aria-selected',String(batch));
   gen.hidden=deploy||batch;dep.hidden=!(deploy||batch);
   document.getElementById('titleSlots').hidden=deploy||batch;
   // The two deployment views share an iframe and their existing file handles.
   const update=()=>{
     try {
       const body=dep.contentDocument?.body;
       if(!body)return;
       body.classList.toggle('batch-view',batch);
       if(batch){
         const panel=dep.contentDocument.getElementById('timoBatchPanel');
         panel?.classList.remove('tm-folded');
         const toggle=panel?.querySelector(':scope > h2 .tm-toggle');
         if(toggle){toggle.textContent='접기 −';toggle.setAttribute('aria-expanded','true');}
         dep.contentWindow?.postMessage({type:'TIMO_BATCH_OPENED'},location.origin);
       }
     }catch(e){console.warn('TIMO batch tab:',e.message);}
   };
   update();
   try{sessionStorage.setItem('timo-active-panel-v1',batch?'batch':deploy?'deploy':'generator');}catch{}
 }
 a.addEventListener('click',()=>set('generator'));
 b.addEventListener('click',()=>set('deploy'));
 c.addEventListener('click',()=>set('batch'));
 dep.addEventListener('load',()=>{
   const selected=c.getAttribute('aria-selected')==='true'?'batch':b.getAttribute('aria-selected')==='true'?'deploy':'generator';
   set(selected);
 });
 gen.addEventListener('load',()=>{
   // Enhancement scripts are loaded asynchronously after the original generator.
   if(c.getAttribute('aria-selected')==='true')setTimeout(()=>{
     try{dep.contentWindow?.postMessage({type:'TIMO_BATCH_OPENED'},location.origin);}catch{}
   },1200);
 });
 let initial='generator';
 try{initial=new URLSearchParams(location.search).get('tab')||sessionStorage.getItem('timo-active-panel-v1')||'generator';}catch{}
 set(['batch','deploy'].includes(initial)?initial:'generator');
})();
