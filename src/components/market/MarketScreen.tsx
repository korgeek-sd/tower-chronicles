import React,{useEffect,useMemo,useState} from 'react';
import type {GameState,MarketOrder} from '../../game/types';
import {
  cancelOrder,
  marketCatalog,
  marketItemName,
  orderBook,
  placeOrder,
  getBestAsk,
  getBestBid,
  getLastTrade,
  getMyOpenOrders,
  aggregateOrderBookByPrice,
} from '../../game/market/marketService';
import {BottomSheet} from '../mobile/BottomSheet';
import {PageStepper} from '../mobile/PageStepper';
import {ScreenHeader} from '../mobile/ScreenHeader';
import {SegmentTabs} from '../mobile/SegmentTabs';
import {clampPageIndex,pageSizeFor,pageSlice} from '../mobile/mobilePagination';
import {useViewportHeight} from '../mobile/useViewportHeight';
import {MarketStatistics} from './MarketStatistics';
import './market.css';

export type MarketView='browse'|'product'|'statistics'|'orders'|'trades';
type Sort='default'|'name'|'high'|'low';
type Category='all'|'equipment'|'materials'|'skillbooks'|'tickets'|'other';

const cats:Record<Category,string>={
  all:'전체',equipment:'장비',materials:'재료',skillbooks:'스킬북',tickets:'입장권',other:'기타',
};
const MAIN_TABS=[
  {value:'browse',label:'상품'},
  {value:'orders',label:'내 주문'},
  {value:'trades',label:'내 거래'},
] as const;
const status:Record<MarketOrder['status'],string>={
  OPEN:'대기 중',PARTIAL:'일부 체결',FILLED:'체결 완료',CANCELLED:'취소',
};
const money=(n:number|null)=>n===null?'—':n.toLocaleString()+' S';
const time=(n:number)=>new Date(n).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
const levels=(orders:MarketOrder[],desc=false,limit=3)=>aggregateOrderBookByPrice(orders)
  .sort((a,b)=>desc?b.price-a.price:a.price-b.price)
  .slice(0,limit);

export function MarketScreen({game,setGame}:{
  game:GameState;
  setGame:React.Dispatch<React.SetStateAction<GameState>>;
}){
  const [view,setView]=useState<MarketView>('browse');
  const [category,setCategory]=useState<Category>('all');
  const [query,setQuery]=useState('');
  const [sort,setSort]=useState<Sort>('default');
  const [selected,setSelected]=useState<string|null>(null);
  const [side,setSide]=useState<'BUY'|'SELL'>('BUY');
  const [price,setPrice]=useState('');
  const [qty,setQty]=useState('');
  const [confirm,setConfirm]=useState(false);
  const [canceling,setCanceling]=useState<MarketOrder|null>(null);
  const [orderFilter,setOrderFilter]=useState<'all'|'BUY'|'SELL'>('all');
  const [feedback,setFeedback]=useState('');
  const [showFilters,setShowFilters]=useState(false);
  const [tierFilter,setTierFilter]=useState<number|null>(null);
  const [towerFilter,setTowerFilter]=useState<string|null>(null);
  const [gearFilter,setGearFilter]=useState<string|null>(null);
  const [page,setPage]=useState(0);
  const [orderPage,setOrderPage]=useState(0);
  const [tradePage,setTradePage]=useState(0);
  const height=useViewportHeight();
  const pageSize=pageSizeFor('market',height);

  const catalog=useMemo(()=>marketCatalog(game),[game]);
  const list=useMemo(()=>catalog.filter(x=>{
    const parts=x.id.split(':');
    const itemTier=x.gear?.tier??(parts.length>2?Number(parts[2]):null);
    const itemTower=parts[1];
    const itemGear=x.gear?.kind??null;
    return (category==='all'||x.category===category)
      &&x.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      &&(tierFilter===null||itemTier===tierFilter)
      &&(towerFilter===null||itemTower===towerFilter)
      &&(gearFilter===null||itemGear===gearFilter);
  }).sort((a,b)=>{
    if(sort==='name')return a.name.localeCompare(b.name,'ko');
    const av=getLastTrade(game,a.id)?.price??null;
    const bv=getLastTrade(game,b.id)?.price??null;
    if(sort==='high')return (bv??-1)-(av??-1);
    if(sort==='low')return (av??Number.MAX_SAFE_INTEGER)-(bv??Number.MAX_SAFE_INTEGER);
    return a.name.localeCompare(b.name,'ko');
  }),[catalog,category,query,sort,game,tierFilter,towerFilter,gearFilter]);

  useEffect(()=>{setPage(0);},[category,query,sort,tierFilter,towerFilter,gearFilter]);

  const pageCount=Math.max(1,Math.ceil(list.length/pageSize));
  const safePage=clampPageIndex(page,list.length,pageSize);
  const visibleList=pageSlice(list,safePage,pageSize);

  const mine=getMyOpenOrders(game).filter(order=>orderFilter==='all'||order.side===orderFilter);
  const orderPageCount=Math.max(1,Math.ceil(mine.length/pageSize));
  const safeOrderPage=clampPageIndex(orderPage,mine.length,pageSize);
  const visibleOrders=pageSlice(mine,safeOrderPage,pageSize);

  const myTrades=game.market.trades
    .filter(t=>t.buyerId===game.market.ownerId||t.sellerId===game.market.ownerId)
    .slice()
    .reverse();
  const tradePageCount=Math.max(1,Math.ceil(myTrades.length/pageSize));
  const safeTradePage=clampPageIndex(tradePage,myTrades.length,pageSize);
  const visibleTrades=pageSlice(myTrades,safeTradePage,pageSize);

  useEffect(()=>{setOrderPage(0);},[orderFilter]);

  const item=selected?catalog.find(x=>x.id===selected)??null:null;
  const book=selected?orderBook(game,selected):{sells:[],buys:[]};
  const ask=selected?getBestAsk(game,selected):null;
  const bid=selected?getBestBid(game,selected):null;
  const last=selected?getLastTrade(game,selected):null;

  const numericPrice=/^\d+$/.test(price)?Number(price):NaN;
  const numericQty=/^\d+$/.test(qty)?Number(qty):NaN;
  const valid=!!item
    &&Number.isSafeInteger(numericPrice)&&numericPrice>0
    &&Number.isSafeInteger(numericQty)&&numericQty>0
    &&(side==='BUY'?game.silver>=numericPrice*numericQty:item.available>=numericQty)
    &&!game.expedition;

  const changeMainView=(next:'browse'|'orders'|'trades')=>{
    setSelected(null);
    setFeedback('');
    setView(next);
  };

  const openProduct=(id:string)=>{
    setSelected(id);
    setView('product');
    setPrice('');
    setQty('');
    setFeedback('');
  };

  const closeProduct=()=>{
    setSelected(null);
    setView('browse');
    setConfirm(false);
  };

  const submit=()=>{
    if(!selected)return;
    let message='주문이 등록되었습니다.';
    setGame(state=>{
      const next=placeOrder(state,{
        itemId:selected,
        side,
        limitPrice:numericPrice,
        quantity:numericQty,
      });
      const order=next.market.orders.at(-1);
      if(order){
        const filled=order.originalQuantity-order.remainingQuantity;
        message=filled
          ?order.remainingQuantity
            ?filled+'개 체결 · '+order.remainingQuantity+'개 대기'
            :filled+'개 전량이 체결되었습니다.'
          :'주문이 등록되었습니다.';
      }else message=next.notice;
      return next;
    });
    setQty('');
    setConfirm(false);
    setFeedback(message);
  };

  if(view==='product'&&item){
    const sells=levels(book.sells).slice().reverse();
    const buys=levels(book.buys,true);
    return <section className="market-screen market-product-screen">
      <ScreenHeader title={item.name} meta={'보유 '+item.available+' · 사용 가능 '+money(game.silver)} onBack={closeProduct}/>

      <div className="market-product-tabs">
        <button type="button" className="active" aria-pressed="true">거래</button>
        <button type="button" onClick={()=>setView('statistics')}>통계</button>
      </div>

      <section className="market-summary">
        <span><small>최근 체결</small><b>{last?money(last.price):'기록 없음'}</b></span>
        <span><small>최고 매수</small><b>{money(bid)}</b></span>
        <span><small>최저 매도</small><b>{money(ask)}</b></span>
      </section>

      {game.expedition&&<div className="market-lock-banner">원정 중에는 주문을 등록하거나 취소할 수 없습니다.</div>}

      <div className="market-product-body">
        <section className="market-book-mobile" aria-label="호가">
          <div className="market-book-side sells">
            <small>매도</small>
            {sells.length?sells.map(level=><button
              type="button"
              key={'s'+level.price}
              onClick={()=>{setSide('BUY');setPrice(String(level.price));}}
            ><span>{money(level.price)}</span><b>{level.quantity}</b></button>):<p>매도 없음</p>}
          </div>
          <div className="market-last-price">최근 {last?money(last.price):'—'}</div>
          <div className="market-book-side buys">
            <small>매수</small>
            {buys.length?buys.map(level=><button
              type="button"
              key={'b'+level.price}
              onClick={()=>{setSide('SELL');setPrice(String(level.price));}}
            ><span>{money(level.price)}</span><b>{level.quantity}</b></button>):<p>매수 없음</p>}
          </div>
        </section>

        <section className="market-order-panel">
          <div className="market-side-tabs">
            <button type="button" className={side==='BUY'?'active':''} onClick={()=>setSide('BUY')}>매수</button>
            <button type="button" className={side==='SELL'?'active':''} onClick={()=>setSide('SELL')}>매도</button>
          </div>
          <div className="market-form">
            <label><span>가격</span><input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))}/></label>
            <label><span>수량</span><input inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value.replace(/\D/g,''))}/></label>
            <button type="button" onClick={()=>setQty(String(side==='BUY'&&numericPrice>0?Math.floor(game.silver/numericPrice):item.available))}>최대</button>
          </div>
          <div className="market-order-total">
            <span>{side==='BUY'?'최대 예약':'예상 주문가'}</span>
            <b>{Number.isFinite(numericPrice*numericQty)?money(numericPrice*numericQty):'—'}</b>
          </div>
          <button type="button" className="primary market-submit" disabled={!valid} onClick={()=>setConfirm(true)}>
            {game.expedition?'원정 중 거래 불가':side==='BUY'?'매수 주문 확인':'매도 주문 확인'}
          </button>
        </section>
      </div>

      <BottomSheet open={confirm} title={side==='BUY'?'매수 주문 확인':'매도 주문 확인'} onClose={()=>setConfirm(false)}>
        <div className="market-confirm-sheet">
          <strong>{item.name}</strong>
          <span>개당 {money(numericPrice)} · {numericQty}개</span>
          <b>{money(numericPrice*numericQty)}</b>
          <button type="button" className="primary" onClick={submit}>주문 등록</button>
        </div>
      </BottomSheet>
      {feedback&&<div className="market-toast">{feedback}</div>}
    </section>;
  }

  if(view==='statistics'&&item){
    return <section className="market-screen market-statistics-screen">
      <ScreenHeader title={item.name} meta="시장 통계" onBack={()=>setView('product')}/>
      <div className="market-product-tabs">
        <button type="button" onClick={()=>setView('product')}>거래</button>
        <button type="button" className="active" aria-pressed="true">통계</button>
      </div>
      <MarketStatistics itemId={item.id} trades={game.market.trades}/>
    </section>;
  }

  return <section className="market-screen" aria-label="은저울 거래소">
    <ScreenHeader title="은저울 거래소" meta={'Silver '+game.silver.toLocaleString()+' · 은저울 상회'}/>

    <SegmentTabs
      label="거래소 화면"
      items={MAIN_TABS}
      value={view as 'browse'|'orders'|'trades'}
      onChange={changeMainView}
    />

    {view==='browse'&&<>
      <div className="market-browse-tools">
        <input
          className="market-search"
          aria-label="아이템 검색"
          placeholder="아이템명 검색"
          value={query}
          onChange={e=>setQuery(e.target.value)}
        />
        <select aria-label="상품 정렬" value={sort} onChange={e=>setSort(e.target.value as Sort)}>
          <option value="default">기본</option>
          <option value="name">이름</option>
          <option value="high">최근가 높은 순</option>
          <option value="low">최근가 낮은 순</option>
        </select>
        <button type="button" onClick={()=>setShowFilters(true)} aria-label="상품 필터">⚙</button>
      </div>

      <div className="market-category-tabs" role="tablist" aria-label="상품 종류">
        {(Object.keys(cats) as Category[]).map(id=><button
          type="button"
          role="tab"
          aria-selected={category===id}
          className={category===id?'active':''}
          key={id}
          onClick={()=>setCategory(id)}
        >{cats[id]}</button>)}
      </div>

      <div className="market-list">
        {visibleList.length?visibleList.map(entry=><button
          type="button"
          className="market-row"
          key={entry.id}
          onClick={()=>openProduct(entry.id)}
        >
          <span className="market-row-emblem" aria-hidden="true">◆</span>
          <span className="market-row-copy"><b>{entry.name}</b><small>보유 {entry.available}</small></span>
          <span className="market-row-price">
            <b>{getLastTrade(game,entry.id)?money(getLastTrade(game,entry.id)!.price):'기록 없음'}</b>
            <small>매수 {money(getBestBid(game,entry.id))} · 매도 {money(getBestAsk(game,entry.id))}</small>
          </span>
        </button>):<div className="market-empty">{query.trim()?'조건에 맞는 상품이 없습니다.':'거래 가능한 상품이 없습니다.'}</div>}
      </div>

      <PageStepper page={safePage} pageCount={pageCount} onPage={setPage}/>

      <BottomSheet open={showFilters} title="상품 필터" onClose={()=>setShowFilters(false)}>
        <div className="market-filter-sheet">
          <div><strong>등급</strong><div>{[null,1,2,3,4,5].map(value=><button
            type="button"
            key={String(value)}
            className={tierFilter===value?'active':''}
            onClick={()=>setTierFilter(value)}
          >{value===null?'전체':value+'등급'}</button>)}</div></div>
          {(category==='materials'||category==='tickets')&&<div><strong>탑</strong><div>{[null,'ore','leather','gem','kaleon'].map(value=><button
            type="button"
            key={String(value)}
            className={towerFilter===value?'active':''}
            onClick={()=>setTowerFilter(value)}
          >{value===null?'전체':value}</button>)}</div></div>}
          {category==='equipment'&&<div><strong>장비</strong><div>{[null,'sword','dagger','bow','staff','armor','boots','accessory'].map(value=><button
            type="button"
            key={String(value)}
            className={gearFilter===value?'active':''}
            onClick={()=>setGearFilter(value)}
          >{value===null?'전체':value}</button>)}</div></div>}
          <button type="button" className="secondary" onClick={()=>{setTierFilter(null);setTowerFilter(null);setGearFilter(null);}}>필터 초기화</button>
        </div>
      </BottomSheet>
    </>}

    {view==='orders'&&<>
      <div className="market-order-filter" role="tablist" aria-label="주문 종류">
        {(['all','BUY','SELL'] as const).map(value=><button
          type="button"
          role="tab"
          aria-selected={orderFilter===value}
          className={orderFilter===value?'active':''}
          key={value}
          onClick={()=>setOrderFilter(value)}
        >{value==='all'?'전체':value==='BUY'?'매수':'매도'}</button>)}
      </div>
      <div className="market-orders-list">
        {visibleOrders.length?visibleOrders.map(order=><article className="market-order-row" key={order.orderId}>
          <div><b>{marketItemName(game,order.itemId)}</b><small>{order.side==='BUY'?'매수':'매도'} · {money(order.limitPrice)} · {status[order.status]}</small></div>
          <div><small>{order.originalQuantity-order.remainingQuantity} 체결 / {order.remainingQuantity} 대기</small><button type="button" disabled={!!game.expedition} onClick={()=>setCanceling(order)}>취소</button></div>
        </article>):<div className="market-empty">현재 대기 중인 주문이 없습니다.</div>}
      </div>
      <PageStepper page={safeOrderPage} pageCount={orderPageCount} onPage={setOrderPage}/>
    </>}

    {view==='trades'&&<>
      <div className="market-trades-list">
        {visibleTrades.length?visibleTrades.map(trade=><article className="market-trade-row" key={trade.tradeId}>
          <div><b>{marketItemName(game,trade.itemId)}</b><small>{trade.buyerId===game.market.ownerId?'매수':'매도'}</small></div>
          <div><b>{money(trade.price)} × {trade.quantity}</b><small>{time(trade.executedAt)}</small></div>
        </article>):<div className="market-empty">아직 체결 기록이 없습니다.</div>}
      </div>
      <PageStepper page={safeTradePage} pageCount={tradePageCount} onPage={setTradePage}/>
    </>}

    <BottomSheet open={!!canceling} title="주문 취소" onClose={()=>setCanceling(null)}>
      {canceling&&<div className="market-confirm-sheet">
        <strong>{marketItemName(game,canceling.itemId)}</strong>
        <span>남은 주문 {canceling.remainingQuantity}개를 취소합니다.</span>
        <button type="button" className="primary" onClick={()=>{
          setGame(state=>cancelOrder(state,canceling.orderId));
          setCanceling(null);
          setFeedback('주문을 취소하고 예치 자산을 반환했습니다.');
        }}>주문 취소</button>
      </div>}
    </BottomSheet>

    {feedback&&<div className="market-toast">{feedback}</div>}
  </section>;
}
