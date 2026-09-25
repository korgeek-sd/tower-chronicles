import React,{useMemo} from 'react';
import type {MarketTrade} from '../../game/types';
import {marketChart,marketStats} from '../../game/market/marketStatistics';

const money=(n:number|null)=>n===null?'—':Math.round(n).toLocaleString()+' S';

export function MarketChartPreview({itemId,trades,demo}:{itemId:string;trades:MarketTrade[];demo:boolean}){
 const now=Date.now(),points=useMemo(()=>marketChart(trades,itemId,'24H',now),[trades,itemId]),stats=useMemo(()=>marketStats(trades,itemId,'24H',now),[trades,itemId]);
 const prices=points.map(p=>p.price),min=prices.length?Math.min(...prices):0,max=prices.length?Math.max(...prices):0,spread=max-min||1,maxVolume=Math.max(1,...points.map(p=>p.volume));
 const coords=points.map((p,i)=>({x:points.length<=1?50:i/(points.length-1)*100,y:74-(p.price-min)/spread*58,p}));
 const poly=coords.map(p=>p.x+','+p.y).join(' ');
 const change=stats.priceChangePercent??0;
 return <section className="tc-market-chart" aria-label="24시간 가격 차트">
  <div className="tc-chart-head"><div><small>24H PRICE</small><b>{money(stats.lastPrice)}</b></div><span className={change>0?'up':change<0?'down':''}>{change>0?'+':''}{change.toFixed(1)}%</span>{demo&&<em>미리보기 거래</em>}</div>
  <div className="tc-chart-plot">
   <svg viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true"><path className="grid" d="M0 16H100 M0 45H100 M0 74H100"/>{poly&&<polyline points={poly}/>} {coords.map((c,i)=><circle key={i} cx={c.x} cy={c.y} r="1.2"/>)}</svg>
   <div className="tc-volume-bars">{coords.map((c,i)=><i key={i} style={{height:Math.max(7,c.p.volume/maxVolume*100)+'%'}}/>)}</div>
  </div>
  <div className="tc-chart-foot"><span>저 {money(stats.lowPrice)}</span><span>{stats.tradeCount}건 · {stats.volume}개</span><span>고 {money(stats.highPrice)}</span></div>
 </section>;
}
