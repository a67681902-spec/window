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
   const radio=async(name,label)=>{
     const group=[...document.querySelectorAll('input[type=radio][name="'+name+'"]')];
     const matches=group.filter(el=>visible(el.closest('label')||el)
       &&norm(el.closest('label')?.textContent).includes(label)&&!el.disabled);
     if(matches.length!==1)throw Error('E_RADIO_'+name+' · '+label+' 항목이 '+matches.length+'개 발견돼 안전상 중단합니다.');
     if(!matches[0].checked)(matches[0].closest('label')||matches[0]).click();
     await until(()=>matches[0].checked,4500,'E_RADIO_NOT_APPLIED_'+name);
     await tick(280);
   };
   // Identify the banned-word field by its visible heading, never positional indexes.
   const findBannedInput=()=>{
     const headings=[...document.querySelectorAll('label,span,div,p,strong,h3,h4')].filter(el=>
       norm(el.textContent)==='포함되면 안되는 금지어' &&
       ![...el.children].some(child=>norm(child.textContent)==='포함되면 안되는 금지어'));
     for(const heading of headings){
       let node=heading;
       for(let depth=0;node&&depth<8;depth++,node=node.parentElement){
         const inputs=[...node.querySelectorAll('input:not([type=file]):not([type=hidden]):not([type=search]),textarea')]
           .filter(el=>visible(el)&&el.placeholder!=='https://example.com');
         if(inputs.length===1)return inputs[0];
       }
     }
     return null;
   };
   const leafByExactText=(value)=>{
     const found=[...document.querySelectorAll('label,span,div,p,button,strong')].filter(el=>{
       if(!visible(el)||norm(el.textContent)!==value)return false;
       return ![...el.children].some(child=>norm(child.textContent)===value);
     });
     if(found.length!==1)throw Error('E_LABEL_AMBIGUOUS · "'+value+'" 표시를 '+found.length+'개 발견했습니다.');
     return found[0];
   };
   // TiMO campaign choices in the first modal were not exposed as radio
   // fields in the earlier structural capture. Do not infer selection merely
   // from a click: inspect its actual selected state and fail if unknown.
   const selectNewCampaign=async()=>{
     const leaf=leafByExactText('신규 캠페인');
     const control=leaf.closest('label,button,[role="radio"]')||leaf.parentElement;
     if(!control)throw Error('E_NEW_CAMPAIGN_CONTROL · 신규 캠페인 선택 요소를 찾지 못했습니다.');
     const isChosen=()=>{
       for(let node=leaf,depth=0;node&&depth<4;depth++,node=node.parentElement){
         if(node.matches?.('[role="radio"][aria-checked="true"],[aria-selected="true"],[data-state="checked"]'))
           return true;
         if(node.querySelector?.('input[type="radio"]:checked'))return true;
         if(node.querySelector?.('.ant-radio-checked'))return true;
       }
       return false;
     };
     if(!isChosen())control.click();
     await tick(400);
     if(!isChosen())throw Error('E_NEW_CAMPAIGN_UNVERIFIED · 신규 캠페인 선택 여부를 화면 구조로 확인하지 못했습니다. 기존 캠페인을 재사용하지 않도록 다음 단계로 진행하지 않았습니다. 이 화면의 상세 구조 JSON을 보내주세요.');
   };
   const findCampaignNameField=()=>{
     const targetLabel=[...document.querySelectorAll('label,span,div,p')].filter(el=>
       visible(el)&&norm(el.textContent)==='캠페인 명'&&
       ![...el.children].some(child=>norm(child.textContent)==='캠페인 명'));
     for(const label of targetLabel){
       for(let node=label,depth=0;node&&depth<4;depth++,node=node.parentElement){
         const choices=[...node.querySelectorAll('input[type="text"]')].filter(el=>
           visible(el)&&el.placeholder!=='https://m.place.naver.com/...'&&el.id!=='keyword');
         if(choices.length===1)return choices[0];
       }
     }
     // Fallback to exact previously observed structure: when the first modal
     // is open, only one other editable text field (the campaign name) exists.
     const candidates=[...document.querySelectorAll('input[type="text"]')].filter(el=>
       visible(el)&&el.placeholder!=='https://m.place.naver.com/...'&&
       el.placeholder!=='검색어'&&el.id!=='keyword');
     if(candidates.length===1)return candidates[0];
     throw Error('E_CAMPAIGN_NAME_FIELD · 캠페인명 입력칸을 유일하게 확인할 수 없습니다 ('+candidates.length+'개).');
   };
   const outcome=(code,message,details={})=>({ok:code==='STAGED',code,message,stage,details});
   const run=async()=>{
     if(location.hostname!=='xn--v52b175b.site'&&location.hostname!=='www.xn--v52b175b.site')
       throw Error('E_HOST · 티모 사이트가 아닙니다');
     if(location.pathname!=='/posts/places')
       throw Error('E_PATH · 티모 플레이스 배포 목록(/posts/places)에서 시작해야 합니다');
     stage='신규 등록 열기';
     await until(()=>buttons('등록').length===1,12000,'E_REGISTER_BUTTON');
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
     stage='신규 캠페인 선택';
     await selectNewCampaign();
     stage='캠페인명 자동입력';
     const campaignName=String(config.campaignName||'').trim();
     if(!/^[가-힣a-zA-Z0-9_\-]+$/.test(campaignName)||campaignName.length>85)
       throw Error('E_CAMPAIGN_NAME_CONFIG · 캠페인명 형식을 확인하세요.');
     const campaignInput=findCampaignNameField();
     nativeSet(campaignInput,campaignName);
     if(campaignInput.value!==campaignName)throw Error('E_CAMPAIGN_NAME_VALUE · 캠페인명 입력값이 일치하지 않습니다.');
     stage='등록 2단계 열기';
     oneButton('다음').click();
     await until(()=>[...document.querySelectorAll('input[name=genType]')].some(x=>!x.disabled),8000,'E_STEP2');
     stage='등록 2단계 설정';
     if(config.type)await radio('type',config.type);
     if(config.genType)await radio('genType',config.genType);
     if(config.keywords?.length){
       const targets=[...document.querySelectorAll('input')].filter(x=>x.placeholder==='예) 맛집, 분위기'&&visible(x));
       if(targets.length!==1)throw Error('E_KEYWORD_FIELD · 생성 키워드 입력칸을 유일하게 찾을 수 없습니다 ('+targets.length+'개)');
       // One plain comma-separated text input; never press Enter (could submit).
       nativeSet(targets[0],config.keywords.join(', '));
       // TIMO converts comma-separated items into chips but can leave the
       // final item as free text. Commit it explicitly before the Next step.
       await tick(350);
       if(targets[0].value.trim()){
         targets[0].focus();
         targets[0].dispatchEvent(new KeyboardEvent('keydown',{
           key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true
         }));
         targets[0].dispatchEvent(new KeyboardEvent('keyup',{
           key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true
         }));
         await until(()=>!targets[0].value.trim(),4500,'E_KEYWORD_UNCOMMITTED');
       }
       // A cleared input is a useful progress signal; the actual chip list
       // remains subject to visual verification on the staging page.
     }
     stage='등록 3단계 열기';
     oneButton('다음').click();
     await until(()=>document.getElementById('dailyLimit')&&[...document.querySelectorAll('input[name=autoRun]')].length>=2,8000,'E_STEP3');
     stage='등록 3단계 설정';
     // No automatic start or publish.
     await radio('autoRun','수동 시작');
     await radio('autoPublish','검수 후 배포');
     const quota=Number(config.uniqueComplexCount);
     if(!Number.isSafeInteger(quota)||quota<=0||quota>100000
       ||String(quota)!==String(config.dailyLimit)
       ||String(quota)!==String(config.postLimit))
       throw Error('E_QUOTA_CONFIG · 생성기의 고유 단지 수와 두 발행 제한값이 일치하지 않습니다.');
     const daily=document.getElementById('dailyLimit');
     const total=document.getElementById('postLimit');
     if(!visible(daily)||!visible(total))
       throw Error('E_QUOTA_FIELD · 하루 제한 또는 전체 제한 입력칸을 찾을 수 없습니다.');
     nativeSet(daily,String(quota));
     nativeSet(total,String(quota));
     await tick(300);
     if(daily.value!==String(quota)||total.value!==String(quota))
       throw Error('E_QUOTA_NOT_APPLIED · 고유 단지 수 '+quota+'개를 하루/전체 제한에 적용하지 못했습니다.');
     if(config.otherUrl){
       stage='기타 URL 입력 및 태그 확정';
       const inputs=[...document.querySelectorAll('input')].filter(x=>x.placeholder==='https://example.com'&&visible(x));
       if(inputs.length!==1)throw Error('E_OTHER_URL · 기타 URL 칸 '+inputs.length+'개 발견; 잘못된 입력 방지');
       const entry=inputs[0];
       nativeSet(entry,config.otherUrl);
       if(entry.value!==config.otherUrl)throw Error('E_OTHER_URL_VALUE · 기타 URL 입력값이 일치하지 않습니다.');
       // The TiMO form says Enter or its blue check mark must be used to add a URL.
       // Try the Enter event, but do NOT assume it worked: require a visible committed token.
       entry.focus();
       entry.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
       entry.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
       const urlCommitted=()=>{
         if(entry.value.trim())return false;
         for(let p=entry.parentElement,depth=0;p&&depth<7;depth++,p=p.parentElement){
           const text=String(p.innerText||'');
           if(text.includes(config.otherUrl)&&text.length<1100)return true;
         }
         return false;
       };
       try{await until(urlCommitted,5000,'E_OTHER_URL_UNCOMMITTED');}
       catch(e){
         throw Error('E_OTHER_URL_UNCOMMITTED · 기타 URL이 태그로 확정되지 않았습니다. 티모 화면에서 URL 옆의 ✓ 버튼을 눌러 확정했는지 확인하세요. 현재 저장되지 않았습니다.');
       }
     }
     // "대출", "이자" are fixed excluded words, not title keywords.
     // Never claim completion if this sensitive setting cannot be found.
     stage='금지어 자동입력';
     const banned=findBannedInput();
     if(!banned)throw Error('E_BANNED_FIELD · 금지어 입력칸을 찾지 못했습니다. 금지어 대출·이자가 비어 있는 상태입니다.');
     // TIMO's tag input commits the text before each comma. Ending the
     // sequence with a comma ensures neither last keyword remains pending.
     nativeSet(banned,'대출, 이자,');
     await tick(500);
     const committed=()=>{
       let parent=banned.parentElement;
       for(let depth=0;parent&&depth<5;depth++,parent=parent.parentElement){
         const text=norm(parent.textContent);
         if(text.includes('대출')&&text.includes('이자')&&!banned.value.trim())return true;
       }
       return false;
     };
     await until(committed,4000,'E_BANNED_UNCOMMITTED');
     stage='저장 직전 대기';
     if(buttons('저장').length!==1)throw Error('E_SAVE_READY · 저장 버튼을 확인할 수 없습니다');
     // This routine has no .click() on [저장] or [진행].
     return outcome('STAGED','새 배포 설정 3단계까지 이동했습니다. 화면의 플레이스와 설정을 검토하고 티모 [저장] 버튼을 직접 누르세요.',
       {placeUrl:config.placeUrl,campaignName:config.campaignName,newCampaignVerified:true,keywords:config.keywords.length,genType:config.genType||'기존선택 유지',type:config.type||'기존선택 유지',autoRun:'수동 시작',autoPublish:'검수 후 배포',excluded:['대출','이자'],uniqueComplexCount:quota,dailyLimit:quota,postLimit:quota,saved:false});
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