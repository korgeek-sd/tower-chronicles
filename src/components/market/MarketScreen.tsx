import React,{useEffect,useMemo,useState} from 'react';
import type {GameState,MarketOrder} from '../../game/types';
import {
 aggregateOrderBookByPrice,cancelOrder,claimAllMarketStorage,claimMarketStorage,getBestAsk,getBestBid,getMarketStorage,getMarketStorageItemCount,getMarketStorageSilver,getMyOpenOrders,
 marketCatalog,marketItemName,orderBook,placeOrder
} from '../../game/market/marketService';
import {marketTradesForPreview} from './demoTrades';
import {Glyph,Pager,Screen,Segments} from '../../ui/mobile';
import type {GameplayLease} from '../../online/gameSession';
import {ServerMarketScreen} from './ServerMarketScreen';
import type {MarketIntent} from './marketNavigation';

type Tab='market'|'orders'|'storage';
type Category='all'|'equipment'|'materials'|'other';
type Side='BUY'|'SELL';
type RangeKey='1H'|'24H'|'1W'|'1M'|'ALL';
type Trend={points:string;delta:number|null;last:number|null;low:number|null;high:number|null;count:number};
const PAGE_SIZE=5;
const tabs=[['market','시장'],['orders','내 주문'],['storage','보관함']] as const;
const categoryTabs:[Category,string][]=[['all','전체'],['equipment','장비'],['materials','재료'],['other','기타']];
const ranges:[RangeKey,string][]=[['1H','1H'],['24H','24H'],['1W','1W'],['1M','1M'],['ALL','ALL']];
const money=(n:number|null)=>n===null?'—':Math.round(n).toLocaleString()+' S';
const categoryGlyph=(c:string)=>c==='equipment'?'equipment':c==='materials'?'materials':c==='skillbooks'?'skillbooks':c==='tickets'?'tickets':'other';
const categoryLabel=(c:string)=>c==='equipment'?'장비':c==='materials'?'재료':c==='skillbooks'?'스킬북':c==='tickets'?'입장권':'기타';
const categoryMatch=(entryCategory:string,filter:Category)=>filter==='all'||entryCategory===filter||(filter==='other'&&['skillbooks','tickets','other'].includes(entryCategory));
const levels=(orders:MarketOrder[],desc=false)=>aggregateOrderBookByPrice(orders).sort((a,b)=>desc?b.price-a.price:a.price-b.price).slice(0,4);
const pageSlice=<T,>(rows:T[],page:number)=>rows.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE);
const rangeMs=(range:RangeKey)=>range==='1H'?60*60*1000:range==='24H'?24*60*60*1000:range==='1W'?7*24*60*60*1000:range==='1M'?30*24*60*60*1000:null;
const sparkPoints=(values:number[],height=24)=>{
 if(values.length<2)return '';
 const min=Math.min(...values),max=Math.max(...values),span=max-min||1;
 return values.map((value,index)=>{
  const x=index/(values.length-1)*100;
  const y=(height-3)-(value-min)/span*(height-6);
  return x.toFixed(2)+','+y.toFixed(2);
 }).join(' ');
};
const makeTrend=(values:number[],height=24):Trend=>{
 const first=values[0]??null,last=values.at(-1)??null;
 return {
  points:sparkPoints(values,height),
  delta:first&&last!==null?((last-first)/first)*100:null,
  last,
  low:values.length?Math.min(...values):null,
  high:values.length?Math.max(...values):null,
  count:values.length,
 };
};
const trendClass=(delta:number|null)=>delta===null?'flat':delta>=0?'up':'down';
const trendLabel=(delta:number|null)=>delta===null?'체결 대기':(delta>=0?'+':'')+delta.toFixed(1)+'%';

export function MarketScreen({game,setGame,onlineLease,intent,onIntentConsumed,onReturnToInventory}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onlineLease?:GameplayLease|null;intent?:MarketIntent|null;onIntentConsumed?:()=>void;onReturnToInventory?:(inventoryKey:string)=>void}){
 if(onlineLease)return <ServerMarketScreen game={game} setGame={setGame} lease={onlineLease} intent={intent} onIntentConsumed={onIntentConsumed} onReturnToInventory={onReturnToInventory}/>;
 return <LocalMarketScreen game={game} setGame={setGame} intent={intent} onIntentConsumed={onIntentConsumed} onReturnToInventory={onReturnToInventory}/>;
}

function LocalMarketScreen({game,setGame,intent,onIntentConsumed,onReturnToInventory}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;intent?:MarketIntent|null;onIntentConsumed?:()=>void;onReturnToInventory?:(inventoryKey:string)=>void}){
 const [tab,setTab]=useState<Tab>('market');
 const [category,setCategory]=useState<Category>('all');
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(0);
 const [selected,setSelected]=useState<string|null>(null);
 const [tradeSide,setTradeSide]=useState<Side|null>(null);
 const [range,setRange]=useState<RangeKey>('24H');
 const [price,setPrice]=useState('');
 const [qty,setQty]=useState('1');
 const [returnInventoryKey,setReturnInventoryKey]=useState<string|null>(null);
 useEffect(()=>{if(!intent)return;setTab('market');setCategory('all');setQuery('');setPage(0);setSelected(intent.itemId);setTradeSide(null);setRange('24H');setQty('1');setReturnInventoryKey(intent.inventoryKey??null);onIntentConsumed?.();},[intent?.itemId,intent?.inventoryKey]);

 const catalog=useMemo(()=>marketCatalog(game),[game]);
 const normalizedQuery=query.trim().toLowerCase();
 const filtered=useMemo(()=>catalog.filter(entry=>categoryMatch(entry.category,category)&&(!normalizedQuery||entry.name.toLowerCase().includes(normalizedQuery))),[catalog,category,normalizedQuery]);
 const marketPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),safeMarketPage=Math.min(page,marketPages-1),shown=pageSlice(filtered,safeMarketPage);
 const item=catalog.find(x=>x.id===selected)??null;
 const side:Side=tradeSide??'BUY';
 const book=selected?orderBook(game,selected):{sells:[],buys:[]};
 const asks=levels(book.sells),bids=levels(book.buys,true);
 const maxDepth=Math.max(1,...asks.map(x=>x.quantity),...bids.map(x=>x.quantity));
 const trendByItem=useMemo(()=>{
  const now=Date.now(),result=new Map<string,Trend>();
  for(const entry of catalog){
   const preview=marketTradesForPreview(game.market.trades,entry.id,now);
   const values=preview.trades.filter(t=>t.itemId===entry.id).slice().sort((a,b)=>a.executedAt-b.executedAt).slice(-8).map(t=>t.price);
   result.set(entry.id,makeTrend(values));
  }
  return result;
 },[game.market.trades,catalog]);
 const p=/^\d+$/.test(price)?Number(price):NaN,q=/^\d+$/.test(qty)?Number(qty):NaN;
 const valid=!!item&&!!tradeSide&&Number.isSafeInteger(p)&&p>0&&Number.isSafeInteger(q)&&q>0&&!game.expedition&&(side==='BUY'?game.silver>=p*q:item.available>=q);

 const open=getMyOpenOrders(game);
 const orderPages=Math.max(1,Math.ceil(open.length/PAGE_SIZE)),safeOrderPage=Math.min(page,orderPages-1),shownOrders=pageSlice(open,safeOrderPage);
 const storage=getMarketStorage(game);
 const storagePages=Math.max(1,Math.ceil(storage.length/PAGE_SIZE)),safeStoragePage=Math.min(page,storagePages-1),shownStorage=pageSlice(storage,safeStoragePage);
 const storageSilver=getMarketStorageSilver(game),storageItems=getMarketStorageItemCount(game);

 const choose=(id:string)=>{
  setSelected(id);setTradeSide(null);setRange('24H');setQty('1');
  setPrice(String(getBestAsk(game,id)??getBestBid(game,id)??trendByItem.get(id)?.last??''));
 };

 const openTrade=(next:Side)=>{
  if(!selected)return;
  setTradeSide(next);setQty('1');
  setPrice(String((next==='BUY'?getBestAsk(game,selected):getBestBid(game,selected))??trendByItem.get(selected)?.last??''));
 };

 const applyPercent=(percent:number)=>{
  if(!item||!Number.isSafeInteger(p)||p<=0)return;
  const max=side==='BUY'?Math.floor(game.silver/p):item.available;
  const next=max<=0?0:percent===100?max:Math.min(max,Math.max(1,Math.floor(max*percent/100)));
  setQty(String(next));
 };

 const submit=()=>{
  if(!selected||!valid)return;
  setGame(state=>{
   const next=placeOrder(state,{itemId:selected,side,limitPrice:p,quantity:q});
   const order=next.market.orders.at(-1);
   if(order){
    const filled=order.originalQuantity-order.remainingQuantity;
    next.notice=filled?(order.remainingQuantity?filled+'개 체결 · '+order.remainingQuantity+'개 대기':filled+'개 전량 체결'):(side==='BUY'?'매수 지정가 주문을 등록했습니다.':'매도 지정가 주문을 등록했습니다.');
   }
   return next;
  });
 };

 if(item&&tradeSide){
  const bestAsk=getBestAsk(game,item.id),bestBid=getBestBid(game,item.id);
  const current=trendByItem.get(item.id)?.last??bestAsk??bestBid;
  const maxOrderQty=Number.isSafeInteger(p)&&p>0?(side==='BUY'?Math.floor(game.silver/p):item.available):0;
  return <Screen eyebrow="SILVER SCALE / ORDER" title={side==='BUY'?'매수 주문':'매도 주문'} meta={<button className="tc-action secondary slim" onClick={()=>setTradeSide(null)}>상세</button>}>
   <div className="tc-market-v4-trade">
    <section className="tc-market-v4-tradehead">
     <span className="tc-market-v2-icon"><Glyph name={categoryGlyph(item.category)}/></span>
     <div><small>{categoryLabel(item.category)}</small><b>{item.name}</b><span>최근 체결 {money(current)}</span></div>
     <strong>{side==='BUY'?game.silver.toLocaleString()+' S':'보유 '+item.available+'개'}</strong>
    </section>

    <section className="tc-market-v2-book tc-market-v4-book">
     <header><span>주문장</span><small>가격 / 잔량</small></header>
     <div className="tc-market-v2-bookcols">
      <div className="sell"><b>판매</b>{asks.map(x=><button key={x.price} onClick={()=>setPrice(String(x.price))}><i style={{width:(x.quantity/maxDepth*100)+'%'}}/><span>{money(x.price)}</span><small>{x.quantity}</small></button>)}{!asks.length&&<em>판매 주문 없음</em>}</div>
      <div className="buy"><b>구매</b>{bids.map(x=><button key={x.price} onClick={()=>setPrice(String(x.price))}><i style={{width:(x.quantity/maxDepth*100)+'%'}}/><span>{money(x.price)}</span><small>{x.quantity}</small></button>)}{!bids.length&&<em>구매 주문 없음</em>}</div>
     </div>
    </section>

    <section className="tc-market-v4-orderform">
     <div className="tc-market-v2-fields">
      <label><small>가격</small><input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))}/><span>S</span></label>
      <label><small>수량</small><input inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value.replace(/\D/g,''))}/><span>개</span></label>
     </div>
     <div className="tc-market-v3-presets" aria-label="주문 수량 비율">{[10,25,50,75,100].map(percent=><button key={percent} disabled={maxOrderQty<=0} onClick={()=>applyPercent(percent)}>{percent===100?'MAX':percent+'%'}</button>)}</div>
     <div className="tc-market-v2-total"><span>{side==='BUY'?'예상 예치금':'지정 판매금액'}</span><b>{Number.isFinite(p*q)?money(p*q):'—'}</b></div>
     <button className={'tc-market-v2-submit '+(side==='BUY'?'buy':'sell')} disabled={!valid} onClick={submit}>{side==='BUY'?'매수 주문 등록':'매도 주문 등록'}</button>
    </section>
   </div>
  </Screen>;
 }

 if(item){
  const bestAsk=getBestAsk(game,item.id),bestBid=getBestBid(game,item.id);
  const preview=marketTradesForPreview(game.market.trades,item.id,Date.now());
  const cutoff=rangeMs(range);
  const now=Date.now();
  const scoped=preview.trades.filter(t=>t.itemId===item.id&&(!cutoff||t.executedAt>=now-cutoff)).slice().sort((a,b)=>a.executedAt-b.executedAt);
  const trend=makeTrend(scoped.slice(-32).map(t=>t.price),64);
  const fallback=trendByItem.get(item.id)??makeTrend([]);
  const current=trend.last??fallback.last??bestAsk??bestBid;
  const overviewTrend=trend.count?trend:fallback;
  const estimated=current===null?null:current*item.available;
  return <Screen eyebrow="SILVER SCALE / DETAIL" title={item.name} meta={<button className="tc-action secondary slim tc-market-return" onClick={()=>returnInventoryKey&&onReturnToInventory?onReturnToInventory(returnInventoryKey):setSelected(null)}>{returnInventoryKey?'‹ 아이템':'시장'}</button>}>
   <div className="tc-market-v2-detail tc-market-v4-detail">
    <section className="tc-market-v4-pricehead">
     <div className="tc-market-v4-identity">
      <span className="tc-market-v2-icon"><Glyph name={categoryGlyph(item.category)}/></span>
      <div><b>{item.name}</b><small>{categoryLabel(item.category)} · 보유 {item.available}</small></div>
     </div>
     <div className="tc-market-v3-current"><small>최근 체결가</small><b>{money(current)}</b><span className={trendClass(overviewTrend.delta)}>{trendLabel(overviewTrend.delta)}</span></div>
    </section>

    <section className="tc-market-v4-chart">
     <div className="tc-market-v4-chartplot">
      <svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-label="최근 체결 가격 추이">
       <line x1="0" y1="60" x2="100" y2="60"/>
       {overviewTrend.points&&<polyline className={trendClass(overviewTrend.delta)} points={overviewTrend.points} fill="none" vectorEffect="non-scaling-stroke"/>}
      </svg>
      <span className="high">{money(overviewTrend.high)}</span>
      <span className="low">{money(overviewTrend.low)}</span>
     </div>
     <div className="tc-market-v4-ranges">{ranges.map(([key,label])=><button key={key} className={range===key?'active':''} onClick={()=>setRange(key)}>{label}</button>)}</div>
    </section>

    <section className="tc-market-v4-holding">
     <span className="tc-market-v2-mini"><Glyph name={categoryGlyph(item.category)}/></span>
     <div><b>{item.name}</b><small>내 보유 {item.available}개</small></div>
     <div className="value"><b>{money(estimated)}</b><small>평가액</small></div>
    </section>

    <section className="tc-market-v4-transactions">
     <div><span>최근 체결</span><b>{scoped.length||preview.trades.filter(t=>t.itemId===item.id).length}건</b></div>
     <div><span>최저 판매</span><b>{money(bestAsk)}</b></div>
     <div><span>최고 구매</span><b>{money(bestBid)}</b></div>
    </section>

    <div className="tc-market-v4-ctas">
     <button className="buy" onClick={()=>openTrade('BUY')}>BUY · 매수</button>
     <button className="sell" onClick={()=>openTrade('SELL')}>SELL · 매도</button>
    </div>
   </div>
  </Screen>;
 }

 return <Screen eyebrow="SILVER SCALE / LOCAL" title="은저울 거래소" meta={<span>{game.silver.toLocaleString()} S</span>}>
  <div className={"tc-market-v2 tc-market-v3 tc-market-v4 tab-"+tab}>
   <Segments items={tabs} value={tab} onChange={next=>{setTab(next);setSelected(null);setTradeSide(null);setPage(0);}} label="거래소 메뉴"/>

   {tab==='market'&&<>
    <div className="tc-market-v4-search">
     <span aria-hidden="true">⌕</span>
     <input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="거래 품목 검색" aria-label="거래 품목 검색"/>
     <small>LOCAL</small>
    </div>
    <div className="tc-market-v2-cats tc-market-v3-cats tc-market-v4-cats">{categoryTabs.map(([key,label])=><button key={key} className={category===key?'active':''} onClick={()=>{setCategory(key);setPage(0);}}>{label}</button>)}</div>
    <div className="tc-market-v2-list tc-market-v3-list tc-market-v4-list">
     {shown.map(entry=>{
      const ask=getBestAsk(game,entry.id),bid=getBestBid(game,entry.id),trend=trendByItem.get(entry.id)??makeTrend([]);
      return <button className="tc-market-v2-row tc-market-v3-card tc-market-v4-card" key={entry.id} onClick={()=>choose(entry.id)}>
       <span className="tc-market-v2-mini"><Glyph name={categoryGlyph(entry.category)}/></span>
       <span className="name"><b>{entry.name}</b><small>{categoryLabel(entry.category)} · 보유 {entry.available}</small></span>
       <span className={'tc-market-v3-spark '+trendClass(trend.delta)}>{trend.points?<svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points={trend.points} fill="none" vectorEffect="non-scaling-stroke"/></svg>:<i/>}</span>
       <span className="tc-market-v3-rowprice"><b>{money(ask??bid)}</b><small className={trendClass(trend.delta)}>{trendLabel(trend.delta)}</small></span>
       <i>›</i>
      </button>;
     })}
     {!shown.length&&<div className="tc-market-v2-empty">검색 조건에 맞는 품목이 없습니다.</div>}
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
      <div className="name"><b>{marketItemName(game,order.itemId)}</b><small>{money(order.limitPrice)} · {filled}/{order.originalQuantity} 체결</small><div className="tc-market-v2-progress"><i style={{width:pct+'%'}}/></div></div>
      <button onClick={()=>setGame(state=>cancelOrder(state,order.orderId))}>취소</button>
     </article>})}
     {!shownOrders.length&&<div className="tc-market-v2-empty">진행 중인 주문이 없습니다.</div>}
    </div>
    <Pager page={safeOrderPage} count={orderPages} onChange={setPage}/>
   </>}

   {tab==='storage'&&<>
    <section className="tc-market-v4-portfolio">
     <div className="title"><small>TRADE STORAGE</small><b>거래 정산</b></div>
     <div className="total"><small>보유 Silver</small><b>{game.silver.toLocaleString()} S</b></div>
     <div><small>수령 대금</small><b>{money(storageSilver)}</b></div>
     <div><small>수령 물품</small><b>{storageItems}개</b></div>
     <button disabled={!storage.length||!!game.expedition} onClick={()=>setGame(claimAllMarketStorage)}>모두 수령</button>
    </section>
    <div className="tc-market-v2-storage tc-market-v4-storage">
     {shownStorage.map(entry=><article key={entry.storageId}>
      <span className="tc-market-v2-mini"><Glyph name={entry.side==='BUY'?'inventory':'market'}/></span>
      <div><b>{entry.side==='BUY'?marketItemName(game,entry.itemId):'판매대금'}</b><small>{entry.side==='BUY'?'×'+entry.quantity:money(entry.silver)}</small></div>
      <button disabled={!!game.expedition} onClick={()=>setGame(state=>claimMarketStorage(state,entry.storageId))}>수령</button>
     </article>)}
     {!shownStorage.length&&<div className="tc-market-v2-empty">수령할 체결 자산이 없습니다.</div>}
    </div>
    <Pager page={safeStoragePage} count={storagePages} onChange={setPage}/>
   </>}
  </div>
 </Screen>;
}
