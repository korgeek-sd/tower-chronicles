import React,{useEffect,useMemo,useState} from 'react';
import type {OnlineGoldExchangeTrade} from '../../online/goldExchange';

export type CandleRange='15m'|'1h'|'4h'|'1d'|'all';
export interface GoldCandle{
 bucket:number;startAt:number;open:number;high:number;low:number;close:number;volume:number;trades:number;
}
const PERIODS:readonly [CandleRange,string][]=[
 ['15m','15분'],['1h','1시간'],['4h','4시간'],['1d','1일'],['all','전체']
];
const KST=(time:number)=>new Date(time).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const fmt=(value:number)=>value.toLocaleString('ko-KR',{maximumFractionDigits:0});

export function buildGoldCandles(
 trades:readonly OnlineGoldExchangeTrade[],range:CandleRange,
 now=Date.now(),
):{bars:GoldCandle[];from:number;to:number;periodMs:number;totalVolume:number}{
 const rows=trades.filter(t=>Number.isFinite(t.executedAt)&&Number.isSafeInteger(t.priceSilverPerGold)&&t.priceSilverPerGold>0&&t.goldQuantity>0&&t.executedAt<=now)
  .slice().sort((a,b)=>a.executedAt-b.executedAt||a.tradeId.localeCompare(b.tradeId));
 const min=rows[0]?.executedAt??now;
 const interval=range==='15m'?900_000:range==='1h'?3_600_000:range==='4h'?14_400_000:range==='1d'?86_400_000:
  Math.max(900_000,Math.ceil(((now-min)/47)/900_000)*900_000);
 const to=Math.floor(now/interval)*interval+interval;
 const from=to-48*interval;
 const buckets=new Map<number,GoldCandle>();
 for(const t of rows){
  if(t.executedAt<from||t.executedAt>=to)continue;
  const idx=Math.floor((t.executedAt-from)/interval);
  const bar=buckets.get(idx);
  if(bar){
   bar.high=Math.max(bar.high,t.priceSilverPerGold);
   bar.low=Math.min(bar.low,t.priceSilverPerGold);
   bar.close=t.priceSilverPerGold;
   bar.volume+=t.goldQuantity;
   bar.trades++;
  }else buckets.set(idx,{
   bucket:idx,startAt:from+idx*interval,
   open:t.priceSilverPerGold,high:t.priceSilverPerGold,
   low:t.priceSilverPerGold,close:t.priceSilverPerGold,
   volume:t.goldQuantity,trades:1,
  });
 }
 const bars=[...buckets.values()].sort((a,b)=>a.bucket-b.bucket);
 return {bars,from,to,periodMs:interval,totalVolume:bars.reduce((sum,b)=>sum+b.volume,0)};
}

export function GoldExchangePriceChart({
 trades,lastPrice,onClose,
}:{
 trades:readonly OnlineGoldExchangeTrade[];
 lastPrice:number|null;
 onClose:()=>void;
}){
 const [range,setRange]=useState<CandleRange>('4h');
 const chart=useMemo(()=>buildGoldCandles(trades,range),[trades,range]);
 const {bars}=chart;
 const prices=bars.flatMap(bar=>[bar.high,bar.low]);
 const max=prices.length?Math.max(...prices):0;
 const min=prices.length?Math.min(...prices):0;
 const pad=Math.max(1,(max-min)*.12);
 const top=max+pad,bottom=Math.max(0,min-pad),spread=top-bottom||1;
 const priceY=(n:number)=>12+(top-n)/spread*132;
 const candleX=(idx:number)=>16+(idx+.5)*6.6;
 const volumeMax=Math.max(1,...bars.map(b=>b.volume));
 const candleW=5.1;
 const windowTrades=bars.reduce((s,b)=>s+b.trades,0);
 const close=bars.at(-1)?.close??null;
 const open=bars[0]?.open??null;
 const change=open&&close!==null?(close-open)/open*100:null;
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
  document.addEventListener('keydown',onKey);
  return()=>document.removeEventListener('keydown',onKey);
 },[onClose]);
 return <div className="tc-goldx-chart-overlay" role="dialog" aria-modal="true" aria-label="골드 시세 차트">
  <header className="tc-goldx-chart-head">
   <button type="button" onClick={onClose} aria-label="골드 거래소로 돌아가기">‹ <span>거래소</span></button>
   <strong>골드 / 실버 시세</strong>
   <span className="tc-goldx-chart-live">실제 체결</span>
  </header>
  <div className="tc-goldx-chart-quote">
   <div><small>최근 체결가 · 1 Gold당 Silver</small><b>{lastPrice===null?'체결 대기':fmt(lastPrice)+' S'}</b></div>
   <div><small>선택 구간 변동률</small><strong className={change===null?'flat':change<0?'down':'up'}>{change===null?'—':(change>0?'+':'')+change.toFixed(2)+'%'}</strong></div>
  </div>
  <nav className="tc-goldx-chart-periods" aria-label="시세 시간 단위">
   {PERIODS.map(([id,label])=><button key={id} type="button" aria-pressed={range===id} onClick={()=>setRange(id)}>{label}</button>)}
  </nav>
  <div className="tc-goldx-chart-canvas">
   {bars.length?
    <svg viewBox="0 0 360 218" preserveAspectRatio="none" role="img" aria-label={range+' 실거래 캔들차트, 체결 '+windowTrades+'건'}>
     {Array.from({length:5},(_,i)=>{
      const val=top-spread*i/4,y=12+i*33;
      return <g key={'axis'+i}><line x1="12" x2="345" y1={y} y2={y} stroke="#343a43" strokeWidth=".65"/><text x="355" y={y-3} textAnchor="end" fill="#9e9c94" fontSize="9">{fmt(val)}</text></g>;
     })}
     {bars.map(b=>{
      const x=candleX(b.bucket),up=b.close>b.open,down=b.close<b.open;
      const color=up?'#53ad80':down?'#d56f73':'#d3ad6c';
      const o=priceY(b.open),c=priceY(b.close);
      const vHeight=Math.max(1,(b.volume/volumeMax)*46);
      return <g key={b.bucket}>
       <line x1={x} x2={x} y1={priceY(b.high)} y2={priceY(b.low)} stroke={color} strokeWidth="1.25"/>
       <rect x={x-candleW/2} y={Math.min(o,c)} width={candleW} height={Math.max(2,Math.abs(o-c))} fill={color}/>
       <rect x={x-candleW/2} y={209-vHeight} width={candleW} height={vHeight} fill={color} opacity=".8"/>
      </g>;
     })}
     <line x1="12" x2="345" y1="155" y2="155" stroke="#67583c" strokeWidth="1"/>
     <text x="16" y="166" fill="#a99a81" fontSize="8">거래량(G)</text>
     <text x="16" y="215" fill="#9b978e" fontSize="9">{KST(chart.from)}</text>
     <text x="340" y="215" fill="#9b978e" fontSize="9" textAnchor="end">{KST(chart.to)}</text>
    </svg>:
    <div className="tc-goldx-chart-no-data">
     <strong>선택한 구간에 체결 기록이 없습니다.</strong>
     <span>실제 거래가 체결되면 캔들 차트가 표시됩니다.</span>
    </div>
   }
  </div>
  <section className="tc-goldx-chart-stats" aria-label="선택 구간 거래 현황">
   <div><small>최고가</small><b>{bars.length?fmt(max)+' S':'—'}</b></div>
   <div><small>최저가</small><b>{bars.length?fmt(min)+' S':'—'}</b></div>
   <div><small>거래량</small><b>{fmt(chart.totalVolume)} G</b></div>
   <div><small>체결 건수</small><b>{fmt(windowTrades)}건</b></div>
  </section>
  <section className="tc-goldx-chart-trades">
   <header><b>최근 체결</b><small>가격(S/G) · 수량(G) · 한국 시간</small></header>
   <div>
    {trades.slice(0,5).map(t=><div key={t.tradeId}><b>{fmt(t.priceSilverPerGold)} S</b><span>{fmt(t.goldQuantity)} G</span><time>{KST(t.executedAt)}</time></div>)}
    {!trades.length&&<p>아직 체결된 거래가 없습니다.</p>}
   </div>
  </section>
  <footer>서버의 최근 체결 최대 200건으로 표시합니다. 체결이 없는 구간의 가격은 생성하지 않습니다.</footer>
 </div>;
}
