'use strict';
(()=>{
 const a=document.getElementById('tabGenerator'),b=document.getElementById('tabDeploy');
 const gen=document.getElementById('generator'),dep=document.getElementById('deployPanel');
 function set(which){
   const deploy=which==='deploy';
   a.setAttribute('aria-selected',String(!deploy));
   b.setAttribute('aria-selected',String(deploy));
   gen.hidden=deploy;dep.hidden=!deploy;
   try{sessionStorage.setItem('timo-active-panel-v1',deploy?'deploy':'generator');}catch{}
 }
 a.addEventListener('click',()=>set('generator'));
 b.addEventListener('click',()=>set('deploy'));
 let initial='generator';
 try{initial=new URLSearchParams(location.search).get('tab')||sessionStorage.getItem('timo-active-panel-v1')||'generator';}catch{}
 set(initial);
})();
