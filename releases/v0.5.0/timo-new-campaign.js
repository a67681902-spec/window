'use strict';
// TIMO new-campaign one-shot staging test. Never clicks [저장] or [진행].
(async()=>{
 const safe=(message)=>({ok:false,code:'E_TIMO_STAGE',message});
 function executeWizard(config){
   const errors=[];
   let stage='INIT';
   const norm=x=>String(x||'').replace(/\s+/g,' ').trim();
   const visible=x=>!!x&&!!x.getClientRects().length&&!x.disabled;
   const tick=ms=>new Promise(resolve=>setTimeout(resolve,ms));
   const buttons=label=>[...document.querySelectorAll('button')].filter(b=>norm(b.textContent)===label&&visible(b));
   const oneButton=label=>{
     const all=buttons(label);
     if(all.length!==1)throw Error('E_BUTTON_'+label+' · '+label+' 버튼 '+all.length+'개 발견. 대상 식별 불가');
     return all[0];
   };
   const nativeSet=(element,value)=>{
     const proto=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
     const desc=Object.getOwnPropertyDescriptor(proto,'value');
     if(!desc?.set)throw Error('E_INPUT_SET · 입력칸 값을 설정할 수 없습니다');
     desc.set.call(element,String(value));
     element.dispatchEvent(new Event('input',{bubbles:true}));
     element.dispatchEvent(new Event('change',{bubbles:true}));
   };
   const until=async(test,timeout,code)=>{
     const end=Date.now()+timeout;
     while(Date.now()<end){
       const v=test();if(v)return v;
       await tick(250);
     }
     throw Error(code+' · 제한 시간 '+Math.round(timeout/1000)+'초 초과; 화면을 확인하세요');
   };
   const radio=(name,label)=>{
     const group=[...document.querySelectorAll('input[type=radio][name="'+name+'"]')];
     const matches=group.filter(el=>visible(el.closest('label')||el)
       &&norm(el.closest('label')?.textContent).includes(label)
       &&!el.disabled);
     if(matches.length!==1)throw Error('E_RADIO_'+name+' · '+label+' 항목을 찾지 못했습니다 ('+matches.length+'개)');
     // Ant Design radios are controlled by clicking their labels.
     (matches[0].closest('label')||matches[0]).click();
     return label;
   };
   const outcome=(code,message,details={})=>({ok:code==='STAGED',code,message,stage,details});
   const run=async()=>{
     if(location.hostname!=='xn--v52b175b.site'&&location.hostname!=='www.xn--v52b175b.site')
       throw Error('E_HOST · 티모 사이트가 아닙니다');
     if(location.pathname!=='/posts/places')
       throw Error('E_PATH · 티모 플레이스 배포 목록(/posts/places)에서 시작해야 합니다');
     stage='신규 등록 열기';
     oneButton('등록').click();
     const urlInput=await until(()=>[...document.querySelectorAll('input')].find(x=>x.placeholder==='https://m.place.naver.com/...'&&visible(x)),8000,'E_PLACE_INPUT');
     stage='플레이스 주소 조회';
     nativeSet(urlInput,config.placeUrl);
     if(urlInput.value!==config.placeUrl)throw Error('E_PLACE_VALUE · URL 입력값이 일치하지 않습니다');
     oneButton('조회').click();
     await until(()=>{
       const btn=buttons('플레이스 주소 추가등록')[0];
       const disabled=[...document.querySelectorAll('input')].some(x=>x.placeholder==='https://m.place.naver.com/...'&&x.disabled);
       return btn&&disabled;
     },20000,'E_PLACE_LOOKUP');
     stage='등록 2단계 열기';
     oneButton('다음').click();
     await until(()=>[...document.querySelectorAll('input[name=genType]')].some(x=>!x.disabled),8000,'E_STEP2');
     stage='등록 2단계 설정';
     if(config.type)radio('type',config.type);
     if(config.genType)radio('genType',config.genType);
     if(config.keywords?.length){
       const targets=[...document.querySelectorAll('input')].filter(x=>x.placeholder==='예) 맛집, 분위기'&&visible(x));
       if(targets.length!==1)throw Error('E_KEYWORD_FIELD · 생성 키워드 입력칸을 유일하게 찾을 수 없습니다 ('+targets.length+'개)');
       // One plain comma-separated text input; never press Enter (could submit).
       nativeSet(targets[0],config.keywords.join(', '));
       if(!config.keywords.every(x=>targets[0].value.includes(x)))
         throw Error('E_KEYWORD_VALUE · 키워드 입력 결과가 다릅니다');
     }
     stage='등록 3단계 열기';
     oneButton('다음').click();
     await until(()=>document.getElementById('dailyLimit')&&[...document.querySelectorAll('input[name=autoRun]')].length>=2,8000,'E_STEP3');
     stage='등록 3단계 설정';
     // No automatic start or publish.
     radio('autoRun','수동 시작');
     radio('autoPublish','검수 후 배포');
     if(config.dailyLimit){
       const limit=document.getElementById('dailyLimit');
       if(!visible(limit))throw Error('E_DAILY_FIELD · 하루 제한 입력칸이 없습니다');
       nativeSet(limit,String(config.dailyLimit));
       if(limit.value!==String(config.dailyLimit))throw Error('E_DAILY_VALUE · 하루 제한 값 확인 실패');
     }
     if(config.otherUrl){
       const inputs=[...document.querySelectorAll('input')].filter(x=>x.placeholder==='https://example.com'&&visible(x));
       if(inputs.length!==1)throw Error('E_OTHER_URL · 기타 URL 칸 '+inputs.length+'개 발견; 잘못된 입력 방지');
       nativeSet(inputs[0],config.otherUrl);
       if(inputs[0].value!==config.otherUrl)throw Error('E_OTHER_URL_VALUE · 기타 URL 값 확인 실패');
     }
     stage='저장 직전 대기';
     if(buttons('저장').length!==1)throw Error('E_SAVE_READY · 저장 버튼을 확인할 수 없습니다');
     // This routine has no .click() on [저장] or [진행].
     return outcome('STAGED','새 배포 설정 3단계까지 이동했습니다. 화면의 플레이스와 설정을 검토하고 티모 [저장] 버튼을 직접 누르세요.',
       {placeUrl:config.placeUrl,keywords:config.keywords.length,genType:config.genType||'기존선택 유지',type:config.type||'기존선택 유지',autoRun:'수동 시작',autoPublish:'검수 후 배포',saved:false});
   };
   return run().catch(e=>outcome('E_STAGE_FAILED',e.message,{saved:false}));
 }
 try{
   const stored=await chrome.storage.local.get('timoNewCampaignPendingV1');
   const config=stored.timoNewCampaignPendingV1;
   if(!config||typeof config!=='object'||!config.placeUrl)
     throw Error('E_CONFIG · 신규 배포 실행 설정이 없습니다. 생성기에서 다시 시작하세요.');
   return executeWizard(config);
 }catch(e){return safe(e.message);}
})();