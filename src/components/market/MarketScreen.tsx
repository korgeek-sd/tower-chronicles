import React,{useMemo,useState} from 'react';
import type {GameState,MarketOrder} from '../../game/types';
import {cancelOrder,marketCatalog,marketItemName,orderBook,placeOrder,getBestAsk,getBestBid,getLastTrade,getRecentTrades,getMyOpenOrders,aggregateOrderBookByPrice} from '../../game/market/marketService';
import {marketStats} from '../../game/market/marketStatistics';
import {Pager,Screen,Segments} from '../../ui/mobile';

type Tab='browse'|'orders'|'trades';type Sort='name'|'high'|'low';
const PAGE_SIZE=6;
const cats={all:'전체',equipment:'장비',materials:'재료',skillbooks:'스킬북',tickets:'입장권',other:'기타'} as const;
const tabItems=[['browse','상품'],['orders','내 주문'],['trades','내 거래']] as const;
const money=(n:number|null)=>n===null?'—':Math.round(n).toLocaleString()+' S';
const time=(n:number)=>new Date(n).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
const levels=(orders:MarketOrder[],desc=false)=>aggregateOrderBookByPrice(orders).sort((a,b)=>desc?b.price-a.price:a.price-b.price).slice(0,3);

export function MarketScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [tab,setTab]=useState<Tab>('browse'),[category,setCategory]=useState<keyof typeof cats>('all'),[query,setQuery]=useState(''),[sort,setSort]=useState<Sort>('name'),[selected,setSelected]=useState<string|null>(null),[side,setSide]=useState<'BUY'|'SELL'>('BUY'),[price,setPrice]=useState(''),[qty,setQty]=useState(''),[confirm,setConfirm]=useState(false),[canceling,setCanceling]=useState<MarketOrder|null>(null),[page,setPage]=useState(0),[feedback,setFeedback]=useState('');
 const catalog=useMemo(()=>marketCatalog(game),[game]);
 const list=useMemo(()=>catalog.filter(x=>(category==='all'||x.category===category)&&x.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>{if(sort==='name')return a.name.localeCompare(b.name,'ko');const av=getLastTrade(game,a.id)?.price??null,bv=getLastTrade(game,b.id)?.price??null;return sort==='high'?(bv??-1)-(av??-1):(av??1e15)-(bv??1e15);}),[catalog,category,query,sort,game]);
 const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=list.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE);
 const item=catalog.find(x=>x.id===selected),book=selected?orderBook(game,selected):{sells:[],buys:[]},ask=selected?getBestAsk(game,selected):null,bid=selected?getBestBid(game,selected):null,last=selected?getLastTrade(game,selected):null,trades=selected?getRecentTrades(game,selected):[],stats24=selected?marketStats(game.market.trades,selected,'24H',Date.now()):null;
 const p=/^\d+$/.test(price)?Number(price):NaN,q=/^\d+$/.test(qty)?Number(qty):NaN,valid=!!item&&Number.isSafeInteger(p)&&p>0&&Number.isSafeInteger(q)&&q>0&&(side==='BUY'?game.silver>=p*q:item.available>=q);
 const submit=()=>{if(!selected)return;let message='주문이 등록되었습니다.';setGame(s=>{const n=placeOrder(s,{itemId:selected,side,limitPrice:p,quantity:q});const o=n.market.orders.at(-1);if(o){const filled=o.originalQuantity-o.remainingQuantity;message=filled?(o.remainingQuantity?filled+'개 체결 · '+o.remainingQuantity+'개 대기':filled+'개 전량 체결'):'주문 등록 완료';}else message=n.notice;return n;});setQty('');setConfirm(false);setFeedback(message);};
 const mine=getMyOpenOrders(game),myTrades=game.market.trades.filter(t=>t.buyerId===game.market.ownerId||t.sellerId===game.market.ownerId).slice().reverse();
 if(item)return <Screen eyebrow="SILVER SCALE EXCHANGE" title={item.name} meta={<button className="tc-action secondary slim" onClick={()=>{setSelected(null);setPage(0);}}>목록</button>}>
  <div className="tc-market-detail">
   <div className="tc-market-summary"><div><small>최근 체결</small><b>{last?money(last.price):'없음'}</b></div><div><small>최고 매수</small><b>{money(bid)}</b></div><div><small>최저 매도</small><b>{money(ask)}</b></div></div>
   <div className="tc-floor-risk">{item.description} · 보유 {item.available} · 24H {stats24?.tradeCount??0}회 / {stats24?.volume??0}개</div>
   <div className="tc-bookform">
    <section className="tc-book"><h2>호가</h2>{levels(book.sells).reverse().map(x=><button className="tc-book-row sell" key={'s'+x.price} onClick={()=>{setSide('BUY');setPrice(String(x.price));}}><span>{money(x.price)}</span><b>{x.quantity}</b></button>)}{Array.from({length:Math.max(0,3-levels(book.sells).length)},(_,i)=><div className="tc-book-row sell" key={'se'+i}><span>—</span><b>—</b></div>)}<div className="tc-book-mid">{last?money(last.price):'거래 없음'}</div>{levels(book.buys,true).map(x=><button className="tc-book-row buy" key={'b'+x.price} onClick={()=>{setSide('SELL');setPrice(String(x.price));}}><span>{money(x.price)}</span><b>{x.quantity}</b></button>)}{Array.from({length:Math.max(0,3-levels(book.buys,true).length)},(_,i)=><div className="tc-book-row buy" key={'be'+i}><span>—</span><b>—</b></div>)}</section>
    <section className="tc-orderform"><Segments items={[['BUY','매수'],['SELL','매도']] as const} value={side} onChange={setSide} label="주문 방향"/><label>가격<input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))}/></label><label>수량<input inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value.replace(/\D/g,''))}/></label><div className="tc-order-actions"><button disabled={side==='BUY'?ask===null:bid===null} onClick={()=>setPrice(String(side==='BUY'?ask:bid))}>현재 호가</button><button onClick={()=>setQty(String(side==='BUY'&&p>0?Math.floor(game.silver/p):item.available))}>최대</button></div><div className="tc-order-total"><span>주문 총액</span><b>{Number.isFinite(p*q)?money(p*q):'—'}</b></div><button className="tc-action" disabled={!valid} onClick={()=>setConfirm(true)}>{side==='BUY'?'매수 주문':'매도 주문'}</button></section>
   </div>
   <div className="tc-floor-risk">최근 거래: {trades.slice(0,3).map(t=>money(t.price)+' ×'+t.quantity+' '+time(t.executedAt)).join(' · ')||'없음'}</div>
  </div>
  {confirm&&<div className="tc-modalback"><section className="tc-modal"><h2>{side==='BUY'?'매수':'매도'} 주문 확인</h2><p>{item.name}<br/>개당 {money(p)} · {q}개 · 총 {money(p*q)}</p><div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>setConfirm(false)}>취소</button><button className="tc-action" onClick={submit}>주문 등록</button></div></section></div>}
  {feedback&&<div className="notice">{feedback}</div>}
 </Screen>;
 const source=tab==='orders'?mine:myTrades,pcount=Math.max(1,Math.ceil(source.length/PAGE_SIZE)),psafe=Math.min(page,pcount-1),slice=source.slice(psafe*PAGE_SIZE,psafe*PAGE_SIZE+PAGE_SIZE);
 return <Screen eyebrow="SILVER SCALE EXCHANGE" title="은저울 거래소" meta={<span>{game.silver.toLocaleString()} S</span>}>
  <div className="tc-market">
   <Segments items={tabItems} value={tab} onChange={v=>{setTab(v);setPage(0);}} label="거래소 메뉴"/>
   {tab==='browse'?<><div className="tc-market-tools"><input placeholder="상품 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select value={category} onChange={e=>{setCategory(e.target.value as keyof typeof cats);setPage(0);}}>{Object.entries(cats).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div><div className="tc-segments">{(['name','high','low'] as Sort[]).map(v=><button key={v} aria-selected={sort===v} onClick={()=>setSort(v)}>{v==='name'?'이름':v==='high'?'가격 높은순':'가격 낮은순'}</button>)}</div><div className="tc-market-list">{shown.map(x=><button className="tc-market-row" key={x.id} onClick={()=>setSelected(x.id)}><div><b>{x.name}</b><small>보유 {x.available}</small></div><span className="bid"><small>매수</small>{money(getBestBid(game,x.id))}</span><span className="ask"><small>매도</small>{money(getBestAsk(game,x.id))}</span></button>)}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-market-row" key={'m'+i}/>)}</div><Pager page={safe} count={pages} onChange={setPage}/></>:<><div className="tc-floor-risk">{tab==='orders'?'대기·부분 체결 주문은 언제든 취소할 수 있습니다.':'내 계정이 참여한 최근 체결 기록입니다.'}</div><div className="tc-orders">{slice.map((x:any)=>tab==='orders'?<article className="tc-order-row" key={x.orderId}><div><b>{marketItemName(game,x.itemId)}</b><small>{x.side==='BUY'?'매수':'매도'} · {money(x.limitPrice)} · 잔량 {x.remainingQuantity}</small></div><button onClick={()=>setCanceling(x)}>취소</button></article>:<article className="tc-order-row" key={x.tradeId}><div><b>{marketItemName(game,x.itemId)}</b><small>{x.buyerId===game.market.ownerId?'매수':'매도'} · {money(x.price)} × {x.quantity}</small></div><small>{time(x.executedAt)}</small></article>)}{Array.from({length:Math.max(0,PAGE_SIZE-slice.length)},(_,i)=><div className="tc-order-row" key={'o'+i}/>)}</div><Pager page={psafe} count={pcount} onChange={setPage}/></>}
  </div>
  {canceling&&<div className="tc-modalback"><section className="tc-modal"><h2>주문 취소</h2><p>남은 {canceling.remainingQuantity}개 주문을 취소하고 예치 자산을 반환합니다.</p><div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>setCanceling(null)}>유지</button><button className="tc-action danger" onClick={()=>{setGame(s=>cancelOrder(s,canceling.orderId));setCanceling(null);setFeedback('주문을 취소했습니다.');}}>주문 취소</button></div></section></div>}
  {feedback&&<div className="notice">{feedback}</div>}
 </Screen>;
}
