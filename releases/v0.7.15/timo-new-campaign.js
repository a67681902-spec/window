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
   const blankTextCandidates=()=>[...document.querySelectorAll('input[type="text"],textarea')].filter(el=>
     visible(el)&&el.id!=='dailyLimit'&&el.id!=='postLimit'&&el.id!=='keyword'&&
     !el.name&&el.placeholder!=='https://example.com'&&el.placeholder!=='예) 맛집, 분위기'&&
     el.placeholder!=='검색어'&&el.placeholder!=='https://m.place.naver.com/...');
   const findTitleRequiredTextField=()=>{
     const uploads=[...document.querySelectorAll('input[type="file"]')].filter(el=>
       norm(el.closest('label')?.textContent).includes('제목 내 필수 기재될 텍스트'));
     for(const upload of uploads){
       for(let node=upload.parentElement,depth=0;node&&depth<8;depth++,node=node.parentElement){
         const candidates=blankTextCandidates().filter(el=>node.contains(el));
         if(candidates.length===1)return candidates[0];
       }
     }
     return null;
   };
   const findBlogBottomTagField=()=>{
     // Preferred path: use the visible TiMO label when the rendered DOM exposes it.
     const rx=/^(?:블로그\s*)?하단\s*(?:태그|테그)$/;
     const headings=[...document.querySelectorAll('label,span,div,p,strong,h3,h4')].filter(el=>{
       if(!visible(el)||!rx.test(norm(el.textContent)))return false;
       return ![...el.children].some(child=>rx.test(norm(child.textContent)));
     });
     const matches=[];
     for(const heading of headings){
       let node=heading;
       for(let depth=0;node&&depth<7;depth++,node=node.parentElement){
         const inputs=blankTextCandidates().filter(el=>node.contains(el));
         if(inputs.length===1){matches.push({input:inputs[0],scope:node,mode:'label'});break;}
       }
     }
     const unique=[...new Map(matches.map(x=>[x.input,x])).values()];
     if(unique.length===1)return unique[0];

     // Fallback for the current TiMO form: its form map exposes three unlabeled
     // text controls after the radio options. Exclude the known banned-word
     // field and the title-required-text field; the remaining unique field is
     // the blog bottom-tag control.
     const banned=findBannedInput();
     const titleRequired=findTitleRequiredTextField();
     const candidates=blankTextCandidates().filter(el=>el!==banned&&el!==titleRequired);
     if(candidates.length!==1)return null;
     const input=candidates[0];
     let scope=input.parentElement;
     for(let depth=0;scope&&depth<5;depth++,scope=scope.parentElement){
       const local=blankTextCandidates().filter(el=>scope.contains(el));
       if(local.length===1)break;
     }
     return {input,scope:scope||input.parentElement,mode:'structural'};
   };
   const openAdditionalOptionsForTags=async()=>{
     let found=findBlogBottomTagField();
     if(found)return found;
     const triggers=[...document.querySelectorAll('button,[role="button"],summary')].filter(el=>
       visible(el)&&/추가\s*옵션/.test(norm(el.textContent)));
     if(triggers.length===1){
       triggers[0].click();
       await tick(350);
       found=findBlogBottomTagField();
     }
     return found;
   };
   const applyBlogBottomTags=async(words)=>{
     const list=[...new Set((words||[]).map(x=>String(x||'').trim()).filter(Boolean))];
     if(!list.length)return 0;
     const found=await openAdditionalOptionsForTags();
     if(!found)
       throw Error('E_BOTTOM_TAG_FIELD · 블로그 하단 태그 입력칸을 식별하지 못했습니다. 최신 FORM MAP이 필요합니다.');
     let {input}=found;

     const findTagArea=target=>{
       let fallback=null;
       for(let node=target?.parentElement,depth=0;node&&depth<10;depth++,node=node.parentElement){
         const text=norm(node.innerText||node.textContent||'');
         if(!text.includes('블로그 하단'))continue;
         if(!fallback)fallback=node;
         const clears=[...node.querySelectorAll('button,[role="button"]')].filter(btn=>visible(btn)&&norm(btn.textContent)==='비우기');
         if(clears.length===1)return node;
       }
       return fallback;
     };
     const cleanChip=text=>norm(text).replace(/[×✕✖❌xX]\s*$/,'').trim();
     const chipTextsInArea=area=>{
       if(!area)return [];
       const out=[];
       for(const el of area.querySelectorAll('button,span,li,div')){
         if(!visible(el))continue;
         const raw=norm(el.innerText||el.textContent||'');
         if(!raw||raw.length>80)continue;
         const hasClose=/[×✕✖❌]\s*$/.test(raw)||
           [...el.querySelectorAll('button,[role="button"],span')].some(child=>/^[×✕✖❌xX]$/.test(norm(child.textContent)));
         if(!hasClose)continue;
         const cleaned=cleanChip(raw);
         if(cleaned&&cleaned!=='비우기')out.push(cleaned);
       }
       return [...new Set(out)];
     };
     const exactChipExists=(word,area=findTagArea(input))=>chipTextsInArea(area).includes(word);
     const allExpectedChips=()=>{
       const area=findTagArea(input);
       const chips=chipTextsInArea(area);
       return list.every(word=>chips.includes(word));
     };

     // Always clear the actual bottom-tag section before inserting current keywords.
     // Previous campaign tags must never be carried into a new campaign.
     let area=findTagArea(input);
     if(!area)throw Error('E_BOTTOM_TAG_AREA · 블로그 하단 태그 영역을 찾지 못했습니다.');
     const clearCandidates=[...area.querySelectorAll('button,[role="button"]')]
       .filter(btn=>visible(btn)&&norm(btn.textContent)==='비우기');
     if(clearCandidates.length!==1)
       throw Error('E_BOTTOM_TAG_CLEAR_BUTTON · 하단 태그 비우기 버튼을 '+clearCandidates.length+'개 찾았습니다.');
     clearCandidates[0].click();
     await tick(300);

     // React may replace the input/area after clear.
     const afterClear=findBlogBottomTagField();
     if(afterClear?.input)input=afterClear.input;
     area=findTagArea(input)||area;
     try{
       await until(()=>chipTextsInArea(area).length===0&&!String(input?.value||'').trim(),3500,'E_BOTTOM_TAG_CLEAR');
     }catch{
       throw Error('E_BOTTOM_TAG_CLEAR · 기존 블로그 하단 태그가 완전히 비워지지 않아 새 태그 입력을 중단했습니다.');
     }

     nativeSet(input,list.join(', ')+',');
     await tick(600);

     const refreshed=findBlogBottomTagField();
     if(refreshed?.input)input=refreshed.input;
     area=findTagArea(input)||area;

     try{
       await until(()=>{
         const plain=String(input?.value||'');
         const plainOK=plain&&list.every(word=>plain.includes(word));
         const chipOK=!plain.trim()&&allExpectedChips();
         return plainOK||chipOK;
       },4500,'E_BOTTOM_TAG_UNCOMMITTED');
       return list.length;
     }catch{}

     // Plain text fallback for builds that do not convert hashtags to chips.
     if(input){
       nativeSet(input,list.join(', '));
       input.blur();
       await tick(350);
       const value=String(input.value||'');
       if(list.every(word=>value.includes(word)))return list.length;
     }
     throw Error('E_BOTTOM_TAG_UNCOMMITTED · 기존 태그는 비웠지만 현재 생성 키워드 '+list.length+'개를 하단 태그로 확정하지 못했습니다.');
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
       // Inspect ONLY the new-campaign control. A parent containing both
       // options might report the OLD campaign's selected radio by mistake.
       for(const node of [leaf,control]){
         if(node.matches?.('[role="radio"][aria-checked="true"],[aria-selected="true"],[data-state="checked"],.ant-radio-checked'))
           return true;
         if(node.querySelector?.('input[type="radio"]:checked,[role="radio"][aria-checked="true"],.ant-radio-checked,[data-state="checked"]'))
           return true;
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
     // TiMO is a controlled UI: input/change events can replace the input
     // node synchronously. Never judge the detached old element's value.
     // Reacquire the live named field, and require stability after blur.
     let observed='',match=false;
     for(let attempt=1;attempt<=2&&!match;attempt++){
       let live=findCampaignNameField();
       if(!live.isConnected)throw Error('E_CAMPAIGN_NAME_MISSING · 현재 캠페인명 입력칸이 화면에서 사라졌습니다.');
       if(live.value!==campaignName){
         live.focus();
         nativeSet(live,campaignName);
       }
       live.blur();
       // Wait for React-controlled re-render, without clicking Next yet.
       await tick(450);
       let refreshed=findCampaignNameField();
       observed=String(refreshed.value||'');
       if(observed===campaignName){
         await tick(450);
         refreshed=findCampaignNameField();
         observed=String(refreshed.value||'');
         match=observed===campaignName&&refreshed.isConnected;
       }
     }
     if(!match){
       const expected=JSON.stringify(campaignName);
       const actual=JSON.stringify(observed);
       throw Error('E_CAMPAIGN_NAME_VALUE · 티모 캠페인명이 일치하지 않습니다. 기대값 '+expected+
         ' ('+[...campaignName].length+'자), 화면값 '+actual+' ('+[...observed].length+'자). 다음 단계로 넘어가지 않았습니다.');
     }
     stage='등록 2단계 열기';
     oneButton('다음').click();
     await until(()=>[...document.querySelectorAll('input[name=genType]')].some(x=>!x.disabled),11000,'E_STEP2');
     stage='등록 2단계 설정';
     if(config.type)await radio('type',config.type);
     if(config.genType)await radio('genType',config.genType);
     if(config.keywords?.length){
       const targets=[...document.querySelectorAll('input')].filter(x=>x.placeholder==='예) 맛집, 분위기'&&visible(x));
       if(targets.length!==1)throw Error('E_KEYWORD_FIELD · 생성 키워드 입력칸을 유일하게 찾을 수 없습니다 ('+targets.length+'개)');
       const keywordInput=targets[0];
       // The selected keyword groups + current region are the authoritative
       // set for this new campaign. TiMO may preload chips from the prior run,
       // so reset only this generation-keyword field before applying the set.
       let clearButton=null,scope=keywordInput.parentElement;
       for(let depth=0;scope&&depth<7;depth++,scope=scope.parentElement){
         const found=[...scope.querySelectorAll('button')].filter(b=>visible(b)&&norm(b.textContent)==='비우기');
         if(found.length===1){clearButton=found[0];break;}
       }
       if(!clearButton)throw Error('E_KEYWORD_CLEAR · 생성시 포함할 키워드의 비우기 버튼을 찾지 못했습니다. 기존 키워드에 덧붙이지 않도록 중단합니다.');
       clearButton.click();await tick(350);
       // One plain comma-separated text input; never submit the form.
       nativeSet(keywordInput,config.keywords.join(', '));
       // TIMO converts comma-separated items into chips but can leave the
       // final item as free text. Commit it explicitly before the Next step.
       await tick(350);
       if(keywordInput.value.trim()){
         keywordInput.focus();
         keywordInput.dispatchEvent(new KeyboardEvent('keydown',{
           key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true
         }));
         keywordInput.dispatchEvent(new KeyboardEvent('keyup',{
           key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true
         }));
         await until(()=>!keywordInput.value.trim(),4500,'E_KEYWORD_UNCOMMITTED');
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
     const quota=Number(config.titleCount??config.uniqueComplexCount);
     if(!Number.isSafeInteger(quota)||quota<=0||quota>100000
       ||String(quota)!==String(config.dailyLimit)
       ||String(quota)!==String(config.postLimit))
       throw Error('E_QUOTA_CONFIG · 중복 제거 후 최종 제목 수와 두 발행 제한값이 일치하지 않습니다.');
     const daily=document.getElementById('dailyLimit');
     const total=document.getElementById('postLimit');
     if(!visible(daily)||!visible(total))
       throw Error('E_QUOTA_FIELD · 하루 제한 또는 전체 제한 입력칸을 찾을 수 없습니다.');
     nativeSet(daily,String(quota));
     nativeSet(total,String(quota));
     await tick(300);
     if(daily.value!==String(quota)||total.value!==String(quota))
       throw Error('E_QUOTA_NOT_APPLIED · 최종 제목 수 '+quota+'개를 하루/전체 제한에 적용하지 못했습니다.');
     stage='추가 옵션 · 블로그 하단 태그 자동입력';
     const bottomTagCount=await applyBlogBottomTags(config.keywords);
     const otherUrls=[...new Set((Array.isArray(config.otherUrls)?config.otherUrls:(config.otherUrl?[config.otherUrl]:[]))
       .map(x=>String(x||'').trim()).filter(Boolean))];
     if(otherUrls.length){
       stage='기타 URL '+otherUrls.length+'개 등록';
       const getUrlInput=()=>{
         const inputs=[...document.querySelectorAll('input')].filter(x=>x.placeholder==='https://example.com'&&visible(x));
         if(inputs.length!==1)throw Error('E_OTHER_URL · 기타 URL 칸 '+inputs.length+'개 발견; 잘못된 입력 방지');
         return inputs[0];
       };
       const canonical=value=>{
         try{
           const u=new URL(String(value||'').trim());
           const path=(u.pathname||'/').replace(/\/+$/,'')||'';
           return (u.protocol+'//'+u.host+path+(u.search||'')+(u.hash||'')).toLowerCase();
         }catch{return String(value||'').trim().replace(/\/+$/,'').toLowerCase();}
       };
       const urlCommitted=url=>{
         const key=canonical(url);
         // 1) rendered links or separate stored fields
         const anchors=[...document.querySelectorAll('a[href]')];
         if(anchors.some(a=>canonical(a.href)===key))return true;
         const fields=[...document.querySelectorAll('input,textarea')].filter(el=>
           el.placeholder!=='https://example.com'&&canonical(el.value)===key);
         if(fields.length)return true;
         // 2) rendered list/tag text. Input values themselves are not part of textContent.
         const nodes=[...document.querySelectorAll('li,span,p,div')].filter(el=>{
           if(!visible(el))return false;
           const text=String(el.innerText||el.textContent||'').trim();
           if(!text||text.length>700)return false;
           const compact=text.replace(/\s+/g,' ');
           return compact.includes(url)||compact.includes(url.replace(/\/$/,''));
         });
         return nodes.length>0;
       };
       const localAddButton=input=>{
         const blocked=new Set(['저장','이전','삭제','비우기','다음','등록','조회']);
         for(let node=input.parentElement,depth=0;node&&depth<4;depth++,node=node.parentElement){
           const urlInputs=[...node.querySelectorAll('input')].filter(el=>el.placeholder==='https://example.com'&&visible(el));
           if(urlInputs.length!==1)continue;
           const candidates=[...node.querySelectorAll('button,[role="button"],span')].filter(el=>{
             if(!visible(el)||el.contains(input)||input.contains?.(el))return false;
             const label=norm(el.textContent);
             if(blocked.has(label))return false;
             const rect=el.getBoundingClientRect();
             const hasIcon=!!el.querySelector?.('svg');
             const looksCheck=/^[✓✔]$/.test(label);
             const nearRight=rect.left>=input.getBoundingClientRect().right-80&&rect.right<=input.getBoundingClientRect().right+90;
             return (hasIcon||looksCheck)&&nearRight;
           });
           const unique=[...new Set(candidates.map(el=>el.closest('button,[role="button"]')||el))].filter(visible);
           if(unique.length===1)return unique[0];
         }
         return null;
       };
       const pressEnter=input=>{
         input.focus();
         input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
         input.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
       };
       for(let index=0;index<otherUrls.length;index++){
         const url=otherUrls[index];
         stage='기타 URL '+(index+1)+'/'+otherUrls.length+' 등록';
         if(urlCommitted(url))continue;

         let entry=getUrlInput();
         entry.focus();
         nativeSet(entry,url);
         await tick(250);
         if(!entry.isConnected)entry=getUrlInput();
         if(!urlCommitted(url)&&String(entry.value||'').trim()!==url)
           throw Error('E_OTHER_URL_VALUE · '+(index+1)+'번째 URL 입력값을 티모가 받아들이지 않았습니다: '+url);

         // Strategy A: current TiMO shows a blue check control at the right edge of 기타 URL.
         let add=localAddButton(entry);
         if(add&&!urlCommitted(url)){
           add.click();
           await tick(650);
         }

         // Strategy B: older TiMO builds committed with Enter.
         if(!urlCommitted(url)){
           entry=getUrlInput();
           if(String(entry.value||'').trim()!==url)nativeSet(entry,url);
           pressEnter(entry);
           await tick(650);
         }

         // Strategy C: some controlled inputs commit on change/blur.
         if(!urlCommitted(url)){
           entry=getUrlInput();
           if(String(entry.value||'').trim()!==url)nativeSet(entry,url);
           entry.dispatchEvent(new Event('change',{bubbles:true}));
           entry.blur();
           await tick(650);
         }

         try{await until(()=>urlCommitted(url),4500,'E_OTHER_URL_UNCOMMITTED');}
         catch(e){
           const current=getUrlInput();
           throw Error('E_OTHER_URL_UNCOMMITTED · '+(index+1)+'번째 기타 URL이 실제 등록 목록에 생성되지 않았습니다: '+url+
             ' / 현재 입력값: '+JSON.stringify(String(current.value||'')));
         }

         // React can replace the input after each successful addition. Always
         // reacquire on the next iteration rather than keeping a stale node.
         await tick(250);
       }
       const missing=otherUrls.filter(url=>!urlCommitted(url));
       if(missing.length)throw Error('E_OTHER_URL_FINAL · 최종 확인에서 빠진 기타 URL: '+missing.join(', '));
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
       {placeUrl:config.placeUrl,campaignName:config.campaignName,newCampaignVerified:true,keywords:config.keywords.length,bottomTags:bottomTagCount,otherUrls:otherUrls.length,genType:config.genType||'기존선택 유지',type:config.type||'기존선택 유지',autoRun:'수동 시작',autoPublish:'검수 후 배포',excluded:['대출','이자'],titleCount:quota,uniqueComplexCount:config.uniqueComplexCount??null,dailyLimit:quota,postLimit:quota,saved:false});
   };
   return run().catch(e=>outcome('E_STAGE_FAILED',e.message,{saved:false}));
 }
 let result;
 try{
   const stored=await chrome.storage.local.get('timoNewCampaignPendingV1');
   const config=stored.timoNewCampaignPendingV1;
   if(!config||typeof config!=='object'||!config.placeUrl)
     throw Error('E_CONFIG · 신규 배포 실행 설정이 없습니다. 생성기에서 다시 시작하세요.');
   result=await executeWizard(config);
 }catch(e){result=safe(e.message);}
 // Reflect result in the actual TiMO browser tab, not just the extension UI
 // behind it. The user can screenshot a precise failing stage/error code.
 try{
   document.getElementById('timo-wizard-status-058')?.remove();
   const banner=document.createElement('div');
   banner.id='timo-wizard-status-058';
   banner.setAttribute('role','status');
   banner.style.cssText=[
     'position:fixed','bottom:18px','right:18px','max-width:420px',
     'z-index:2147483647','padding:14px 16px','border-radius:10px',
     'box-shadow:0 7px 22px #182d4566','font:13px/1.65 system-ui,sans-serif',
     'white-space:pre-wrap','overflow-wrap:anywhere','color:#152b49',
     'background:'+(result.ok?'#e8f5ee':'#fff0e9'),
     'border:1px solid '+(result.ok?'#69a487':'#d69473')
   ].join(';');
   const header=document.createElement('strong');
   header.textContent=result.ok?'신규 배포 설정 확인 단계':'자동등록 입력 중단';
   const close=document.createElement('button');
   close.type='button';close.textContent='닫기 ×';
   close.style.cssText='float:right;border:1px solid #ccd6e3;border-radius:5px;padding:3px 7px;background:#fff;cursor:pointer';
   close.addEventListener('click',()=>banner.remove());
   const content=document.createElement('div');
   const shortMessage=String(result.message||'응답 없음').slice(0,480);
   content.textContent='단계: '+(result.stage||'설정 확인')+'\n'+(result.code||'E_UNKNOWN')+'\n'+shortMessage+
     '\n\n[저장]과 [진행]은 자동으로 실행하지 않았습니다.';
   banner.append(close,header,content);
   document.body.append(banner);
 }catch{}
 return result;
})();