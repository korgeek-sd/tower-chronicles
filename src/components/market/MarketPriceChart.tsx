import React from 'react';
export type PriceSample={price:number;executedAt?:number};
export function priceChartGeometry(samples:PriceSample[]){
 if(!samples.length)return null;
 const low=Math.min(...samples.map(s=>s.price)),high=Math.max(...samples.map(s=>s.price));
 const padding=high===low?Math.max(1,high*.01):(high-low)*.12;
 const min=low-padding,max=high+padding;
 const first=samples[0].executedAt,last=samples.at(-1)!.executedAt;
 const timed=first!==undefined&&last!==undefined&&last>first&&samples.every(s=>s.executedAt!==undefined);
 const points=samples.map((s,i)=>({x:timed?(s.executedAt!-first!)/(last!-first!)*100:i/Math.max(1,samples.length-1)*100,y:60-(s.price-min)/(max-min)*56}));
 return {low,high,points,polyline:points.map(p=>`${p.x},${p.y}`).join(' '),first,last,timed};
}
export function MarketPriceChart({samples,demo=false}:{samples:PriceSample[];demo?:boolean}){
 const chart=priceChartGeometry(samples);
 const time=(at:number)=>new Date(at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
 return <div className="tc-market-price-chart">
  <div className="tc-chart-caption"><span>가격 · S</span><small>{demo?'DEMO · 예시 데이터':'체결 기록'}</small></div>
  {chart?<><div className="tc-chart-canvas"><div className="tc-chart-axis"><span>{chart.high.toLocaleString()}</span><span>{chart.low.toLocaleString()}</span></div><svg viewBox="0 0 100 64" preserveAspectRatio="none" role="img" aria-label={`체결 가격 추이 · 최저 ${chart.low} S · 최고 ${chart.high} S`}><line x1="0" y1="4" x2="100" y2="4"/><line x1="0" y1="32" x2="100" y2="32"/><line x1="0" y1="60" x2="100" y2="60"/>{samples.length>1&&<polyline points={chart.polyline} fill="none" vectorEffect="non-scaling-stroke"/>}<circle cx={chart.points.at(-1)!.x} cy={chart.points.at(-1)!.y} r="1.1"/></svg></div><div className="tc-chart-times"><span>{chart.timed?time(chart.first!):'첫 기록'}</span><span>{chart.timed?time(chart.last!):'최근 기록'}</span></div></>:<div className="tc-chart-empty">선택한 기간의 체결 기록이 없습니다.</div>}
 </div>;
}
export function MarketRecentTrades({trades,demo=false}:{trades:{price:number;quantity?:number;executedAt?:number}[];demo?:boolean}){
 return <section className="tc-market-recent-trades"><header><b>최근 체결</b><small>{demo?'DEMO · 예시':'시각 · 가격 · 수량'}</small></header>{trades.length?trades.slice(-3).reverse().map((t,i)=><div key={i}><time>{t.executedAt?new Date(t.executedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'예시'}</time><b>{t.price.toLocaleString()} S</b><span>{t.quantity===undefined?'—':t.quantity.toLocaleString()+'개'}</span></div>):<p>체결 기록이 없습니다.</p>}</section>;
}
