import React,{useEffect,useMemo,useState} from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import {
 applyOnlineGoldExchangeWallet,
 cancelOnlineGoldExchangeOrder,
 loadOnlineGoldExchangeState,
 placeOnlineGoldExchangeOrder,
 subscribeOnlineGoldExchangeRealtime,
 type GoldExchangeSide,
 type OnlineGoldExchangeOrder,
 type OnlineGoldExchangeState,
} from '../../online/goldExchange';
import {Pager,Screen,Segments} from '../../ui/mobile';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';

type Tab='market'|'orders'|'trades';
const PAGE_SIZE=6;
const tabs=[['market','시장'],['orders','내 주문'],['trades','체결']] as const;
const money=(value:number)=>Math.max(0,Math.round(value)).toLocaleString();
const pct=(value:number)=>`${value>=0?'+':''}${value.toFixed(2)}%`;

interface Level{price:number;quantity:number}
function levels(orders:OnlineGoldExchangeOrder[],side:GoldExchangeSide):Level[]{
 const byPrice=new Map<number,number>();
 for(const order of orders){
  if(order.side!==side||order.remainingGoldQuantity<=0)continue;
  byPrice.set(order.priceSilverPerGold,(byPrice.get(order.priceSilverPerGold)??0)+order.remainingGoldQuantity);
 }
 return [...byPrice].map(([price,quantity])=>({price,quantity}))
  .sort((a,b)=>side==='SELL_GOLD'?a.price-b.price:b.price-a.price)
  .slice(0,5);
}
function sparkPoints(values:number[]){
 if(values.length<2)return '';
 const min=Math.min(...values),max=Math.max(...values),span=max-min||1;
 return values.map((value,index)=>{
  const x=index/(values.length-1)*100;
  const y=31-(value-min)/span*26;
  return `${x.toFixed(2)},${y.toFixed(2)}`;
 }).join(' ');
}

export function GoldExchangeScreen({
 game,setGame,onlineLease,
}:{
 game:GameState;
 setGame:React.Dispatch<React.SetStateAction<GameState>>;
 onlineLease?:GameplayLease|null;
}){
 const feel=useGameFeel();
 const [tab,setTab]=useState<Tab>('market');
 const [state,setState]=useState<OnlineGoldExchangeState|null>(null);
 const [side,setSide]=useState<GoldExchangeSide>('BUY_GOLD');
 const [price,setPrice]=useState('');
 const [quantity,setQuantity]=useState('10');
 const [page,setPage]=useState(0);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [live,setLive]=useState<'connecting'|'subscribed'|'error'>('connecting');

 const apply=(next:OnlineGoldExchangeState)=>{
  setState(next);
  setGame(current=>applyOnlineGoldExchangeWallet(current,next));
 };

 const refresh=async()=>{
  if(!onlineLease)return;
  try{apply(await loadOnlineGoldExchangeState());setMessage('');}
  catch(error){setMessage(error instanceof Error?error.message:'골드 거래소를 불러오지 못했습니다.');}
 };

 useEffect(()=>{
  if(!onlineLease){setState(null);return;}
  let disposed=false;
  setBusy(true);
  void loadOnlineGoldExchangeState()
   .then(next=>{if(!disposed)apply(next);})
   .catch(error=>{if(!disposed)setMessage(error instanceof Error?error.message:'골드 거래소를 불러오지 못했습니다.');})
   .finally(()=>{if(!disposed)setBusy(false);});
  const unsubscribe=subscribeOnlineGoldExchangeRealtime(
   ()=>{if(!disposed)void refresh();},
   status=>{if(!disposed)setLive(status);},
  );
  const resume=()=>{if(!document.hidden&&!disposed)void refresh();};
  document.addEventListener('visibilitychange',resume);
  return()=>{disposed=true;unsubscribe();document.removeEventListener('visibilitychange',resume);};
 },[onlineLease?.leaseId,onlineLease?.generation]);

 const orders=state?.orders??[];
 const trades=state?.trades??[];
 const asks=useMemo(()=>levels(orders,'SELL_GOLD'),[orders]);
 const bids=useMemo(()=>levels(orders,'BUY_GOLD'),[orders]);
 const mine=orders.filter(order=>order.mine);
 const maxDepth=Math.max(1,...asks.map(level=>level.quantity),...bids.map(level=>level.quantity));
 const recent24=trades.filter(trade=>trade.executedAt>=Date.now()-86_400_000).slice().sort((a,b)=>a.executedAt-b.executedAt);
 const first24=recent24[0]?.priceSilverPerGold??null;
 const last=trades[0]?.priceSilverPerGold??asks[0]?.price??bids[0]?.price??null;
 const change=first24&&last!==null?((last-first24)/first24)*100:0;
 const high=recent24.length?Math.max(...recent24.map(t=>t.priceSilverPerGold)):last;
 const low=recent24.length?Math.min(...recent24.map(t=>t.priceSilverPerGold)):last;
 const volume24=recent24.reduce((sum,trade)=>sum+trade.goldQuantity,0);
 const chartValues=(recent24.length?recent24:trades.slice(0,24).reverse()).map(t=>t.priceSilverPerGold);
 const chart=sparkPoints(chartValues);

 const p=/^\d+$/.test(price)?Number(price):NaN;
 const q=/^\d+$/.test(quantity)?Number(quantity):NaN;
 const gross=Number.isSafeInteger(p)&&Number.isSafeInteger(q)?p*q:0;
 const feeBps=state?.sellerFeeBps??200;
 const sellFee=Math.floor(gross*feeBps/10000);
 const sellNet=Math.max(0,gross-sellFee);
 const wallet=state?.wallet??{silver:game.silver,gold:game.market.gold,revision:0};
 const canSubmit=!!onlineLease&&!!state&&!busy&&!game.expedition&&Number.isSafeInteger(p)&&p>0&&Number.isSafeInteger(q)&&q>0&&
  (side==='BUY_GOLD'?wallet.silver>=gross:wallet.gold>=q);

 const orderPages=Math.max(1,Math.ceil(mine.length/PAGE_SIZE));
 const safeOrderPage=Math.min(page,orderPages-1);
 const shownOrders=mine.slice(safeOrderPage*PAGE_SIZE,safeOrderPage*PAGE_SIZE+PAGE_SIZE);
 const tradePages=Math.max(1,Math.ceil(trades.length/PAGE_SIZE));
 const safeTradePage=Math.min(page,tradePages-1);
 const shownTrades=trades.slice(safeTradePage*PAGE_SIZE,safeTradePage*PAGE_SIZE+PAGE_SIZE);

 const chooseLevel=(next:GoldExchangeSide,level:Level)=>{
  setSide(next);
  setPrice(String(level.price));
  if(!quantity)setQuantity('1');
 };

 const submit=async()=>{
  if(!onlineLease||!canSubmit)return;
  setBusy(true);setMessage('');
  try{
   const next=await placeOnlineGoldExchangeOrder(onlineLease,{side,priceSilverPerGold:p,goldQuantity:q});
   apply(next);
   feel.play('market.order-placed');
   setMessage(side==='BUY_GOLD'?'Gold 매수 주문을 등록했습니다.':'Gold 매도 주문을 등록했습니다.');
  }catch(error){feel.play('ui.error');setMessage(error instanceof Error?error.message:'골드 거래 주문을 처리하지 못했습니다.');}
  finally{setBusy(false);}
 };

 const cancel=async(orderId:string)=>{
  if(!onlineLease||busy)return;
  setBusy(true);setMessage('');
  try{apply(await cancelOnlineGoldExchangeOrder(onlineLease,orderId));feel.play('market.order-cancelled');setMessage('남은 주문을 취소하고 에스크로를 반환했습니다.');}
  catch(error){feel.play('ui.error');setMessage(error instanceof Error?error.message:'골드 거래 주문을 취소하지 못했습니다.');}
  finally{setBusy(false);}
 };

 if(!onlineLease){
  return <Screen eyebrow="GOLD / SILVER" title="골드 거래소" meta={<span>SERVER ONLY</span>}>
   <div className="tc-goldx-locked">
    <div className="tc-goldx-coin" aria-hidden="true">G</div>
    <h2>온라인 전용 환전시장</h2>
    <p>Gold는 유료 재화와 연결되므로 로컬 거래를 지원하지 않습니다. Google 로그인 후 활성 플레이 세션에서만 주문할 수 있습니다.</p>
    <div><span><small>보유 Gold</small><b>{game.market.gold.toLocaleString()} G</b></span><span><small>보유 Silver</small><b>{game.silver.toLocaleString()} S</b></span></div>
   </div>
  </Screen>;
 }

 return <Screen eyebrow="NOVAR CURRENCY EXCHANGE" title="골드 거래소" meta={<span className={live==='subscribed'?'tc-goldx-live active':'tc-goldx-live'}>{live==='subscribed'?'LIVE':live==='connecting'?'SYNC':'RETRY'}</span>}>
  <div className={'tc-goldx tab-'+tab}>
   <Segments items={tabs} value={tab} onChange={next=>{setTab(next);setPage(0);setMessage('');}} label="골드 거래소 메뉴"/>

   {tab==='market'&&<>
    <section className="tc-goldx-hero">
     <div className="tc-goldx-pair"><div className="tc-goldx-coin" aria-hidden="true">G</div><span><small>통화쌍</small><b>GOLD / SILVER</b><em>1 Gold당 Silver</em></span></div>
     <div className="tc-goldx-price"><small>최근 체결가</small><b>{last===null?'—':money(last)+' S'}</b><span className={change>=0?'up':'down'}>{recent24.length?pct(change):'체결 대기'}</span></div>
     <div className="tc-goldx-wallet"><span><small>GOLD</small><b>{money(wallet.gold)}</b></span><span><small>SILVER</small><b>{money(wallet.silver)}</b></span></div>
    </section>

    <section className="tc-goldx-chart">
     <div className="plot">{chart?<svg viewBox="0 0 100 34" preserveAspectRatio="none" aria-label="Gold Silver 최근 체결 추이"><polyline points={chart} fill="none" vectorEffect="non-scaling-stroke"/></svg>:<span>체결 데이터가 쌓이면 시세 추이가 표시됩니다.</span>}</div>
     <div className="stats"><span><small>24H 고가</small><b>{high===null?'—':money(high)+' S'}</b></span><span><small>24H 저가</small><b>{low===null?'—':money(low)+' S'}</b></span><span><small>24H 거래량</small><b>{money(volume24)+' G'}</b></span></div>
    </section>

    <section className="tc-goldx-book">
     <header><span>실시간 호가</span><small>가격 S/G · Gold 수량</small></header>
     <div className="books">
      <div className="ask"><b>Gold 판매</b>{asks.map(level=><button key={level.price} onClick={()=>chooseLevel('BUY_GOLD',level)}><i style={{width:(level.quantity/maxDepth*100)+'%'}}/><span>{money(level.price)}</span><small>{money(level.quantity)} G</small></button>)}{!asks.length&&<em>판매 주문 없음</em>}</div>
      <div className="bid"><b>Gold 구매</b>{bids.map(level=><button key={level.price} onClick={()=>chooseLevel('SELL_GOLD',level)}><i style={{width:(level.quantity/maxDepth*100)+'%'}}/><span>{money(level.price)}</span><small>{money(level.quantity)} G</small></button>)}{!bids.length&&<em>구매 주문 없음</em>}</div>
     </div>
    </section>

    <section className="tc-goldx-ticket">
     <Segments items={[['BUY_GOLD','Gold 매수'],['SELL_GOLD','Gold 매도']] as const} value={side} onChange={setSide} label="골드 거래 방향"/>
     <div className="fields"><label><small>1G 가격</small><input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))}/><span>S</span></label><label><small>Gold 수량</small><input inputMode="numeric" value={quantity} onChange={e=>setQuantity(e.target.value.replace(/\D/g,''))}/><span>G</span></label></div>
     <div className="settlement">
      <span><small>{side==='BUY_GOLD'?'필요 Silver':'판매 총액'}</small><b>{money(gross)} S</b></span>
      <span><small>{side==='BUY_GOLD'?'매수 수수료':'판매 수수료'}</small><b>{side==='BUY_GOLD'?'없음':`${(feeBps/100).toFixed(0)}% · ${money(sellFee)} S`}</b></span>
      <span><small>{side==='BUY_GOLD'?'체결 시 수령':'예상 실수령'}</small><b>{side==='BUY_GOLD'?money(q||0)+' G':money(sellNet)+' S'}</b></span>
     </div>
     <button className={side==='BUY_GOLD'?'buy':'sell'} disabled={!canSubmit} onClick={()=>void submit()}>{busy?'처리 중':side==='BUY_GOLD'?'Gold 매수 주문':'Gold 매도 주문'}</button>
     <p>{game.expedition?'원정 중에는 주문할 수 없습니다.':message||`즉시 정산 · 등록 수수료 없음 · 판매 체결 수수료 ${(feeBps/100).toFixed(0)}%`}</p>
    </section>
   </>}

   {tab==='orders'&&<>
    <section className="tc-goldx-order-summary"><span><small>진행 주문</small><b>{mine.length}건</b></span><span><small>매수 에스크로</small><b>{money(mine.filter(o=>o.side==='BUY_GOLD').reduce((sum,o)=>sum+o.priceSilverPerGold*o.remainingGoldQuantity,0))} S</b></span><span><small>매도 에스크로</small><b>{money(mine.filter(o=>o.side==='SELL_GOLD').reduce((sum,o)=>sum+o.remainingGoldQuantity,0))} G</b></span></section>
    <div className="tc-goldx-orders">
     {shownOrders.map(order=>{const filled=order.originalGoldQuantity-order.remainingGoldQuantity,pctFilled=order.originalGoldQuantity?filled/order.originalGoldQuantity*100:0;return <article key={order.orderId}>
      <span className={'side '+(order.side==='BUY_GOLD'?'buy':'sell')}>{order.side==='BUY_GOLD'?'매수':'매도'}</span>
      <div><b>{money(order.priceSilverPerGold)} S / G</b><small>{filled}/{order.originalGoldQuantity} G 체결 · 잔량 {order.remainingGoldQuantity} G</small><i><em style={{width:pctFilled+'%'}}/></i></div>
      <button disabled={busy} onClick={()=>void cancel(order.orderId)}>취소</button>
     </article>})}
     {!shownOrders.length&&<div className="tc-goldx-empty">진행 중인 Gold 주문이 없습니다.</div>}
    </div>
    <Pager page={safeOrderPage} count={orderPages} onChange={setPage}/>
    <div className="tc-goldx-note">{message||'취소하면 미체결 Silver 또는 Gold가 즉시 서버 지갑으로 반환됩니다.'}</div>
   </>}

   {tab==='trades'&&<>
    <section className="tc-goldx-trade-summary"><span><small>최근 체결가</small><b>{last===null?'—':money(last)+' S'}</b></span><span><small>24H 거래량</small><b>{money(volume24)} G</b></span><span><small>내 판매 수수료</small><b>{(feeBps/100).toFixed(0)}%</b></span></section>
    <div className="tc-goldx-trades">
     {shownTrades.map(trade=><article key={trade.tradeId}>
      <div className="price"><small>체결가</small><b>{money(trade.priceSilverPerGold)} S</b></div>
      <div><small>수량</small><b>{money(trade.goldQuantity)} G</b></div>
      <div><small>거래대금</small><b>{money(trade.grossSilver)} S</b></div>
      <span className={trade.buyerMine?'buy':trade.sellerMine?'sell':''}>{trade.buyerMine?'내 매수':trade.sellerMine?'내 매도':'시장 체결'}</span>
     </article>)}
     {!shownTrades.length&&<div className="tc-goldx-empty">아직 Gold 체결 기록이 없습니다.</div>}
    </div>
    <Pager page={safeTradePage} count={tradePages} onChange={setPage}/>
    <div className="tc-goldx-note">Gold와 Silver는 체결 즉시 양쪽 서버 지갑에 정산됩니다. 별도 보관함 수령이 없습니다.</div>
   </>}
  </div>
 </Screen>;
}
