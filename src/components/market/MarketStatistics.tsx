import React,{useMemo,useState} from 'react';
import type {MarketTrade} from '../../game/types';
import {marketChart,marketStats,type MarketTimeRange} from '../../game/market/marketStatistics';

const ranges:MarketTimeRange[]=['1H','6H','24H','7D'];
const money=(n:number|null)=>n===null?'—':Math.round(n).toLocaleString()+' S';

export function MarketStatistics({itemId,trades}:{itemId:string;trades:MarketTrade[]}){
  const [range,setRange]=useState<MarketTimeRange>('24H');
  const now=Date.now();
  const stats=useMemo(()=>marketStats(trades,itemId,range,now),[trades,itemId,range,now]);
  const points=useMemo(()=>marketChart(trades,itemId,range,now),[trades,itemId,range,now]);
  const values=points.map(x=>x.price);
  const min=values.length?Math.min(...values):0;
  const max=values.length?Math.max(...values):0;
  const spread=max-min||1;
  const poly=points.map((point,index)=>{
    const x=points.length===1?50:index/(points.length-1)*100;
    const y=100-(point.price-min)/spread*80-10;
    return x+','+y;
  }).join(' ');
  const maxVolume=Math.max(...points.map(x=>x.volume),1);
  const change=stats.priceChange===null
    ?'비교 데이터 부족'
    :(stats.priceChange>0?'▲ +':stats.priceChange<0?'▼ ':'─ ')+stats.priceChange.toLocaleString()+' S ('+(stats.priceChangePercent!>0?'+':'')+stats.priceChangePercent!.toFixed(1)+'%)';

  return <section className="market-statistics-card">
    <div className="market-range-tabs">
      {ranges.map(value=><button type="button" key={value} className={range===value?'active':''} onClick={()=>setRange(value)}>{value}</button>)}
    </div>

    {!stats.tradeCount?<div className="market-empty">선택한 기간에 체결 기록이 없습니다.</div>:<>
      <div className="market-stat-grid">
        <span><small>변동</small><b>{change}</b></span>
        <span><small>평균</small><b>{money(stats.averagePrice)}</b></span>
        <span><small>최고 / 최저</small><b>{money(stats.highPrice)} / {money(stats.lowPrice)}</b></span>
        <span><small>거래량 / 체결</small><b>{stats.volume.toLocaleString()}개 / {stats.tradeCount}회</b></span>
      </div>
      <div className="market-chart-wrap">
        <div className="market-chart-label"><span>{money(max)}</span><span>{range}</span><span>{money(min)}</span></div>
        <svg className="price-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="가격 차트">
          <polyline points={poly} fill="none" vectorEffect="non-scaling-stroke"/>
        </svg>
        <div className="volume-chart">
          {points.map(point=><i key={point.timestamp} style={{height:Math.max(3,point.volume/maxVolume*100)+'%'}} title={point.volume+'개'}/>)}
        </div>
      </div>
    </>}
  </section>;
}
