import React,{useMemo,useState} from 'react';
import type {GameState,MarketOrder} from '../../game/types';
import {
 aggregateOrderBookByPrice,cancelOrder,claimAllMarketStorage,claimMarketStorage,getBestAsk,getBestBid,getMarketStorage,getMarketStorageItemCount,getMarketStorageSilver,getMyOpenOrders,
 marketCatalog,marketItemName,orderBook,placeOrder
} from '../../game/market/marketService';
import {marketTradesForPreview} from './demoTrades';
import {Glyph,Pager,Screen,Segments} from '../../ui/mobile';
import type {GameplayLease} from '../../online/gameSession';
import {ServerMarketScreen} from './ServerMarketScreen';

type Tab='market'|'orders'|'storage';
type Category='all'|'equipment'|'materials'|'skillbooks'|'tickets'|'other';
type Side='BUY'|'SELL';
const PAGE_SIZE=5;
const tabs=[['market','시장'],['orders','내 주문'],['storage','보관함']] as const;
const categoryTabs:[Category,string][]=[['all','전체'],['equipment','장비'],['materials','재료'],['skillbooks','스킬북'],['tickets','입장권'],['other','기타']];
const money=(n:number|null)=>n===null?'—':Math.round(n).toLocaleString()+' S';
const categoryGlyph=(c:string)=>c==='equipment'?'equipment':c==='materials'?'materials':c==='skillbooks'?'skillbooks':c==='tickets'?'tickets':'other';
const levels=(orders:MarketOrder[],desc=false)=>aggregateOrderBookByPrice(orders).sort((a,b)=>desc?b.price-a.price:a.price-b.price).slice(0,4);
const pageSlice=<T,>(rows:T[],page:number)=>rows.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE);

export function MarketScreen({game,setGame,onlineLease}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onlineLease?:GameplayLease|null}){
 if(onlineLease)return <ServerMarketScreen game={game} setGame={setGame} lease={onlineLease}/>;
 return <LocalMarketScreen game={game} setGame={setGame}/>;
}

function LocalMarketScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [tab,setTab]=useState<Tab>('market');
 const [category,setCategory]=useState<Category>('all');
 const [page,setPage]=useState(0);
 const [selected,setSelected]=useState<string|null>(null);
 const [side,setSide]=useState<Side>('BUY');
 const [price,setPrice]=useState('');
 const [qty,setQty]=useState('1');

 const catalog=useMemo(()=>marketCatalog(game),[game]);
 const filtered=useMemo(()=>catalog.filter(entry=>category==='all'||entry.category===category),[catalog,category]);
 const marketPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),safeMarketPage=Math.min(page,marketPages-1),shown=pageSlice(filtered,safeMarketPage);
 const item=catalog.find(x=>x.id===selected)??null;
 const book=selected?orderBook(game,selected):{sells:[],buys:[]};
 const asks=levels(book.sells),bids=levels(book.buys,true);
 const maxDepth=Math.max(1,...asks.map(x=>x.quantity),...bids.map(x=>x.quantity));
 const preview=selected?marketTradesForPreview(game.market.trades,selected,Date.now()):{trades:game.market.trades,demo:false};
 const recentTrades=selected?preview.trades.filter(t=>t.itemId===selected).slice().sort((a,b)=>b.executedAt-a.executedAt).slice(0,3):[];
 const p=/^\d+$/.test(price)?Number(price):NaN,q=/^\d+$/.test(qty)?Number(qty):NaN;
 const valid=!!item&&Number.isSafeInteger(p)&&p>0&&Number.isSafeInteger(q)&&q>0&&!game.expedition&&(side==='BUY'?game.silver>=p*q:item.available>=q);

 const open=getMyOpenOrders(game);
 const orderPages=Math.max(1,Math.ceil(open.length/PAGE_SIZE)),safeOrderPage=Math.min(page,orderPages-1),shownOrders=pageSlice(open,safeOrderPage);
 const storage=getMarketStorage(game);
 const storagePages=Math.max(1,Math.ceil(storage.length/PAGE_SIZE)),safeStoragePage=Math.min(page,storagePages-1),shownStorage=pageSlice(storage,safeStoragePage);
 const storageSilver=getMarketStorageSilver(game),storageItems=getMarketStorageItemCount(game);

 const choose=(id:string)=>{
  const sample=marketTradesForPreview(game.market.trades,id,Date.now()).trades.filter(t=>t.itemId===id).sort((a,b)=>b.executedAt-a.executedAt)[0];
  setSelected(id);setSide('BUY');setQty('1');
  setPrice(String(getBestAsk(game,id)??getBestBid(game,id)??sample?.price??''));
 };

 const switchSide=(next:Side)=>{
  setSide(next);
  if(!selected)return;
  setPrice(String((next==='BUY'?getBestAsk(game,selected):getBestBid(game,selected))??''));
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

 if(item){
  const bestAsk=getBestAsk(game,item.id),bestBid=getBestBid(game,item.id);
  return <Screen eyebrow="SILVER SCALE / ORDER DESK" title={item.name} meta={<button className="tc-action secondary slim" onClick={()=>setSelected(null)}>시장</button>}>
   <div className="tc-market-v2-detail">
    <section className="tc-market-v2-itemhead">
     <span className="tc-market-v2-icon"><Glyph name={categoryGlyph(item.category)}/></span>
     <div className="tc-market-v2-itemname"><small>LOCAL ORDER BOOK</small><b>{item.name}</b><span>보유 {item.available}</span></div>
     <div className="tc-market-v2-quote ask"><small>최저 판매</small><b>{money(bestAsk)}</b></div>
     <div className="tc-market-v2-quote bid"><small>최고 구매</small><b>{money(bestBid)}</b></div>
    </section>

    <section className="tc-market-v2-book">
     <header><span>주문장</span><small>가격 / 잔량</small></header>
     <div className="tc-market-v2-bookcols">
      <div className="sell"><b>판매</b>{asks.map(x=><button key={x.price} onClick={()=>{setSide('BUY');setPrice(String(x.price));}}><i style={{width:(x.quantity/maxDepth*100)+'%'}}/><span>{money(x.price)}</span><small>{x.quantity}</small></button>)}{!asks.length&&<em>판매 주문 없음</em>}</div>
      <div className="buy"><b>구매</b>{bids.map(x=><button key={x.price} onClick={()=>{setSide('SELL');setPrice(String(x.price));}}><i style={{width:(x.quantity/maxDepth*100)+'%'}}/><span>{money(x.price)}</span><small>{x.quantity}</small></button>)}{!bids.length&&<em>구매 주문 없음</em>}</div>
     </div>
    </section>

    <section className="tc-market-v2-recent">
     <header><span>최근 체결</span><small>{preview.demo?'시장 표본':'실제 기록'}</small></header>
     <div>{recentTrades.map(t=><span key={t.tradeId}><b>{money(t.price)}</b><small>×{t.quantity}</small></span>)}{!recentTrades.length&&<p>아직 체결 기록이 없습니다.</p>}</div>
    </section>

    <section className="tc-market-v2-ticket">
     <Segments items={[['BUY','매수'],['SELL','매도']] as const} value={side} onChange={switchSide} label="주문 방향"/>
     <div className="tc-market-v2-fields">
      <label><small>가격</small><input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))}/><span>S</span></label>
      <label><small>수량</small><input inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value.replace(/\D/g,''))}/><span>개</span></label>
     </div>
     <div className="tc-market-v2-total"><span>{side==='BUY'?'예상 예치금':'지정 판매금액'}</span><b>{Number.isFinite(p*q)?money(p*q):'—'}</b></div>
     <button className={'tc-market-v2-submit '+(side==='BUY'?'buy':'sell')} disabled={!valid} onClick={submit}>{side==='BUY'?'매수 주문 등록':'매도 주문 등록'}</button>
    </section>
   </div>
  </Screen>;
 }

 return <Screen eyebrow="SILVER SCALE / LOCAL" title="은저울 거래소" meta={<span>{game.silver.toLocaleString()} S</span>}>
  <div className="tc-market-v2">
   <Segments items={tabs} value={tab} onChange={next=>{setTab(next);setSelected(null);setPage(0);}} label="거래소 메뉴"/>

   {tab==='market'&&<>
    <section className="tc-market-v2-status">
     <div><small>시장 상태</small><b>로컬 장부</b></div>
     <div><small>보유 Silver</small><b>{game.silver.toLocaleString()}</b></div>
     <div><small>수령 대기</small><b>{storage.length}건</b></div>
    </section>
    <div className="tc-market-v2-cats">{categoryTabs.map(([key,label])=><button key={key} className={category===key?'active':''} onClick={()=>{setCategory(key);setPage(0);}}>{label}</button>)}</div>
    <div className="tc-market-v2-list">
     <div className="tc-market-v2-listhead"><span>품목</span><span>판매 최저</span><span>구매 최고</span></div>
     {shown.map(entry=><button className="tc-market-v2-row" key={entry.id} onClick={()=>choose(entry.id)}>
      <span className="tc-market-v2-mini"><Glyph name={categoryGlyph(entry.category)}/></span>
      <span className="name"><b>{entry.name}</b><small>보유 {entry.available}</small></span>
      <span className="ask"><small>ASK</small><b>{money(getBestAsk(game,entry.id))}</b></span>
      <span className="bid"><small>BID</small><b>{money(getBestBid(game,entry.id))}</b></span>
      <i>›</i>
     </button>)}
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
      <div className="name"><b>{marketItemName(game,order.itemId)}</b><small>{money(order.limitPrice)} · {filled}/{order.originalQuantity} 체결</small><div className="tc-market-v2-progress"><i style={{width:pct+'%'}}/></div></div>
      <button onClick={()=>setGame(state=>cancelOrder(state,order.orderId))}>취소</button>
     </article>})}
     {!shownOrders.length&&<div className="tc-market-v2-empty">진행 중인 주문이 없습니다.</div>}
    </div>
    <Pager page={safeOrderPage} count={orderPages} onChange={setPage}/>
   </>}

   {tab==='storage'&&<>
    <section className="tc-market-v2-storagehead">
     <div><small>판매대금</small><b>{money(storageSilver)}</b></div>
     <div><small>구매물품</small><b>{storageItems}개</b></div>
     <button disabled={!storage.length||!!game.expedition} onClick={()=>setGame(claimAllMarketStorage)}>모두 수령</button>
    </section>
    <div className="tc-market-v2-storage">
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
