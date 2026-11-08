import React,{useEffect,useMemo,useRef,useState} from 'react';
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
import {GoldExchangePriceChart} from './GoldExchangePriceChart';
import './gold-exchange-v2.css';

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

export function GoldExchangeScreen({
 game,setGame,onlineLease,
}:{
 game:GameState;
 setGame:React.Dispatch<React.SetStateAction<GameState>>;
 onlineLease?:GameplayLease|null;
}){
 const feel=useGameFeel();
 const [tab,setTab]=useState<Tab>('market');
 const [chartOpen,setChartOpen]=useState(false);
 const [state,setState]=useState<OnlineGoldExchangeState|null>(null);
 const [side,setSide]=useState<GoldExchangeSide>('BUY_GOLD');
 const [price,setPrice]=useState('');
 const [quantity,setQuantity]=useState('10');
 const [page,setPage]=useState(0);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [live,setLive]=useState<'connecting'|'subscribed'|'error'>('connecting');
 const [tradePulse,setTradePulse]=useState(false);
 const seenTradeIds=useRef<Set<string>|null>(null),tradePulseTimer=useRef<number|null>(null);

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
 useEffect(()=>{seenTradeIds.current=null;},[onlineLease?.leaseId,onlineLease?.generation]);
 useEffect(()=>{
  if(!state)return;
  const ids=new Set(state.trades.map(trade=>trade.tradeId));
  if(seenTradeIds.current===null){seenTradeIds.current=ids;return;}
  const fresh=state.trades.filter(trade=>!seenTradeIds.current!.has(trade.tradeId)&&(trade.buyerMine||trade.sellerMine));
  seenTradeIds.current=ids;
  if(!fresh.length)return;
  const partial=fresh.some(trade=>state.orders.some(order=>order.mine&&order.status==='PARTIAL'&&(order.orderId===trade.buyOrderId||order.orderId===trade.sellOrderId)));
  feel.play(partial?'market.trade-partial':'market.trade-filled');
  if(tradePulseTimer.current!==null)window.clearTimeout(tradePulseTimer.current);
  setTradePulse(true);
  tradePulseTimer.current=window.setTimeout(()=>{setTradePulse(false);tradePulseTimer.current=null;},520);
 },[state,feel]);
 useEffect(()=>()=>{if(tradePulseTimer.current!==null)window.clearTimeout(tradePulseTimer.current);},[]);

 const orders=state?.orders??[];
 const trades=state?.trades??[];
 const asks=useMemo(()=>levels(orders,'SELL_GOLD'),[orders]);
 const bids=useMemo(()=>levels(orders,'BUY_GOLD'),[orders]);
 const mine=orders.filter(order=>order.mine);
 const maxDepth=Math.max(1,...asks.map(level=>level.quantity),...bids.map(level=>level.quantity));
 const recent24=trades.filter(trade=>trade.executedAt>=Date.now()-86_400_000).slice().sort((a,b)=>a.executedAt-b.executedAt);
 const first24=recent24[0]?.priceSilverPerGold??null;
 const lastTradePrice=trades[0]?.priceSilverPerGold??null;
 const last=lastTradePrice??asks[0]?.price??bids[0]?.price??null;
 const change=first24&&last!==null?((last-first24)/first24)*100:0;
 const high=recent24.length?Math.max(...recent24.map(t=>t.priceSilverPerGold)):null;
 const low=recent24.length?Math.min(...recent24.map(t=>t.priceSilverPerGold)):null;
 const volume24=recent24.reduce((sum,trade)=>sum+trade.goldQuantity,0);

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

 const chooseShare=(share:number)=>{
  if(!Number.isSafeInteger(p)||p<=0)return;
  const available=side==='BUY_GOLD'?Math.floor(wallet.silver/p):wallet.gold;
  setQuantity(String(Math.max(0,Math.floor(available*share))));
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

 return <Screen eyebrow="NOVAR CURRENCY EXCHANGE" title="골드 거래소" className="tc-goldx-v2-screen" meta={<span className={live==='subscribed'?'tc-goldx-live active':'tc-goldx-live'}>{live==='subscribed'?'LIVE':live==='connecting'?'SYNC':'RETRY'}</span>}>
  <div className={'tc-goldx tc-goldx-v2 tab-'+tab+(tradePulse?' tc-market-trade-pulse':'')}>
   <Segments items={tabs} value={tab} onChange={next=>{setTab(next);setPage(0);setMessage('');}} label="골드 거래소 메뉴"/>

   {tab==='market'&&<>
    <section className="tc-goldx-v2-quote" aria-label="골드 실시간 시세">
     <div className="pair">
      <small>GOLD / SILVER · 1 Gold당 Silver</small>
      <div><b>{last===null?'체결 대기':money(last)+' S'}</b><em className={change<0?'down':'up'}>{recent24.length>1?pct(change):'—'}</em></div>
     </div>
     <div className="stats">
      <span><small>24시간 최고</small><b>{high===null?'—':money(high)+' S'}</b></span>
      <span><small>24시간 최저</small><b>{low===null?'—':money(low)+' S'}</b></span>
      <span><small>24시간 거래량</small><b>{money(volume24)+' G'}</b></span>
     </div>
     <button type="button" className="tc-goldx-v2-chart-trigger tc-feel-press" data-game-feel="press" onClick={()=>setChartOpen(true)} aria-label="골드 시세 캔들 차트 열기">
      <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.65">
       <path d="M3 4v16h18M6 14v-4m4-2v10m4-13v8m4-8v13M4 15l5-3 4 2 7-8"/>
      </svg>
      <span>시세<br/>차트</span>
     </button>
    </section>

    <div className="tc-goldx-v2-desk">
     <section className="tc-goldx-v2-order" aria-label="골드 지정가 주문">
      <div className="tc-goldx-v2-side">
       <button type="button" className={side==='BUY_GOLD'?'active buy':''} aria-pressed={side==='BUY_GOLD'} onClick={()=>setSide('BUY_GOLD')}>골드 매수</button>
       <button type="button" className={side==='SELL_GOLD'?'active sell':''} aria-pressed={side==='SELL_GOLD'} onClick={()=>setSide('SELL_GOLD')}>골드 매도</button>
      </div>
      <div className="tc-goldx-v2-order-kind"><b>지정가</b><span>가격을 지정하여 주문</span></div>
      <label className="tc-goldx-v2-input">
       <span>가격 <small>(S / 1G)</small></span>
       <div><input aria-label="1골드당 실버 가격" inputMode="numeric" placeholder="가격 입력" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))}/><em>S</em></div>
      </label>
      <label className="tc-goldx-v2-input">
       <span>수량 <small>(Gold)</small></span>
       <div><input aria-label="거래할 골드 수량" inputMode="numeric" placeholder="수량 입력" value={quantity} onChange={e=>setQuantity(e.target.value.replace(/\D/g,''))}/><em>G</em></div>
      </label>
      <div className="tc-goldx-v2-shares" aria-label="보유 자산 기준 수량 선택">
       {[.25,.5,.75,1].map(share=><button type="button" key={share} onClick={()=>chooseShare(share)}>{Math.round(share*100)}%</button>)}
      </div>
      <div className="tc-goldx-v2-available"><small>사용 가능</small><b>{side==='BUY_GOLD'?money(wallet.silver)+' S':money(wallet.gold)+' G'}</b></div>
      <div className="tc-goldx-v2-settlement">
       <div><small>{side==='BUY_GOLD'?'필요 Silver':'판매 총액'}</small><b>{money(gross)} S</b></div>
       <div><small>{side==='BUY_GOLD'?'매수 수수료':'판매 수수료'}</small><b>{side==='BUY_GOLD'?'없음':money(sellFee)+' S'}</b></div>
       <div><small>{side==='BUY_GOLD'?'체결 시 수령':'예상 실수령'}</small><b>{side==='BUY_GOLD'?money(q||0)+' G':money(sellNet)+' S'}</b></div>
      </div>
      <button type="button" className={'tc-goldx-v2-submit '+(side==='BUY_GOLD'?'buy':'sell')+' tc-feel-press'} data-game-feel="press" disabled={!canSubmit} onClick={()=>void submit()}>{busy?'처리 중':side==='BUY_GOLD'?'골드 매수 주문':'골드 매도 주문'}</button>
      <p className="tc-goldx-v2-feedback" role="status">{game.expedition?'원정 중에는 주문할 수 없습니다.':message||'체결 즉시 정산 · 등록 수수료 없음'}</p>
     </section>

     <section className="tc-goldx-v2-orderbook" aria-label="실시간 골드 호가창">
      <header><b>실시간 호가</b><small className={live==='subscribed'?'live':''}>{live==='subscribed'?'● LIVE':live==='connecting'?'연결 중':'재연결 중'}</small></header>
      <div className="tc-goldx-v2-book-head"><span>가격 (S)</span><span>수량 (G)</span></div>
      <div className="tc-goldx-v2-asks">
       {asks.slice().reverse().map(level=><button type="button" key={level.price} onClick={()=>chooseLevel('BUY_GOLD',level)} title={'클릭 시 '+money(level.price)+' S 매수 가격으로 적용'}>
        <i style={{width:(level.quantity/maxDepth*100)+'%'}}/><b>{money(level.price)}</b><span>{money(level.quantity)}</span>
       </button>)}
       {!asks.length&&<div className="tc-goldx-v2-empty">판매 호가 없음</div>}
      </div>
      <div className="tc-goldx-v2-mid"><b>{last===null?'—':money(last)+' S'}</b><small>{lastTradePrice===null?'기준 호가':'최근 체결가'}</small></div>
      <div className="tc-goldx-v2-bids">
       {bids.map(level=><button type="button" key={level.price} onClick={()=>chooseLevel('SELL_GOLD',level)} title={'클릭 시 '+money(level.price)+' S 매도 가격으로 적용'}>
        <i style={{width:(level.quantity/maxDepth*100)+'%'}}/><b>{money(level.price)}</b><span>{money(level.quantity)}</span>
       </button>)}
       {!bids.length&&<div className="tc-goldx-v2-empty">구매 호가 없음</div>}
      </div>
      <footer><span>매수·매도 호가를 누르면 주문 가격이 입력됩니다.</span></footer>
     </section>
    </div>
   </>}

   {tab==='orders'&&<>
    <section className="tc-goldx-order-summary"><span><small>진행 주문</small><b>{mine.length}건</b></span><span><small>매수 에스크로</small><b>{money(mine.filter(o=>o.side==='BUY_GOLD').reduce((sum,o)=>sum+o.priceSilverPerGold*o.remainingGoldQuantity,0))} S</b></span><span><small>매도 에스크로</small><b>{money(mine.filter(o=>o.side==='SELL_GOLD').reduce((sum,o)=>sum+o.remainingGoldQuantity,0))} G</b></span></section>
    <div className="tc-goldx-orders">
     {shownOrders.map(order=>{const filled=order.originalGoldQuantity-order.remainingGoldQuantity,pctFilled=order.originalGoldQuantity?filled/order.originalGoldQuantity*100:0;return <article key={order.orderId}>
      <span className={'side '+(order.side==='BUY_GOLD'?'buy':'sell')}>{order.side==='BUY_GOLD'?'매수':'매도'}</span>
      <div><b>{money(order.priceSilverPerGold)} S / G</b><small>{filled}/{order.originalGoldQuantity} G 체결 · 잔량 {order.remainingGoldQuantity} G</small><i><em style={{width:pctFilled+'%'}}/></i></div>
      <button className="tc-feel-press" data-game-feel="press" disabled={busy} onClick={()=>void cancel(order.orderId)}>취소</button>
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
   {chartOpen&&<GoldExchangePriceChart trades={trades} lastPrice={lastTradePrice} onClose={()=>setChartOpen(false)}/>}
  </div>
 </Screen>;
}
