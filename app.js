(() => {
  const form = document.getElementById("quoteForm");
  const submitBtn = document.getElementById("submitBtn");
  const status = document.getElementById("formStatus");
  const phone = form.elements.phone;
  const params = new URLSearchParams(location.search);
  document.getElementById("sourceField").value = params.get("utm_source") || params.get("source") || document.referrer || "direct";
  document.getElementById("pageField").value = location.href;
  document.getElementById("deviceField").value = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop";
  phone.addEventListener("input",(e)=>{const n=e.target.value.replace(/\D/g,"").slice(0,11);if(n.length<4)e.target.value=n;else if(n.length<8)e.target.value=`${n.slice(0,3)}-${n.slice(3)}`;else e.target.value=`${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7)}`;});
  form.addEventListener("submit",async(e)=>{
    e.preventDefault();
    const url=window.LANDING_CONFIG?.GOOGLE_SCRIPT_URL||"";
    if(!url||url.includes("PASTE_YOUR")){status.className="form-status err";status.textContent="Google Sheets 연결 주소가 아직 설정되지 않았습니다.";return;}
    const payload=Object.fromEntries(new FormData(form).entries());payload.submittedAt=new Date().toISOString();payload.userAgent=navigator.userAgent;
    submitBtn.disabled=true;submitBtn.textContent="접수 중...";status.className="form-status";status.textContent="";
    try{await fetch(url,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});status.className="form-status ok";status.textContent="견적 요청이 접수되었습니다. 확인 후 연락드리겠습니다.";form.reset();document.getElementById("sourceField").value=params.get("utm_source")||"direct";document.getElementById("pageField").value=location.href;document.getElementById("deviceField").value=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)?"mobile":"desktop";}
    catch(err){status.className="form-status err";status.textContent="접수 중 오류가 발생했습니다. 전화 상담을 이용해주세요.";}
    finally{submitBtn.disabled=false;submitBtn.textContent="무료 견적 요청하기";}
  });
})();