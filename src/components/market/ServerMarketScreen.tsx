import React,{useEffect,useMemo,useState} from 'react';
import type {GameState} from '../../game/types';
import {aggregateOrderBookByPrice,getBestAsk,getBestBid,getMyOpenOrders,marketCatalog,marketItemName,orderBook} from '../../game/market/marketService';
import {Glyph,Screen,Segments} from '../../ui/mobile';
import type {GameplayLease} from '../../online/gameSession';
import {
 applyOnlineEconomyToGame,applyOnlineMarketSnapshotToGame,cancelOnlineMarketOrder,claimAllOnlineMarketStorage,claimOnlineMarketStorage,
 loadOnlineMarketState,placeOnlineMarketOrder,subscribeOnlineMarketRealtime,type OnlineMarketState
} from '../../online/market';

type Tab='buy'|'sell'|'orders'|'storage'|'trades';
const tabs=[['buy','구매'],['sell','판매'],['orders','내 요청'],['storage','보관함'],['trades','체결']] as const;
const money=(n:number|null)=>n===null?'—':Math.round(n).toLocaleString()+' S';
const categoryGlyph=(c:string)=>c==='equipment'?'equipment':c==='materials'?'materials':c==='skillbooks'?'skillbooks':c==='tickets'?'tickets':'other';

export function ServerMarketScreen({game,setGame,lease}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;lease:GameplayLease}){
 const [snapshot,setSnapshot]=useState<OnlineMarketState|null>(null);
 const [tab,setTab]=useState<Tab>('buy');
 const [selected,setSelected]=useState<string|null>(null);
 const [price,setPrice]=useState('');
 const [qty,setQty]=useState('1');
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
  let disposed=false;
  void(async()=>{try{const next=await loadOnlineMarketState();if(!disposed)applySnapshot(next);}catch(e){if(!disposed)setError(e instanceof Error?e.message:'온라인 거래소를 불러오지 못했습니다.');}})();
  const unsubscribe=subscribeOnlineMarketRealtime(()=>{if(!disposed)void refresh();},setLive);
  const id=window.setInterval(()=>{if(!document.hidden&&!disposed)void refresh();},15_000);
  const resume=()=>{if(!document.hidden&&!disposed)void refresh();};
  document.addEventListener('visibilitychange',resume);
  return()=>{disposed=true;unsubscribe();window.clearInterval(id);document.removeEventListener('visibilitychange',resume);};
 },[lease.leaseId,lease.generation]);

 const view=useMemo(()=>snapshot?applyOnlineMarketSnapshotToGame(game,snapshot):game,[game,snapshot]);
 const catalog=useMemo(()=>marketCatalog(view),[view]);
 const item=catalog.find(x=>x.id===selected)??null;
 const side=tab==='sell'?'SELL':'BUY';
 const p=/^\d+$/.test(price)?Number(price):NaN,q=/^\d+$/.test(qty)?Number(qty):NaN;
 const book=selected?orderBook(view,selected):{sells:[],buys:[]};
 const asks=aggregateOrderBookByPrice(book.sells).sort((a,b)=>a.price-b.price).slice(0,4);
 const bids=aggregateOrderBookByPrice(book.buys).sort((a,b)=>b.price-a.price).slice(0,4);
 const valid=!!snapshot&&!!item&&Number.isSafeInteger(p)&&p>0&&Number.isSafeInteger(q)&&q>0&&!busy&&!game.expedition&&(side==='BUY'?snapshot.wallet.silver>=p*q:item.available>=q);
 const open=getMyOpenOrders(view);
 const storage=snapshot?.storage??[];
 const trades=snapshot?.trades??[];

 const choose=(id:string,nextTab:'buy'|'sell')=>{
  const nextSide=nextTab==='buy'?'BUY':'SELL';
  setSelected(id);setTab(nextTab);setQty('1');setError('');
  setPrice(String((nextSide==='BUY'?getBestAsk(view,id):getBestBid(view,id))??''));
 };

 const act=async(fn:()=>Promise<OnlineMarketState>)=>{
  setBusy(true);setError('');
  try{applySnapshot(await fn());}
  catch(e){setError(e instanceof Error?e.message:'온라인 거래소 요청을 처리하지 못했습니다.');}
  finally{setBusy(false);}
 };

 if(!snapshot)return <Screen eyebrow="SILVER SCALE / ONLINE" title="은저울 거래소" meta={<span>서버 연결</span>}><div className="tc-market-board"><div className="tc-floor-risk">{error||'서버 거래소 상태를 불러오고 있습니다.'}</div></div></Screen>;

 if(item&&(tab==='buy'||tab==='sell')){
  return <Screen eyebrow="SILVER SCALE / ONLINE" title={item.name} meta={<button className="tc-action secondary slim" onClick={()=>setSelected(null)}>목록</button>}>
   <div className="tc-market-item">
    <section className="tc-market-itemhead">
     <div className="tc-market-itemicon"><Glyph name={categoryGlyph(item.category)}/></div>
     <div><small>SERVER ORDER BOOK</small><b>{item.name}</b><p>공용 서버 주문장에서 실시간 체결됩니다.</p></div>
     <div className="tc-market-owned"><small>보유</small><b>{item.available}</b></div>
    </section>
    <section className="tc-market-bookdesk">
     <div className="tc-market-bookcol sell"><header><b>판매 요청서</b><span>가격 / 수량</span></header>{asks.map(x=><button key={x.price} onClick={()=>setPrice(String(x.price))}><b>{money(x.price)}</b><span>{x.quantity}</span></button>)}{!asks.length&&<div className="empty"><b>—</b><span>—</span></div>}</div>
     <div className="tc-market-bookcol buy"><header><b>구매 요청서</b><span>가격 / 수량</span></header>{bids.map(x=><button key={x.price} onClick={()=>setPrice(String(x.price))}><b>{money(x.price)}</b><span>{x.quantity}</span></button>)}{!bids.length&&<div className="empty"><b>—</b><span>—</span></div>}</div>
    </section>
    <section className="tc-market-ticket">
     <div className="tc-market-ticket-fields"><label>수량<input inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value.replace(/\D/g,''))}/></label><label>가격<input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))}/></label></div>
     <div className="tc-market-ticket-total"><span>{side==='BUY'?'예약 Silver':'지정 판매가'}</span><b>{Number.isFinite(p*q)?money(p*q):'—'}</b><small>{side==='BUY'?'주문 등록 즉시 서버 지갑에서 최대 금액을 예치합니다.':'주문 등록 즉시 서버 자산을 에스크로로 이동합니다.'}</small></div>
     <button className="tc-action" disabled={!valid} onClick={()=>void act(()=>placeOnlineMarketOrder(lease,{itemId:item.id,side,limitPrice:p,quantity:q}))}>{busy?'처리 중':side==='BUY'?'서버 매수 주문 등록':'서버 매도 주문 등록'}</button>
    </section>
    {error&&<div className="tc-floor-risk">{error}</div>}
   </div>
  </Screen>;
 }

 return <Screen eyebrow="SILVER SCALE / ONLINE" title="은저울 거래소" meta={<span>{snapshot.wallet.silver.toLocaleString()} S · {snapshot.wallet.gold.toLocaleString()} G</span>}>
  <div className={"tc-market-board tab-"+tab}>
   <Segments items={tabs} value={tab} onChange={next=>{setTab(next);setSelected(null);setError('');}} label="온라인 거래소 메뉴"/>
   <div className="tc-floor-risk"><b>서버 권위 거래소</b> · {live==='subscribed'?'Realtime 연결됨':live==='connecting'?'Realtime 연결 중':'Realtime 재연결 중'} · wallet rev {snapshot.wallet.revision}</div>

   {(tab==='buy'||tab==='sell')&&<div className="tc-market-offers">
    {catalog.slice(0,7).map(entry=>{
     const best=tab==='buy'?getBestAsk(view,entry.id):getBestBid(view,entry.id);
     return <button key={entry.id} disabled={tab==='sell'&&entry.available<=0} onClick={()=>choose(entry.id,tab)}>
      <span className="tc-market-miniicon"><Glyph name={categoryGlyph(entry.category)}/></span>
      <span className="name"><b>{entry.name}</b><small>{tab==='sell'?'보유 '+entry.available:'공용 주문장'}</small></span>
      <span><b>{money(best)}</b></span><i>›</i>
     </button>;
    })}
    {!catalog.length&&<div className="tc-floor-risk">거래 가능한 아이템 또는 공개 주문이 없습니다.</div>}
   </div>}

   {tab==='orders'&&<div className="tc-market-myorders">
    <section><header><b>내 서버 주문</b><span>{open.length}</span></header>{open.slice(0,6).map(order=><article key={order.orderId}><div><b>{marketItemName(view,order.itemId)}</b><small>{order.side==='BUY'?'매수':'매도'} · {money(order.limitPrice)} · 잔량 {order.remainingQuantity}/{order.originalQuantity}</small></div><button disabled={busy} onClick={()=>void act(()=>cancelOnlineMarketOrder(lease,order.orderId))}>취소</button></article>)}{!open.length&&<p>진행 중인 온라인 주문이 없습니다.</p>}</section>
   </div>}

   {tab==='storage'&&<div className="tc-market-storage-list">
    <section className="tc-market-storage-summary"><div><small>수령 대기</small><b>{storage.length}건</b></div><button className="tc-action" disabled={!storage.length||busy||!!game.expedition} onClick={()=>void act(()=>claimAllOnlineMarketStorage(lease))}>모두 수령</button></section>
    {storage.slice(0,6).map(entry=><article className="tc-market-storage-row" key={entry.storageId}><span className="tc-market-miniicon"><Glyph name={entry.side==='BUY'?'inventory':'market'}/></span><div><b>{entry.side==='BUY'?marketItemName(view,entry.itemId):'판매대금'}</b><small>{entry.side==='BUY'?'×'+entry.quantity:money(entry.silver)}</small></div><button disabled={busy||!!game.expedition} onClick={()=>void act(()=>claimOnlineMarketStorage(lease,entry.storageId))}>수령</button></article>)}
    {!storage.length&&<div className="tc-floor-risk">수령할 체결 자산이 없습니다.</div>}
   </div>}

   {tab==='trades'&&<div className="tc-market-offers trades">{trades.slice(0,7).map(t=><div className="tc-trade-row" key={t.tradeId}><span className="tc-market-miniicon"><Glyph name="market"/></span><span className="name"><b>{marketItemName(view,t.itemId)}</b><small>{t.buyerMine?'내 매수':t.sellerMine?'내 매도':'시장 체결'}</small></span><span><b>{money(t.price)}</b></span><span><b>{t.quantity}</b></span></div>)}{!trades.length&&<div className="tc-floor-risk">아직 서버 체결 기록이 없습니다.</div>}</div>}
   {error&&<div className="tc-floor-risk">{error}</div>}
  </div>
 </Screen>;
}
