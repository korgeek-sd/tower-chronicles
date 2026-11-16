import React,{useMemo,useState} from 'react';
import {Screen,Glyph} from '../../ui/mobile';

/**
 * Market-trends presentation preview. The production economy does NOT yet
 * apply these effects. Never describe these samples as real server buffs.
 */
type MarketEffect={name:string;change:string;target:string;description:string};
const DEMO_BOOM:MarketEffect={
 name:'연금술 산업 호황',change:'+100%',target:'물약 생산',
 description:'회복 물약의 예상 제작 수량이 2배가 되는 효과 예시입니다.'
};
const DEMO_SLUMP:MarketEffect={
 name:'전리품 공급 위축',change:'−30%',target:'장비 드롭',
 description:'사냥 장비의 기본 드롭 확률이 상대적으로 30% 감소하는 효과 예시입니다.'
};
const IMPACTS=[
 {id:'potions',label:'물약 생산',value:'+100%',tone:'up'},
 {id:'sword',label:'장비 드롭',value:'−30%',tone:'down'},
 {id:'potions',label:'음식 생산',value:'변화 없음',tone:'flat'},
 {id:'farm',label:'농업',value:'변화 없음',tone:'flat'},
 {id:'materials',label:'채집',value:'변화 없음',tone:'flat'},
 {id:'tickets',label:'실버 획득',value:'변화 없음',tone:'flat'},
 {id:'bestiary',label:'경험치 획득',value:'변화 없음',tone:'flat'}
] as const;
const HISTORY_SAMPLES=[
 ['농업 생산 호황','농업 생산 +50%','연금술 산업 불황','물약 생산 −50%'],
 ['전리품 공급 확대','장비 드롭 +30%','식자재 수급난','음식 재료 +50%'],
 ['식품 생산 호황','음식 생산 +100%','통화 긴축','실버 획득 −30%'],
 ['약초 공급 확대','채집 획득 +50%','농업 생산 침체','농업 생산 −50%'],
 ['통화 유동성 확대','실버 획득 +30%','전리품 공급 위축','장비 드롭 −30%'],
 ['생산성 혁신','제작 시간 −30%','식량 부족','음식 재료 +50%'],
 ['연금술 산업 호황','물약 생산 +100%','성장 정체기','경험치 획득 −30%']
] as const;
const kstDate=(value:number)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',weekday:'short'}).format(new Date(value));

export function MarketTrendsScreen({onBack,now}:{onBack:()=>void;now:number}){
 const [tab,setTab]=useState<'today'|'history'>('today');
 const [historyPage,setHistoryPage]=useState(0);
 const [expanded,setExpanded]=useState<number|null>(null);
 const days=useMemo(()=>Array.from({length:7},(_,i)=>historyPage*7+i+1),[historyPage]);
 const today=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric'}).format(new Date(now));
 return <Screen title="시장 동향" hideHeader className="tc-market-trends-screen">
  <div className="tc-market-trends-page">
   <header className="tc-mt-header">
    <button type="button" aria-label="거점으로 돌아가기" onClick={onBack} className="tc-mt-back">〈</button>
    <h1><Glyph name="market"/> 시장 동향</h1>
    <span className="tc-mt-preview-mark">시범 UI</span>
   </header>
   <div className="tc-mt-tabs" role="tablist" aria-label="시장 동향 메뉴">
    <button type="button" role="tab" aria-selected={tab==='today'} onClick={()=>setTab('today')}><Glyph name="market"/>오늘의 동향</button>
    <button type="button" role="tab" aria-selected={tab==='history'} onClick={()=>setTab('history')}><Glyph name="bestiary"/>동향 이력</button>
   </div>
   {tab==='today'?<div className="tc-mt-today" role="tabpanel">
    <section className="tc-mt-hero" aria-label="오늘의 시장 동향">
     <div className="tc-mt-hero-shade">
      <small>{today} · 노바르 경제</small>
      <h2>오늘의 시장 동향</h2>
      <p>호황과 불황이 세계의 생산과 전리품에 영향을 줍니다.</p>
      <span>매일 00:00 발표 · 서울 시간</span>
     </div>
    </section>
    <div className="tc-mt-sample-note" role="status">시범 표시 · 아래 수치는 실제 생산·장비 드롭에 적용되지 않습니다.</div>
    <section className="tc-mt-effects" aria-label="시장 동향 예시 두 가지">
     <div className="tc-mt-effect up">
      <div className="tc-mt-effect-type">↑ 호황</div>
      <h3>{DEMO_BOOM.name}</h3>
      <p><Glyph name="potions"/>{DEMO_BOOM.target} <b>×2</b></p>
      <small>{DEMO_BOOM.description}</small>
     </div>
     <div className="tc-mt-effect down">
      <div className="tc-mt-effect-type">↓ 불황</div>
      <h3>{DEMO_SLUMP.name}</h3>
      <p><Glyph name="sword"/>{DEMO_SLUMP.target} <b>−30%</b></p>
      <small>{DEMO_SLUMP.description}</small>
     </div>
    </section>
    <section className="tc-mt-impacts" aria-label="전체 시장 영향 예시">
     <h3><Glyph name="market"/> 전체 시장 영향 <span>시범 기준</span></h3>
     <div className="tc-mt-impact-list">{IMPACTS.map((r,i)=><div className="tc-mt-impact-row" key={r.label}>
      <span><Glyph name={r.id}/>{r.label}</span><strong className={r.tone}>{r.value}</strong>
     </div>)}</div>
    </section>
   </div>:<section className="tc-mt-history" role="tabpanel" aria-label="동향 이력 예시">
    <div className="tc-mt-history-heading"><h2>동향 이력</h2><span>최근 30일 · 시범 이력</span></div>
    <p className="tc-mt-history-warning">현재는 화면 확인용 예시입니다. 서버 동향 기록이 연결되면 실제 이력으로 교체됩니다.</p>
    <div className="tc-mt-history-rows">{days.filter(n=>n<=30).map((n,i)=>{
     const sample=HISTORY_SAMPLES[(n-1)%HISTORY_SAMPLES.length];
     const isOpen=expanded===n;
     return <button type="button" className={'tc-mt-history-row'+(isOpen?' expanded':'')} key={n} aria-expanded={isOpen} onClick={()=>setExpanded(isOpen?null:n)}>
      <span className="tc-mt-day">{kstDate(now-n*86400000)}</span>
      <span className="tc-mt-pair">
       <span className="up">↑ {sample[0]}</span><span className="down">↓ {sample[2]}</span>
       {isOpen&&<span className="tc-mt-history-details">{sample[1]} / {sample[3]} · 시범 데이터</span>}
      </span>
      <span aria-hidden="true">{isOpen?'⌃':'›'}</span>
     </button>;
    })}</div>
    <div className="tc-mt-history-pager">
     <button type="button" onClick={()=>{setHistoryPage(n=>Math.max(0,n-1));setExpanded(null)}} disabled={historyPage===0}>이전</button>
     <span>{historyPage+1} / 5</span>
     <button type="button" onClick={()=>{setHistoryPage(n=>Math.min(4,n+1));setExpanded(null)}} disabled={historyPage===4}>다음</button>
    </div>
   </section>}
  </div>
 </Screen>;
}
