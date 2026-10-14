'use strict';
(() => {
  const $ = id => document.getElementById(id);
  if ($('githubMasterBtn')) return;

  // Match province-level searches ONLY against the province part of the
  // complete administrative address; "대구" must never match "해운대구".
  const major = {
    '대구':['대구','대구광역시'], '서울':['서울','서울특별시'],
    '부산':['부산','부산광역시'], '인천':['인천','인천광역시'],
    '광주':['광주','광주광역시'], '대전':['대전','대전광역시'],
    '울산':['울산','울산광역시'], '세종':['세종','세종특별자치시'],
    '경남':['경남','경상남도'], '경북':['경북','경상북도'],
    '전남':['전남','전라남도'], '전북':['전북','전라북도','전북특별자치도'],
    '충남':['충남','충청남도'], '충북':['충북','충청북도'],
    '강원':['강원','강원도','강원특별자치도'], '제주':['제주','제주특별자치도']
  };
  const provinces = Object.entries(major).flatMap(([k,aliases])=>
    aliases.map(alias=>[norm(alias),k]));
  const provinceAlias=new Map(provinces);
  const normArea=s=>norm(s).replace(/(특별자치시|특별자치도|광역시|특별시|도|시|군|구)$/u,'');
  const exactRegion=(address,tokens)=>{
    const parts=String(address||'').trim().split(/\s+/).filter(Boolean);
    const province=norm(parts[0]||'');
    const provinceShort=provinceAlias.get(province);
    const areas=parts.slice(1,4).map(norm);
    for(const token of tokens){
      const phrases=String(token).trim().split(/\s+/).filter(Boolean);
      const ok=phrases.length>0&&phrases.every(word=>{
        const w=norm(word);
        const wShort=provinceAlias.get(w)||major[word]&&word;
        if(wShort||major[word]) return wShort===provinceShort;
        return areas.some(place=>place===w || normArea(place)===normArea(w));
      });
      if(ok)return token;
    }
    return '';
  };
  matchesRegion=exactRegion;

  // On the official dataset '도로명주소' has no province. Force '주소'.
  const previousMakeMappings=makeMappings;
  makeMappings=function(){
    previousMakeMappings();
    const defs={
      colAddr:'주소',colName:'단지명_공시가격',colId:'단지고유번호',
      colYear:'사용승인일',colUnits:'세대수',colType:'단지종류'
    };
    for(const [id,header] of Object.entries(defs)){
      const column=csvHeaders.findIndex(h=>norm(h)===norm(header));
      if(column>=0)$(id).value=String(column);
    }
  };

  const url='https://raw.githubusercontent.com/a67681902-spec/window/timo-updates/data/apartments_20260831.csv';
  const block=document.createElement('div');
  block.style.cssText='margin-top:12px;border:1px solid #d7e5f6;border-radius:9px;padding:12px;background:#f5f8ff';
  block.innerHTML='<button class="btn secondary" type="button" id="githubMasterBtn">GitHub 공동주택 DB 자동 불러오기</button><p class="hint" id="githubMasterState">전국 아파트 46,385개 데이터 · 파일 등록 후 자동 불러옵니다. 기존 CSV 직접 선택도 가능합니다.</p>';
  $('csvInput').parentElement.appendChild(block);
  const btn=$('githubMasterBtn'),info=$('githubMasterState');
  let inProgress=false;
  async function fromGithub(silent=false){
    if(inProgress)return;
    inProgress=true;btn.disabled=true;
    if(!silent){info.textContent='GitHub 데이터를 다운로드하는 중입니다…';}
    try {
      const response=await fetch(url,{cache:'default'});
      if(!response.ok){
        if(response.status===404)throw new Error('GitHub 데이터 파일이 아직 등록되지 않았습니다.');
        throw new Error('GitHub HTTP '+response.status);
      }
      const data=await response.blob();
      const file=new File([data],'apartments_20260831.csv',{type:'text/csv'});
      const parsed=await readCSV(file);
      output=[];uniqueMatches=[];updatePreview();makeMappings();
      $('mapping').classList.remove('hidden');
      $('totalCount').textContent=numfmt(parsed.count);
      info.textContent='GitHub 공동주택 DB '+numfmt(parsed.count)+'행 불러오기 완료 (공개 아파트 자료, 2026-08-31)';
      status('loadStatus','GitHub 데이터 '+numfmt(parsed.count)+'행을 불러왔습니다. 지역·사용승인일·세대수 조건을 지정해 제목을 생성하세요.','good');
    } catch(err){
      info.textContent='GitHub 자동 불러오기: '+err.message+' 원본 CSV 직접 선택은 계속 이용할 수 있습니다.';
      if(!silent)status('loadStatus',info.textContent,'err');
    } finally{btn.disabled=false;inProgress=false;}
  }
  btn.addEventListener('click',()=>fromGithub(false));
  if(!$('regions').value.trim())$('regions').value='대구';
  for(const [id,v] of [['yearFrom','1991'],['yearTo','2008'],['unitsFrom','20'],['unitsTo','5000']]){
    if(!$(id).value.trim())$(id).value=v;
  }
  // Auto-load when the published dataset exists. A missing file is non-fatal.
  fromGithub(true);
})();