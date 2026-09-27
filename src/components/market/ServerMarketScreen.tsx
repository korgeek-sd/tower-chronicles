import React,{useEffect,useMemo,useState} from 'react';
import type {GameState} from '../../game/types';
import {aggregateOrderBookByPrice,getBestAsk,getBestBid,getMyOpenOrders,marketCatalog,marketItemName,orderBook} from '../../game/market/marketService';
import {Glyph,Pager,Screen,Segments} from '../../ui/mobile';
import type {GameplayLease} from '../../online/gameSession';
import {
 applyOnlineEconomyToGame,applyOnlineMarketSnapshotToGame,cancelOnlineMarketOrder,claimAllOnlineMarketStorage,claimOnlineMarketStorage,
 loadOnlineMarketState,placeOnlineMarketOrder,subscribeOnlineMarketRealtime,type OnlineMarketState
} from '../../online/market';

type Tab='market'|'orders'|'storage';
type Side='BUY'|'SELL';
type Category='all'|'equipment'|'materials'|'skillbooks'|'tickets'|'other';
type Trend={points:string;delta:number|null;last:number|null;low:number|null;high:number|null;count:number};
const PAGE_SIZE=5;
const tabs=[['market','시장'],['orders','내 주문'],['storage','보관함']] as const;
const categoryTabs:[Category,string][]=[['all','전체'],['equipment','장비'],['materials','재료'],['skillbooks','스킬북'],['tickets','입장권'],['other','기타']];
const money=(n:number|null)=>n===null?'—':Math.round(n).toLocaleString()+' S';
const categoryGlyph=(c:string)=>c==='equipment'?'equipment':c==='materials'?'materials':c==='skillbooks'?'skillbooks':c==='tickets'?'tickets':'other';
const pageSlice=<T,>(rows:T[],page:number)=>rows.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE);
const sparkPoints=(values:number[])=>{
 if(values.length<2)return '';
 const min=Math.min(...values),max=Math.max(...values),span=max-min||1;
 return values.map((value,index)=>{
  const x=values.length===1?50:index/(values.length-1)*100;
  const y=21-(value-min)/span*16;
  return x.toFixed(2)+','+y.toFixed(2);
 }).join(' ');
};
const makeTrend=(values:number[]):Trend=>{
 const first=values[0]??null,last=values.at(-1)??null;
 return {
  points:sparkPoints(values),
  delta:first&&last!==null?((last-first)/first)*100:null,
  last,
  low:values.length?Math.min(...values):null,
  high:values.length?Math.max(...values):null,
  count:values.length,
 };
};
const trendClass=(delta:number|null)=>delta===null?'flat':delta>=0?'up':'down';
const trendLabel=(delta:number|null)=>delta===null?'체결 대기':(delta>=0?'+':'')+delta.toFixed(1)+'%';

export function ServerMarketScreen({game,setGame,lease}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;lease:GameplayLease}){
 const [snapshot,setSnapshot]=useState<OnlineMarketState|null>(null);
 const [tab,setTab]=useState<Tab>('market');
 const [category,setCategory]=useState<Category>('all');
 const [selected,setSelected]=useState<string|null>(null);
 const [side,setSide]=useState<Side>('BUY');
 const [price,setPrice]=useState('');
 const [qty,setQty]=useState('1');
 const [page,setPage]=useState(0);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [live,setLive]=useState<'connecting'|'subscribed'|'error'>('connecting');

 const applySnapshot=(next:OnlineMarketState)=>{
  setSnapshot(next);
  setGame(state=>applyOnlineEconomyToGame(state,next));
 };

 const refresh=async()=>{
  try{const next=await loadOnlineMarketState();applySnapshot(next);setError('');}
  catch(e){setError(e instanceof Error?e.message:'온라인 거래소를 불러오지 못했습니다.');}
 };

 useEffect(()=>{
  let disposed=false,subscribedOnce=false;
  void(async()=>{try{const next=await loadOnlineMarketState();if(!disposed)applySnapshot(next);}catch(e){if(!disposed)setError(e instanceof Error?e.message:'온라인 거래소를 불러오지 못했습니다.');}})();
  const unsubscribe=subscribeOnlineMarketRealtime(
   ()=>{if(!disposed)void refresh();},
   status=>{
    if(disposed)return;
    setLive(status);
    if(status==='subscribed'){
     if(subscribedOnce)void refresh();
     subscribedOnce=true;
    }
   }
  );
  const resume=()=>{if(!document.hidden&&!disposed)void refresh();};
  document.addEventListener('visibilitychange',resume);
  return()=>{disposed=true;unsubscribe();document.removeEventListener('visibilitychange',resume);};
 },[lease.leaseId,lease.generation]);

 const view=useMemo(()=>snapshot?applyOnlineMarketSnapshotToGame(game,snapshot):game,[game,snapshot]);
 const catalog=useMemo(()=>marketCatalog(view),[view]);
 const filtered=useMemo(()=>catalog.filter(entry=>category==='all'||entry.category===category),[catalog,category]);
 const marketPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const safeMarketPage=Math.min(page,marketPages-1);
 const shown=pageSlice(filtered,safeMarketPage);
 const item=catalog.find(x=>x.id===selected)??null;
 const p=/^\d+$/.test(price)?Number(price):NaN,q=/^\d+$/.test(qty)?Number(qty):NaN;
 const book=selected?orderBook(view,selected):{sells:[],buys:[]};
 const asks=aggregateOrderBookByPrice(book.sells).sort((a,b)=>a.price-b.price).slice(0,4);
 const bids=aggregateOrderBookByPrice(book.buys).sort((a,b)=>b.price-a.price).slice(0,4);
 const maxDepth=Math.max(1,...asks.map(x=>x.quantity),...bids.map(x=>x.quantity));
 const open=getMyOpenOrders(view);
 const storage=snapshot?.storage??[];
 const trades=snapshot?.trades??[];
 const trendByItem=useMemo(()=>{
  const grouped=new Map<string,{at:number;price:number}[]>();
  for(const trade of trades){
   const rows=grouped.get(trade.itemId)??[];
   rows.push({at:trade.executedAt,price:trade.price});
   grouped.set(trade.itemId,rows);
  }
  const result=new Map<string,Trend>();
  grouped.forEach((rows,id)=>{
   const values=rows.sort((a,b)=>a.at-b.at).slice(-8).map(row=>row.price);
   result.set(id,makeTrend(values));
  });
  return result;
 },[trades]);
 const orderPages=Math.max(1,Math.ceil(open.length/PAGE_SIZE)),safeOrderPage=Math.min(page,orderPages-1),shownOrders=pageSlice(open,safeOrderPage);
 const storagePages=Math.max(1,Math.ceil(storage.length/PAGE_SIZE)),safeStoragePage=Math.min(page,storagePages-1),shownStorage=pageSlice(storage,safeStoragePage);
 const storageSilver=storage.reduce((sum,entry)=>sum+(entry.side==='SELL'?entry.silver:0),0);
 const storageItems=storage.reduce((sum,entry)=>sum+(entry.side==='BUY'?entry.quantity:0),0);

 const choose=(id:string)=>{
  setSelected(id);setSide('BUY');setQty('1');setError('');
  setPrice(String(getBestAsk(view,id)??getBestBid(view,id)??trendByItem.get(id)?.last??''));
 };

 const switchSide=(next:Side)=>{
  setSide(next);
  if(!selected)return;
  setPrice(String((next==='BUY'?getBestAsk(view,selected):getBestBid(view,selected))??trendByItem.get(selected)?.last??''));
 };

 const applyPercent=(percent:number)=>{
  if(!snapshot||!item||!Number.isSafeInteger(p)||p<=0)return;
  const max=side==='BUY'?Math.floor(snapshot.wallet.silver/p):item.available;
  const next=max<=0?0:percent===100?max:Math.min(max,Math.max(1,Math.floor(max*percent/100)));
  setQty(String(next));
 };

 const act=async(fn:()=>Promise<OnlineMarketState>)=>{
  setBusy(true);setError('');
  try{applySnapshot(await fn());}
  catch(e){setError(e instanceof Error?e.message:'온라인 거래소 요청을 처리하지 못했습니다.');}
  finally{setBusy(false);}
 };

 if(!snapshot)return <Screen eyebrow="SILVER SCALE / ONLINE" title="은저울 거래소" meta={<span>서버 연결</span>}><div className="tc-market-v2 tc-market-v2-loading"><div className="tc-floor-risk">{error||'서버 거래소 상태를 불러오고 있습니다.'}</div></div></Screen>;

 if(item){
  const bestAsk=getBestAsk(view,item.id),bestBid=getBestBid(view,item.id);
  const trend=trendByItem.get(item.id)??makeTrend([]);
  const current=trend.last??bestAsk??bestBid;
  const maxOrderQty=Number.isSafeInteger(p)&&p>0?(side==='BUY'?Math.floor(snapshot.wallet.silver/p):item.available):0;
  return <Screen eyebrow="SILVER SCALE / ORDER DESK" title="시장 상세" meta={<button className="tc-action secondary slim" onClick={()=>setSelected(null)}>시장</button>}>
   <div className="tc-market-v2-detail tc-market-v3-detail">
    <section className="tc-market-v3-detailhead">
     <div className="tc-market-v3-identity">
      <span className="tc-market-v2-icon"><Glyph name={categoryGlyph(item.category)}/></span>
      <div className="tc-market-v2-itemname"><small>SERVER ORDER BOOK</small><b>{item.name}</b><span>보유 {item.available}</span></div>
     </div>
     <div className="tc-market-v3-current"><small>최근 체결가</small><b>{money(current)}</b><span className={trendClass(trend.delta)}>{trendLabel(trend.delta)}</span></div>
     <div className="tc-market-v3-quotes">
      <span className="ask"><small>최저 판매</small><b>{money(bestAsk)}</b></span>
      <span className="bid"><small>최고 구매</small><b>{money(bestBid)}</b></span>
     </div>
    </section>

    <section className="tc-market-v2-book">
     <header><span>실시간 주문장</span><small>가격 / 잔량</small></header>
     <div className="tc-market-v2-bookcols">
      <div className="sell"><b>판매</b>{asks.map(x=><button key={x.price} onClick={()=>{setSide('BUY');setPrice(String(x.price));}}><i style={{width:(x.quantity/maxDepth*100)+'%'}}/><span>{money(x.price)}</span><small>{x.quantity}</small></button>)}{!asks.length&&<em>판매 주문 없음</em>}</div>
      <div className="buy"><b>구매</b>{bids.map(x=><button key={x.price} onClick={()=>{setSide('SELL');setPrice(String(x.price));}}><i style={{width:(x.quantity/maxDepth*100)+'%'}}/><span>{money(x.price)}</span><small>{x.quantity}</small></button>)}{!bids.length&&<em>구매 주문 없음</em>}</div>
     </div>
    </section>

    <section className="tc-market-v3-chart">
     <header><span>최근 체결 추이</span><small>{trend.count?trend.count+'건 기준':'체결 대기'}</small></header>
     <div className="tc-market-v3-chartbody">
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-label="최근 체결 가격 추이">
       <line x1="0" y1="21" x2="100" y2="21"/>
       {trend.points&&<polyline className={trendClass(trend.delta)} points={trend.points} fill="none" vectorEffect="non-scaling-stroke"/>}
      </svg>
      <div><span>저가 <b>{money(trend.low)}</b></span><span>고가 <b>{money(trend.high)}</b></span><span>현재 <b>{money(current)}</b></span></div>
     </div>
    </section>

    <section className="tc-market-v2-ticket tc-market-v3-ticket">
     <Segments items={[['BUY','매수'],['SELL','매도']] as const} value={side} onChange={switchSide} label="주문 방향"/>
     <div className="tc-market-v2-fields">
      <label><small>가격</small><input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))}/><span>S</span></label>
      <label><small>수량</small><input inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value.replace(/\D/g,''))}/><span>개</span></label>
     </div>
     <div className="tc-market-v3-presets" aria-label="주문 수량 비율">{[10,25,50,75,100].map(percent=><button key={percent} disabled={busy||maxOrderQty<=0} onClick={()=>applyPercent(percent)}>{percent===100?'MAX':percent+'%'}</button>)}</div>
     <div className="tc-market-v2-total"><span>{side==='BUY'?'예상 예치금':'지정 판매금액'}</span><b>{Number.isFinite(p*q)?money(p*q):'—'}</b></div>
     <button className={'tc-market-v2-submit '+(side==='BUY'?'buy':'sell')} disabled={!valid} onClick={()=>void act(()=>placeOnlineMarketOrder(lease,{itemId:item.id,side,limitPrice:p,quantity:q}))}>{busy?'처리 중':side==='BUY'?'매수 주문 등록':'매도 주문 등록'}</button>
    </section>
    {error&&<div className="tc-floor-risk">{error}</div>}
   </div>
  </Screen>;
 }

 return <Screen eyebrow="SILVER SCALE / ONLINE" title="은저울 거래소" meta={<span>{snapshot.wallet.silver.toLocaleString()} S</span>}>
  <div className={"tc-market-v2 tc-market-v3 tab-"+tab}>
   <Segments items={tabs} value={tab} onChange={next=>{setTab(next);setSelected(null);setPage(0);setError('');}} label="온라인 거래소 메뉴"/>

   {tab==='market'&&<>
    <section className="tc-market-v2-status tc-market-v3-status">
     <div className="lead"><small>SERVER MARKET</small><b>{live==='subscribed'?'실시간 시장 연결됨':live==='connecting'?'시장 연결 중':'시장 재연결 중'}</b><span>공용 주문장 호가와 최근 체결을 표시합니다.</span></div>
     <div><small>보유 SILVER</small><b>{snapshot.wallet.silver.toLocaleString()}</b></div>
     <div><small>수령 대기</small><b>{storage.length}건</b></div>
    </section>
    <div className="tc-market-v2-cats tc-market-v3-cats">{categoryTabs.map(([key,label])=><button key={key} className={category===key?'active':''} onClick={()=>{setCategory(key);setPage(0);}}>{label}</button>)}</div>
    <div className="tc-market-v2-list tc-market-v3-list">
     {shown.map(entry=>{
      const ask=getBestAsk(view,entry.id),bid=getBestBid(view,entry.id),trend=trendByItem.get(entry.id)??makeTrend([]);
      return <button className="tc-market-v2-row tc-market-v3-card" key={entry.id} onClick={()=>choose(entry.id)}>
       <span className="tc-market-v2-mini"><Glyph name={categoryGlyph(entry.category)}/></span>
       <span className="name"><b>{entry.name}</b><small>보유 {entry.available}</small></span>
       <span className={'tc-market-v3-spark '+trendClass(trend.delta)}>{trend.points?<svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points={trend.points} fill="none" vectorEffect="non-scaling-stroke"/></svg>:<i/>}</span>
       <span className="tc-market-v3-rowprice"><b>{money(ask??bid)}</b><small>매도 {money(ask)} · 매수 {money(bid)}</small></span>
       <i>›</i>
      </button>;
     })}
     {!shown.length&&<div className="tc-market-v2-empty">표시할 시장 품목이 없습니다.</div>}
    </div>
    <Pager page={safeMarketPage} count={marketPages} onChange={setPage}/>
   </>}

   {tab==='orders'&&<>
    <section className="tc-market-v2-status compact">
     <div><small>진행 주문</small><b>{open.length}건</b></div>
     <div><small>매수</small><b>{open.filter(x=>x.side==='BUY').length}</b></div>
     <div><small>매도</small><b>{open.filter(x=>x.side==='SELL').length}</b></div>
    </section>
    <div className="tc-market-v2-orders">
     {shownOrders.map(order=>{const filled=order.originalQuantity-order.remainingQuantity,pct=order.originalQuantity?filled/order.originalQuantity*100:0;return <article key={order.orderId}>
      <span className={'side '+order.side.toLowerCase()}>{order.side==='BUY'?'매수':'매도'}</span>
      <div className="name"><b>{marketItemName(view,order.itemId)}</b><small>{money(order.limitPrice)} · {filled}/{order.originalQuantity} 체결</small><div className="tc-market-v2-progress"><i style={{width:pct+'%'}}/></div></div>
      <button disabled={busy} onClick={()=>void act(()=>cancelOnlineMarketOrder(lease,order.orderId))}>취소</button>
     </article>})}
     {!shownOrders.length&&<div className="tc-market-v2-empty">진행 중인 주문이 없습니다.</div>}
    </div>
    <Pager page={safeOrderPage} count={orderPages} onChange={setPage}/>
   </>}

   {tab==='storage'&&<>
    <section className="tc-market-v2-storagehead">
     <div><small>판매대금</small><b>{money(storageSilver)}</b></div>
     <div><small>구매물품</small><b>{storageItems}개</b></div>
     <button disabled={!storage.length||busy||!!game.expedition} onClick={()=>void act(()=>claimAllOnlineMarketStorage(lease))}>모두 수령</button>
    </section>
    <div className="tc-market-v2-storage">
     {shownStorage.map(entry=><article key={entry.storageId}>
      <span className="tc-market-v2-mini"><Glyph name={entry.side==='BUY'?'inventory':'market'}/></span>
      <div><b>{entry.side==='BUY'?marketItemName(view,entry.itemId):'판매대금'}</b><small>{entry.side==='BUY'?'×'+entry.quantity:money(entry.silver)}</small></div>
      <button disabled={busy||!!game.expedition} onClick={()=>void act(()=>claimOnlineMarketStorage(lease,entry.storageId))}>수령</button>
     </article>)}
     {!shownStorage.length&&<div className="tc-market-v2-empty">수령할 체결 자산이 없습니다.</div>}
    </div>
    <Pager page={safeStoragePage} count={storagePages} onChange={setPage}/>
   </>}

   {error&&<div className="tc-floor-risk">{error}</div>}
  </div>
 </Screen>;
}
