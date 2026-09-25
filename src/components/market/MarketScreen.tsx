import React,{useMemo,useState} from 'react';
import type {GameState,MarketOrder} from '../../game/types';
import {
  aggregateOrderBookByPrice,cancelOrder,getBestAsk,getBestBid,getLastTrade,getMyOpenOrders,
  getRecentTrades,marketCatalog,marketItemName,orderBook,placeOrder
} from '../../game/market/marketService';
import {marketChart,marketStats} from '../../game/market/marketStatistics';
import {Glyph,Pager,Screen,Segments} from '../../ui/mobile';

type Tab='buy'|'sell'|'orders'|'trades';
type Sort='name'|'priceLow'|'priceHigh';
type Category='all'|'equipment'|'materials'|'skillbooks'|'tickets'|'other';
const PAGE_SIZE=5;
const tabs=[['buy','구매'],['sell','판매'],['orders','내 요청'],['trades','체결']] as const;
const categories:Record<Category,string>={all:'전체',equipment:'장비',materials:'재료',skillbooks:'스킬북',tickets:'입장권',other:'기타'};
const money=(n:number|null)=>n===null?'—':Math.round(n).toLocaleString()+' S';
const time=(n:number)=>new Date(n).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
const levels=(orders:MarketOrder[],desc=false)=>aggregateOrderBookByPrice(orders).sort((a,b)=>desc?b.price-a.price:a.price-b.price).slice(0,4);
const categoryGlyph=(c:string)=>c==='equipment'?'equipment':c==='materials'?'materials':c==='skillbooks'?'skillbooks':c==='tickets'?'tickets':'other';
const itemTier=(id:string,gearTier?:number)=>gearTier??(/^.+:[^:]+:(\d+)$/.exec(id)?.[1]?Number(/^.+:[^:]+:(\d+)$/.exec(id)![1]):0);

export function MarketScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [tab,setTab]=useState<Tab>('buy'),[category,setCategory]=useState<Category>('all'),[tier,setTier]=useState(0),[query,setQuery]=useState(''),[sort,setSort]=useState<Sort>('name'),[selected,setSelected]=useState<string|null>(null),[side,setSide]=useState<'BUY'|'SELL'>('BUY'),[price,setPrice]=useState(''),[qty,setQty]=useState(''),[confirm,setConfirm]=useState(false),[canceling,setCanceling]=useState<MarketOrder|null>(null),[page,setPage]=useState(0),[feedback,setFeedback]=useState('');
 const catalog=useMemo(()=>marketCatalog(game),[game]);

 const filtered=useMemo(()=>{
  const selling=tab==='sell';
  return catalog.filter(x=>{
   const t=itemTier(x.id,x.gear?.tier);
   return (!selling||x.available>0)
    &&(category==='all'||x.category===category)
    &&(!tier||t===tier)
    &&x.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }).sort((a,b)=>{
   if(sort==='name')return a.name.localeCompare(b.name,'ko');
   const av=tab==='sell'?getBestBid(game,a.id):getBestAsk(game,a.id),bv=tab==='sell'?getBestBid(game,b.id):getBestAsk(game,b.id);
   return sort==='priceLow'?(av??Number.MAX_SAFE_INTEGER)-(bv??Number.MAX_SAFE_INTEGER):(bv??-1)-(av??-1);
  });
 },[catalog,tab,category,tier,query,sort,game]);

 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=filtered.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE);
 const item=catalog.find(x=>x.id===selected);
 const book=selected?orderBook(game,selected):{sells:[],buys:[]},asks=levels(book.sells),bids=levels(book.buys,true),ask=selected?getBestAsk(game,selected):null,bid=selected?getBestBid(game,selected):null,last=selected?getLastTrade(game,selected):null,recent=selected?getRecentTrades(game,selected,5):[];
 const stats=selected?marketStats(game.market.trades,selected,'24H',Date.now()):null,chart=selected?marketChart(game.market.trades,selected,'24H',Date.now()):[];
 const vals=chart.map(p=>p.price),min=vals.length?Math.min(...vals):0,max=vals.length?Math.max(...vals):1,spread=max-min||1,poly=chart.map((pt,i)=>(chart.length===1?50:i/(chart.length-1)*100)+','+(88-(pt.price-min)/spread*70)).join(' ');
 const p=/^\d+$/.test(price)?Number(price):NaN,q=/^\d+$/.test(qty)?Number(qty):NaN,valid=!!item&&Number.isSafeInteger(p)&&p>0&&Number.isSafeInteger(q)&&q>0&&(side==='BUY'?game.silver>=p*q:item.available>=q)&&!game.expedition;

 const choose=(id:string,nextSide:'BUY'|'SELL')=>{setSelected(id);setSide(nextSide);setPrice(String((nextSide==='BUY'?getBestAsk(game,id):getBestBid(game,id))??getLastTrade(game,id)?.price??''));setQty('1');setConfirm(false);setFeedback('');};
 const submit=()=>{if(!selected)return;let message='주문이 등록되었습니다.';setGame(s=>{const n=placeOrder(s,{itemId:selected,side,limitPrice:p,quantity:q});const o=n.market.orders.at(-1);if(o){const filled=o.originalQuantity-o.remainingQuantity;message=filled?(o.remainingQuantity?filled+'개 체결 · '+o.remainingQuantity+'개 대기':filled+'개 전량 체결'):'요청서 등록 완료';}else message=n.notice;return n;});setConfirm(false);setFeedback(message);};

 const open=getMyOpenOrders(game),buyOrders=open.filter(o=>o.side==='BUY'),sellOrders=open.filter(o=>o.side==='SELL'),myTrades=game.market.trades.filter(t=>t.buyerId===game.market.ownerId||t.sellerId===game.market.ownerId).slice().reverse();
 const orderSource=tab==='trades'?myTrades:[],orderPages=Math.max(1,Math.ceil(orderSource.length/PAGE_SIZE)),orderSafe=Math.min(page,orderPages-1),tradeShown=orderSource.slice(orderSafe*PAGE_SIZE,orderSafe*PAGE_SIZE+PAGE_SIZE);

 if(item){
  return <Screen eyebrow="SILVER SCALE / ORDER DESK" title={item.name} meta={<button className="tc-action secondary slim" onClick={()=>{setSelected(null);setConfirm(false);setFeedback('');}}>목록</button>}>
   <div className="tc-market-item">
    <section className="tc-market-itemhead">
     <div className="tc-market-itemicon"><Glyph name={categoryGlyph(item.category)}/></div>
     <div><small>{categories[item.category as Category]}{itemTier(item.id,item.gear?.tier)?' · T'+itemTier(item.id,item.gear?.tier):''}</small><b>{item.name}</b><p>{item.description}</p></div>
     <div className="tc-market-owned"><small>보유</small><b>{item.available}</b></div>
    </section>

    <section className="tc-market-bookdesk">
     <div className="tc-market-bookcol sell"><header><b>판매 요청서</b><span>가격 / 수량</span></header>{asks.map(x=><button key={x.price} onClick={()=>{setSide('BUY');setPrice(String(x.price));}}><b>{money(x.price)}</b><span>{x.quantity}</span></button>)}{Array.from({length:Math.max(0,4-asks.length)},(_,i)=><div className="empty" key={'a'+i}><b>—</b><span>—</span></div>)}</div>
     <div className="tc-market-bookcol buy"><header><b>구매 요청서</b><span>가격 / 수량</span></header>{bids.map(x=><button key={x.price} onClick={()=>{setSide('SELL');setPrice(String(x.price));}}><b>{money(x.price)}</b><span>{x.quantity}</span></button>)}{Array.from({length:Math.max(0,4-bids.length)},(_,i)=><div className="empty" key={'b'+i}><b>—</b><span>—</span></div>)}</div>
    </section>

    <section className="tc-market-history">
     <div className="tc-market-history-head"><span>시장 이력 · 24H</span><b>{last?money(last.price):'체결 없음'}</b></div>
     <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="24시간 가격 추이">{poly&&<polyline points={poly} fill="none" vectorEffect="non-scaling-stroke"/>}<line x1="0" y1="88" x2="100" y2="88"/></svg>
     <div className="tc-market-history-stats"><span>최고 <b>{money(stats?.highPrice??null)}</b></span><span>최저 <b>{money(stats?.lowPrice??null)}</b></span><span>평균 <b>{money(stats?.averagePrice??null)}</b></span><span>거래량 <b>{stats?.volume??0}</b></span></div>
    </section>

    <section className="tc-market-ticket">
     <Segments items={[['BUY','매수 요청'],['SELL','매도 요청']] as const} value={side} onChange={v=>{setSide(v);setPrice(String((v==='BUY'?ask:bid)??last?.price??''));}} label="주문 방향"/>
     <div className="tc-market-ticket-fields"><label>수량<input inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value.replace(/\D/g,''))}/></label><label>가격<input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))}/></label><button onClick={()=>setQty(String(side==='BUY'&&p>0?Math.max(0,Math.floor(game.silver/p)):item.available))}>최대</button></div>
     <div className="tc-market-ticket-total"><span>{side==='BUY'?'예약 Silver':'예상 주문가'}</span><b>{Number.isFinite(p*q)?money(p*q):'—'}</b><small>{game.expedition?'원정 중 주문 등록 불가':side==='BUY'?'체결가는 지정가보다 낮을 수 있습니다.':'보유 수량만 예치할 수 있습니다.'}</small></div>
     <button className="tc-action" disabled={!valid} onClick={()=>setConfirm(true)}>{side==='BUY'?'구매 요청서 등록':'판매 요청서 등록'}</button>
    </section>

    <div className="tc-market-tape">{recent.length?recent.map(t=><span key={t.tradeId}>{time(t.executedAt)} {money(t.price)}×{t.quantity}</span>):<span>최근 체결 기록 없음</span>}</div>
   </div>
   {confirm&&<div className="tc-modalback" onClick={()=>setConfirm(false)}><section className="tc-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><h2>{side==='BUY'?'구매':'판매'} 요청서 확인</h2><p><b>{item.name}</b><br/>개당 {money(p)} · 수량 {q}<br/>총 {money(p*q)}</p><div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>setConfirm(false)}>취소</button><button className="tc-action" onClick={submit}>등록</button></div></section></div>}
   {feedback&&<div className="notice">{feedback}</div>}
  </Screen>;
 }

 return <Screen eyebrow="SILVER SCALE EXCHANGE" title="은저울 거래소" meta={<span>{game.silver.toLocaleString()} S</span>}>
  <div className="tc-market-board">
   <Segments items={tabs} value={tab} onChange={v=>{setTab(v);setPage(0);setFeedback('');}} label="거래소 메뉴"/>
   {(tab==='buy'||tab==='sell')&&<>
    <div className="tc-market-filters"><input placeholder="아이템 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select value={category} onChange={e=>{setCategory(e.target.value as Category);setPage(0);}}>{Object.entries(categories).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><select value={tier} onChange={e=>{setTier(+e.target.value);setPage(0);}}><option value="0">전체 T</option>{[1,2,3,4,5].map(t=><option key={t} value={t}>T{t}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value as Sort)}><option value="name">이름</option><option value="priceLow">가격↑</option><option value="priceHigh">가격↓</option></select></div>
    <div className="tc-market-listhead"><span>아이템</span><span>{tab==='buy'?'최저 판매가':'최고 구매가'}</span><span>{tab==='buy'?'시장 수량':'보유'}</span></div>
    <div className="tc-market-offers">{shown.map(x=>{const b=orderBook(game,x.id),marketQty=aggregateOrderBookByPrice(b.sells).reduce((n,v)=>n+v.quantity,0),priceValue=tab==='buy'?getBestAsk(game,x.id):getBestBid(game,x.id);return <button key={x.id} onClick={()=>choose(x.id,tab==='buy'?'BUY':'SELL')}><span className="tc-market-miniicon"><Glyph name={categoryGlyph(x.category)}/></span><span className="name"><b>{x.name}</b><small>{itemTier(x.id,x.gear?.tier)?'T'+itemTier(x.id,x.gear?.tier)+' · ':''}{categories[x.category as Category]}</small></span><span className={tab==='buy'?'ask':'bid'}><b>{money(priceValue)}</b></span><span><b>{tab==='buy'?marketQty:x.available}</b></span><i>›</i></button>})}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-market-emptyrow" key={'e'+i}/>)}</div>
    <Pager page={safe} count={pages} onChange={setPage}/>
   </>}

   {tab==='orders'&&<div className="tc-market-myorders">
    <section><header><b>구매 요청서</b><span>{buyOrders.length}</span></header>{buyOrders.slice(0,3).map(o=><article key={o.orderId}><div><b>{marketItemName(game,o.itemId)}</b><small>{money(o.limitPrice)} · 잔량 {o.remainingQuantity}/{o.originalQuantity}</small></div><button onClick={()=>setCanceling(o)}>취소</button></article>)}{!buyOrders.length&&<p>진행 중인 구매 요청서가 없습니다.</p>}</section>
    <section><header><b>판매 요청서</b><span>{sellOrders.length}</span></header>{sellOrders.slice(0,3).map(o=><article key={o.orderId}><div><b>{marketItemName(game,o.itemId)}</b><small>{money(o.limitPrice)} · 잔량 {o.remainingQuantity}/{o.originalQuantity}</small></div><button onClick={()=>setCanceling(o)}>취소</button></article>)}{!sellOrders.length&&<p>진행 중인 판매 요청서가 없습니다.</p>}</section>
   </div>}

   {tab==='trades'&&<><div className="tc-market-listhead trades"><span>체결 아이템</span><span>가격</span><span>수량</span></div><div className="tc-market-offers trades">{tradeShown.map(t=><div className="tc-trade-row" key={t.tradeId}><span className="tc-market-miniicon"><Glyph name="market"/></span><span className="name"><b>{marketItemName(game,t.itemId)}</b><small>{t.buyerId===game.market.ownerId?'매수':'매도'} · {time(t.executedAt)}</small></span><span><b>{money(t.price)}</b></span><span><b>{t.quantity}</b></span></div>)}{Array.from({length:Math.max(0,PAGE_SIZE-tradeShown.length)},(_,i)=><div className="tc-market-emptyrow" key={'t'+i}/>)}</div><Pager page={orderSafe} count={orderPages} onChange={setPage}/></>}
  </div>
  {canceling&&<div className="tc-modalback" onClick={()=>setCanceling(null)}><section className="tc-modal" onClick={e=>e.stopPropagation()}><h2>요청서 취소</h2><p><b>{marketItemName(game,canceling.itemId)}</b><br/>남은 수량 {canceling.remainingQuantity}개를 취소하고 예치 자산을 반환합니다.</p><div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>setCanceling(null)}>유지</button><button className="tc-action danger" onClick={()=>{setGame(s=>cancelOrder(s,canceling.orderId));setCanceling(null);setFeedback('요청서를 취소했습니다.');}}>취소</button></div></section></div>}
  {feedback&&<div className="notice">{feedback}</div>}
 </Screen>;
}
