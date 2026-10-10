import {SkillBookArt} from '../inventory/SkillBookArt';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import {aggregateOrderBookByPrice,getBestAsk,getBestBid,getMyOpenOrders,currentMarketCatalog,marketItemName,orderBook} from '../../game/market/marketService';
import {EquipmentArt} from '../inventory/EquipmentArt';
import {EQUIPMENT_DEFINITIONS} from '../../game/data/equipment';
import type {EquipmentKind,EquipmentGrade} from '../../game/types';
import {Glyph,Pager,Screen,Segments} from '../../ui/mobile';
import type {GameplayLease} from '../../online/gameSession';
import {
 applyOnlineEconomyToGame,applyOnlineMarketSnapshotToGame,cancelOnlineMarketOrder,claimAllOnlineMarketStorage,claimOnlineMarketStorage,
 loadOnlineMarketState,placeOnlineMarketOrder,subscribeOnlineMarketRealtime,type OnlineMarketState
} from '../../online/market';
import {demoMarketView} from './demoLiveMarket';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';
import type {GameFeelEvent} from '../../gameFeel/types';
import type {MarketIntent} from './marketNavigation';

type Tab='market'|'orders'|'storage';
type Side='BUY'|'SELL';
type Category='all'|'equipment'|'materials'|'skillbooks'|'other';
type RangeKey='1H'|'24H'|'1W'|'1M'|'ALL';
type Trend={points:string;delta:number|null;last:number|null;low:number|null;high:number|null;count:number};
const PAGE_SIZE=5;
const tabs=[['market','시장'],['orders','내 주문'],['storage','보관함']] as const;
const categoryTabs:[Category,string][]=[['all','전체'],['equipment','장비'],['materials','재료'],['skillbooks','스킬북'],['other','기타']];
const ranges:[RangeKey,string][]=[['1H','1H'],['24H','24H'],['1W','1W'],['1M','1M'],['ALL','ALL']];
const money=(n:number|null)=>n===null?'—':Math.round(n).toLocaleString()+' S';
function ProductArt({item}:{item:{category:string;skillBookGrade?:string;gear?:{kind:string;grade?:EquipmentGrade}}}){return item.category==='skillbooks'?<SkillBookArt grade={item.skillBookGrade}/>:item.gear&&item.gear.kind in EQUIPMENT_DEFINITIONS?<EquipmentArt kind={item.gear.kind as EquipmentKind} grade={item.gear.grade}/>:<Glyph name={categoryGlyph(item.category)}/>;}
const categoryGlyph=(c:string)=>c==='equipment'?'equipment':c==='materials'?'materials':c==='skillbooks'?'skillbooks':c==='tickets'?'tickets':'other';
const categoryLabel=(c:string)=>c==='equipment'?'장비':c==='materials'?'재료':c==='skillbooks'?'스킬북':c==='tickets'?'입장권':'기타';
const categoryMatch=(entryCategory:string,filter:Category)=>filter==='all'||entryCategory===filter||(filter==='other'&&['tickets','other'].includes(entryCategory));
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

export function ServerMarketScreen({game,setGame,lease,intent,onIntentConsumed,onReturnToInventory,onReturnToEnhancement,onReturnToSkill}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;lease:GameplayLease;intent?:MarketIntent|null;onIntentConsumed?:()=>void;onReturnToInventory?:(inventoryKey:string)=>void;onReturnToEnhancement?:(itemId:string)=>void;onReturnToSkill?:(skillId:string)=>void}){
 const feel=useGameFeel();
 const [snapshot,setSnapshot]=useState<OnlineMarketState|null>(null);
 const [tab,setTab]=useState<Tab>('market');
 const [category,setCategory]=useState<Category>('all');
 const [query,setQuery]=useState('');
 const [selected,setSelected]=useState<string|null>(null);
 const [tradeSide,setTradeSide]=useState<Side|null>(null);
 const [range,setRange]=useState<RangeKey>('24H');
 const [price,setPrice]=useState('');
 const [qty,setQty]=useState('1');
 const [page,setPage]=useState(0);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [live,setLive]=useState<'connecting'|'subscribed'|'error'>('connecting');
 const [demoMode,setDemoMode]=useState(true);
 const [demoTick,setDemoTick]=useState(0);
 const [tradePulse,setTradePulse]=useState(false);
 const [returnInventoryKey,setReturnInventoryKey]=useState<string|null>(null);
 const [returnEnhancementId,setReturnEnhancementId]=useState<string|null>(null);
 const [returnSkillId,setReturnSkillId]=useState<string|null>(null);
 useEffect(()=>{if(!intent)return;setTab('market');setCategory(intent.skillId?'skillbooks':'all');setQuery('');setPage(0);setSelected(intent.itemId);setTradeSide(null);setRange('24H');setQty('1');setError('');setDemoMode(false);setReturnInventoryKey(intent.inventoryKey??null);setReturnEnhancementId(intent.enhancementItemId??null);setReturnSkillId(intent.skillId??null);onIntentConsumed?.();},[intent?.itemId,intent?.inventoryKey,intent?.skillId]);
 const seenTradeIds=useRef<Set<string>|null>(null),tradePulseTimer=useRef<number|null>(null);

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

 useEffect(()=>{
  if(!demoMode)return;
  const timer=window.setInterval(()=>setDemoTick(tick=>tick+1),900);
  return()=>window.clearInterval(timer);
 },[demoMode]);
 useEffect(()=>{seenTradeIds.current=null;},[lease.leaseId,lease.generation]);
 useEffect(()=>{
  if(!snapshot)return;
  const ids=new Set(snapshot.trades.map(trade=>trade.tradeId));
  if(seenTradeIds.current===null){seenTradeIds.current=ids;return;}
  const fresh=snapshot.trades.filter(trade=>!seenTradeIds.current!.has(trade.tradeId)&&(trade.buyerMine||trade.sellerMine));
  seenTradeIds.current=ids;
  if(!fresh.length)return;
  const partial=fresh.some(trade=>snapshot.orders.some(order=>order.mine&&order.status==='PARTIAL'&&(order.orderId===trade.buyOrderId||order.orderId===trade.sellOrderId)));
  feel.play(partial?'market.trade-partial':'market.trade-filled');
  if(tradePulseTimer.current!==null)window.clearTimeout(tradePulseTimer.current);
  setTradePulse(true);
  tradePulseTimer.current=window.setTimeout(()=>{setTradePulse(false);tradePulseTimer.current=null;},520);
 },[snapshot,feel]);
 useEffect(()=>()=>{if(tradePulseTimer.current!==null)window.clearTimeout(tradePulseTimer.current);},[]);

 const view=useMemo(()=>snapshot?applyOnlineMarketSnapshotToGame(game,snapshot):game,[game,snapshot]);
 const [gradeFilter,setGradeFilter]=useState('all');
 const catalog=useMemo(()=>currentMarketCatalog(view).filter(item=>gradeFilter==='all'||item.gear&&'grade' in item.gear&&item.gear.grade===gradeFilter),[view,gradeFilter]);
 const normalizedQuery=query.trim().toLowerCase();
 const filtered=useMemo(()=>catalog.filter(entry=>categoryMatch(entry.category,category)&&(!normalizedQuery||entry.name.toLowerCase().includes(normalizedQuery))),[catalog,category,normalizedQuery]);
 const marketPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const safeMarketPage=Math.min(page,marketPages-1);
 const shown=pageSlice(filtered,safeMarketPage);
 const item=catalog.find(x=>x.id===selected)??null;
 const side:Side=tradeSide??'BUY';
 const p=/^\d+$/.test(price)?Number(price):NaN,q=/^\d+$/.test(qty)?Number(qty):NaN;
 const book=selected?orderBook(view,selected):{sells:[],buys:[]};
 const actualAsks=aggregateOrderBookByPrice(book.sells).sort((a,b)=>a.price-b.price).slice(0,4);
 const actualBids=aggregateOrderBookByPrice(book.buys).sort((a,b)=>b.price-a.price).slice(0,4);
 const selectedDemo=selected&&demoMode?demoMarketView(selected,getBestAsk(view,selected)??getBestBid(view,selected),demoTick):null;
 const asks=selectedDemo?.asks??actualAsks;
 const bids=selectedDemo?.bids??actualBids;
 const maxDepth=Math.max(1,...asks.map(x=>x.quantity),...bids.map(x=>x.quantity));
 const equipmentSell=!!item?.modernEquipment&&side==='SELL';
 const valid=!!snapshot&&!!item&&!!tradeSide&&!demoMode&&Number.isSafeInteger(p)&&p>0&&Number.isSafeInteger(q)&&q>0&&!busy&&!game.expedition&&(side==='BUY'?snapshot.wallet.silver>=p*q:item.available>=q);
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
  setSelected(id);setTradeSide(null);setRange('24H');setQty('1');setError('');
  setPrice(String(getBestAsk(view,id)??getBestBid(view,id)??trendByItem.get(id)?.last??''));
 };

 const openTrade=(next:Side)=>{
  if(!selected)return;
  setTradeSide(next);setQty('1');setError('');
  setPrice(String((next==='BUY'?(selectedDemo?.asks[0]?.price??getBestAsk(view,selected)):(selectedDemo?.bids[0]?.price??getBestBid(view,selected)))??trendByItem.get(selected)?.last??''));
 };

 const applyPercent=(percent:number)=>{
  if(!snapshot||!item||!Number.isSafeInteger(p)||p<=0)return;
  const max=side==='BUY'?Math.floor(snapshot.wallet.silver/p):item.available;
  const next=max<=0?0:percent===100?max:Math.min(max,Math.max(1,Math.floor(max*percent/100)));
  setQty(String(next));
 };

 const act=async(fn:()=>Promise<OnlineMarketState>,success?:GameFeelEvent)=>{
  setBusy(true);setError('');
  try{applySnapshot(await fn());if(success)feel.play(success as 'market.order-placed'|'market.order-cancelled');}
  catch(e){feel.play('ui.error');setError(e instanceof Error?e.message:'온라인 거래소 요청을 처리하지 못했습니다.');}
  finally{setBusy(false);}
 };

 if(!snapshot)return <Screen eyebrow="SILVER SCALE / ONLINE" title="은저울 거래소" meta={<span>서버 연결</span>}><div className="tc-market-v4-loading"><div className="tc-floor-risk">{error||'서버 거래소 상태를 불러오고 있습니다.'}</div></div></Screen>;

 if(item&&tradeSide){
  const bestAsk=getBestAsk(view,item.id),bestBid=getBestBid(view,item.id);
  const current=selectedDemo?.last??trendByItem.get(item.id)?.last??bestAsk??bestBid;
  const maxOrderQty=Number.isSafeInteger(p)&&p>0?(side==='BUY'?Math.floor(snapshot.wallet.silver/p):item.available):0;
  return <Screen eyebrow="SILVER SCALE / ORDER" title={side==='BUY'?'매수 주문':'매도 주문'} meta={<button className="tc-action secondary slim" onClick={()=>setTradeSide(null)}>상세</button>}>
   <div className={'tc-market-v4-trade'+(tradePulse?' tc-market-trade-pulse':'')}>
    <section className="tc-market-v4-tradehead">
     <span className="tc-market-v2-icon"><ProductArt item={item}/></span>
     <div><small>{categoryLabel(item.category)}</small><b>{item.name}</b><span>최근 체결 {money(current)}</span></div>
     <strong>{side==='BUY'?snapshot.wallet.silver.toLocaleString()+' S':'보유 '+item.available+'개'}</strong>
    </section>

    <section className="tc-market-v2-book tc-market-v4-book">
     <header><span>실시간 주문장</span><small>{demoMode?'DEMO · 실제 주문 미반영':'가격 / 잔량'}</small></header>
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
     <div className="tc-market-v3-presets" aria-label="주문 수량 비율">{[10,25,50,75,100].map(percent=><button key={percent} disabled={busy||maxOrderQty<=0} onClick={()=>applyPercent(percent)}>{percent===100?'MAX':percent+'%'}</button>)}</div>
     <div className="tc-market-v2-total"><span>{side==='BUY'?'예상 예치금':'지정 판매금액'}</span><b>{Number.isFinite(p*q)?money(p*q):'—'}</b></div>
     <button className={'tc-market-v2-submit tc-feel-press '+(side==='BUY'?'buy':'sell')} data-game-feel="press" disabled={!valid} onClick={()=>void act(()=>placeOnlineMarketOrder(lease,{itemId:item.id,assetItemId:equipmentSell&&item.equipmentIds?.[0]?'equipment_v2:'+item.equipmentIds[0]:undefined,side,limitPrice:p,quantity:q}),'market.order-placed')}>{demoMode?'DEMO 시연 중 · 실제 주문 비활성':busy?'처리 중':side==='BUY'?'매수 주문 등록':'매도 주문 등록'}</button>
    </section>
    {error&&<div className="tc-floor-risk">{error}</div>}
   </div>
  </Screen>;
 }

 if(item){
  const bestAsk=getBestAsk(view,item.id),bestBid=getBestBid(view,item.id);
  const displayAsk=selectedDemo?.asks[0]?.price??bestAsk;
  const displayBid=selectedDemo?.bids[0]?.price??bestBid;
  const cutoff=rangeMs(range);
  const now=Date.now();
  const scoped=trades.filter(t=>t.itemId===item.id&&(!cutoff||t.executedAt>=now-cutoff)).slice().sort((a,b)=>a.executedAt-b.executedAt);
  const values=demoMode&&selectedDemo?selectedDemo.series:scoped.slice(-32).map(t=>t.price);
  const trend=makeTrend(values,64);
  const fallback=trendByItem.get(item.id)??makeTrend([]);
  const current=trend.last??fallback.last??displayAsk??displayBid;
  const overviewTrend=trend.count?trend:fallback;
  const estimated=current===null?null:current*item.available;
  return <Screen eyebrow="SILVER SCALE / DETAIL" title={item.name} meta={<button className="tc-action secondary slim tc-market-return" onClick={()=>returnInventoryKey&&onReturnToInventory?onReturnToInventory(returnInventoryKey):returnEnhancementId&&onReturnToEnhancement?onReturnToEnhancement(returnEnhancementId):returnSkillId&&onReturnToSkill?onReturnToSkill(returnSkillId):setSelected(null)}>{returnInventoryKey?'‹ 아이템':returnEnhancementId?'‹ 강화':returnSkillId?'‹ 스킬트리':'시장'}</button>}>
   <div className={'tc-market-v2-detail tc-market-v4-detail'+(tradePulse?' tc-market-trade-pulse':'')}>
    <section className="tc-market-v4-pricehead">
     <div className="tc-market-v4-identity">
      <span className="tc-market-v2-icon"><ProductArt item={item}/></span>
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
     <span className="tc-market-v2-mini"><ProductArt item={item}/></span>
     <div><b>{item.name}</b><small>내 보유 {item.available}개</small></div>
     <div className="value"><b>{money(estimated)}</b><small>평가액</small></div>
    </section>

    <section className="tc-market-v4-transactions">
     <div><span>{demoMode?'DEMO 체결':'최근 체결'}</span><b>{demoMode&&selectedDemo?selectedDemo.series.length:scoped.length||trades.filter(t=>t.itemId===item.id).length}건</b></div>
     <div><span>최저 판매</span><b>{money(displayAsk)}</b></div>
     <div><span>최고 구매</span><b>{money(displayBid)}</b></div>
    </section>

    <div className="tc-market-v4-ctas">
     <button className="buy" onClick={()=>openTrade('BUY')}>BUY · 매수</button>
     <button className="sell" onClick={()=>openTrade('SELL')}>SELL · 매도</button>
    </div>
   </div>
  </Screen>;
 }

 return <Screen eyebrow="SILVER SCALE / ONLINE" title="은저울 거래소" meta={<span>{snapshot.wallet.silver.toLocaleString()} S</span>}>
  <div className={"tc-market-v2 tc-market-v3 tc-market-v4 has-order-policy"+(category==='equipment'?" has-grade-filter":"")+" tab-"+tab+(tradePulse?" tc-market-trade-pulse":"")}>
   <Segments items={tabs} value={tab} onChange={next=>{setTab(next);setSelected(null);setTradeSide(null);setPage(0);setError('');}} label="온라인 거래소 메뉴"/>

   {tab==='market'&&<>
    <div className="tc-market-v4-search">
     <span aria-hidden="true">⌕</span>
     <input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="거래 품목 검색" aria-label="거래 품목 검색"/>
     <button className={'tc-market-demo-toggle '+(demoMode?'active':'')} onClick={()=>setDemoMode(value=>!value)}>{demoMode?'DEMO ON':live==='subscribed'?'LIVE':live==='connecting'?'SYNC':'RETRY'}</button>
    </div>
    <div className="tc-market-v2-cats tc-market-v3-cats tc-market-v4-cats">{categoryTabs.map(([key,label])=><button key={key} className={category===key?'active':''} onClick={()=>{setCategory(key);setGradeFilter('all');setSelected(null);setTradeSide(null);setPage(0);}}>{label}</button>)}</div>
    {category==='equipment'&&<div className="tc-market-grade-filters" aria-label="장비 등급">{[['all','전체'],['common','일반'],['uncommon','고급'],['rare','희귀'],['heroic','영웅'],['legendary','전설']].map(([key,label])=><button key={key} className={'grade-'+key+(gradeFilter===key?' active':'')} onClick={()=>{setGradeFilter(key);setPage(0);}}>{label}</button>)}</div>}
    <div className="tc-market-v2-list tc-market-v3-list tc-market-v4-list">
     {shown.map(entry=>{
      const ask=getBestAsk(view,entry.id),bid=getBestBid(view,entry.id),realTrend=trendByItem.get(entry.id)??makeTrend([]);
      const demo=demoMode?demoMarketView(entry.id,ask??bid??realTrend.last,demoTick):null;
      const trend=demo?makeTrend(demo.series):realTrend;
      const displayPrice=demo?.last??ask??bid;
      const sub=(demoMode?'DEMO · ':'')+(entry.skillBookGrade?entry.skillBookGrade+' · ':'')+categoryLabel(entry.category)+' · 보유 '+entry.available;
      return <button className="tc-market-v2-row tc-market-v3-card tc-market-v4-card" key={entry.id} onClick={()=>choose(entry.id)}>
       <span className="tc-market-v2-mini"><ProductArt item={entry}/></span>
       <span className="name"><b>{entry.name}</b><small>{sub}</small></span>
       <span className={'tc-market-v3-spark '+trendClass(trend.delta)}>{trend.points?<svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points={trend.points} fill="none" vectorEffect="non-scaling-stroke"/></svg>:<i/>}</span>
       <span className="tc-market-v3-rowprice"><b>{money(displayPrice)}</b><small className={trendClass(trend.delta)}>{trendLabel(trend.delta)}</small></span>
       <i>›</i>
      </button>;
     })}
     {!shown.length&&<div className="tc-market-v2-empty">검색 조건에 맞는 품목이 없습니다.</div>}
    </div>
    <Pager page={safeMarketPage} count={marketPages} onChange={setPage}/>
   </>}

   {tab==='orders'&&<>
    <p className="tc-floor-risk">주문은 등록 후 30일에 만료됩니다. 미판매 아이템은 우편함으로 반환됩니다.</p>
    <section className="tc-market-v2-status compact">
     <div><small>진행 주문</small><b>{open.length}건</b></div>
     <div><small>매수</small><b>{open.filter(x=>x.side==='BUY').length}</b></div>
     <div><small>매도</small><b>{open.filter(x=>x.side==='SELL').length}</b></div>
    </section>
    <div className="tc-market-v2-orders">
     {shownOrders.map(order=>{const filled=order.originalQuantity-order.remainingQuantity,pct=order.originalQuantity?filled/order.originalQuantity*100:0;return <article key={order.orderId}>
      <span className={'side '+order.side.toLowerCase()}>{order.side==='BUY'?'매수':'매도'}</span>
      <div className="name"><b>{marketItemName(view,order.itemId)}</b><small>{money(order.limitPrice)} · {filled}/{order.originalQuantity} 체결 · {Math.max(0,Math.ceil(((snapshot.orders.find(o=>o.orderId===order.orderId)?.expiresAt??order.createdAt+30*86400000)-Date.now())/86400000))}일 남음</small><div className="tc-market-v2-progress"><i style={{width:pct+'%'}}/></div></div>
      <button className="tc-feel-press" data-game-feel="press" disabled={busy} onClick={()=>void act(()=>cancelOnlineMarketOrder(lease,order.orderId),'market.order-cancelled')}>취소</button>
     </article>})}
     {!shownOrders.length&&<div className="tc-market-v2-empty">진행 중인 주문이 없습니다.</div>}
    </div>
    <Pager page={safeOrderPage} count={orderPages} onChange={setPage}/>
   </>}

   {tab==='storage'&&<>
    <section className="tc-market-v4-portfolio">
     <div className="title"><small>TRADE STORAGE</small><b>거래 정산 · 기존 미수령</b></div><p>새 거래는 즉시 지급·정산됩니다. 취소·만료된 판매 아이템은 우편함에서 수령하세요.</p>
     <div className="total"><small>보유 Silver</small><b>{snapshot.wallet.silver.toLocaleString()} S</b></div>
     <div><small>수령 대금</small><b>{money(storageSilver)}</b></div>
     <div><small>수령 물품</small><b>{storageItems}개</b></div>
     <button disabled={!storage.length||busy||!!game.expedition} onClick={()=>void act(()=>claimAllOnlineMarketStorage(lease))}>모두 수령</button>
    </section>
    <div className="tc-market-v2-storage tc-market-v4-storage">
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
