(() => {
 const forms=[...document.querySelectorAll('form')]; let sending=false;
 function message(form,text,ok=false){let el=form.querySelector('.result');if(!el){el=document.createElement('p');el.className='result';el.setAttribute('role','status');form.append(el)}el.textContent=text;el.style.color=ok?'#16824b':'#cc3131';}
 forms.forEach(form=>form.addEventListener('submit',async e=>{
  e.preventDefault();if(sending||!form.reportValidity())return;
  const fixed=form.classList.contains('fixed-quote-inner');const inputs=[...form.querySelectorAll('input')];const selects=[...form.querySelectorAll('select')];
  const main=forms.find(f=>!f.classList.contains('fixed-quote-inner'));
  const data={name:inputs[0].value.trim(),phone:fixed?`010-${inputs[2].value}-${inputs[3].value}`:inputs[1].value,region:selects[0].value,building:fixed?'':selects[1].value,scope:fixed?'':selects[2].value,detail:'',source:document.referrer||'확인불가',landing:location.href,device:/Mobi|Android|iPhone/i.test(navigator.userAgent)?'모바일':'PC',consent:form.querySelector('[type=checkbox]').checked};
  if(!/^01[016789]-?\d{3,4}-?\d{4}$/.test(data.phone.replace(/\s/g,''))){message(form,'휴대폰 번호를 확인해 주세요.');return;}
  sending=true;forms.forEach(f=>f.querySelector('button').disabled=true);message(form,'접수 중...');
  try{const response=await fetch('/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'접수되지 않았습니다. 잠시 후 다시 시도해 주세요.');message(form,'견적 요청이 접수되었습니다. 담당자가 연락드리겠습니다.',true);form.reset();}
  catch(error){message(form,error.message);}
  finally{sending=false;forms.forEach(f=>f.querySelector('button').disabled=false);}
 }));
 fetch('/api/requests').then(r=>r.json()).then(({ready})=>{
  if(ready)return;
  forms.forEach(form=>{form.querySelector('button').disabled=true;});
  const form=forms.find(f=>!f.classList.contains('fixed-quote-inner'));
  if(form)message(form,'온라인 접수를 준비 중입니다.');
 }).catch(()=>{
  forms.forEach(form=>{form.querySelector('button').disabled=true;});
  const form=forms.find(f=>!f.classList.contains('fixed-quote-inner'));
  if(form)message(form,'접수 연결을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
 });
})();
