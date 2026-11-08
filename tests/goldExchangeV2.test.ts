import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildGoldCandles} from '../src/components/market/GoldExchangePriceChart';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const at=Date.UTC(2026,10,8,0,0,0);
const entries=[
 {tradeId:'a',executedAt:at+60_000,priceSilverPerGold:100,goldQuantity:3},
 {tradeId:'b',executedAt:at+120_000,priceSilverPerGold:105,goldQuantity:7},
 {tradeId:'c',executedAt:at+300_000,priceSilverPerGold:101,goldQuantity:2},
 {tradeId:'d',executedAt:at+950_000,priceSilverPerGold:102,goldQuantity:5},
];

test('GOLD EXCHANGE V2: price chart uses real trade OHLC and volume for 15m bars',()=>{
 // Only fields needed by the candle aggregator. No fabricated market data.
 const view=buildGoldCandles(entries as never,'15m',at+3_600_000);
 assert.equal(view.bars.length,2);
 assert.deepEqual(
  view.bars.map(c=>({open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume,trades:c.trades})),
  [
   {open:100,high:105,low:100,close:101,volume:12,trades:3},
   {open:102,high:102,low:102,close:102,volume:5,trades:1},
  ],
 );
 assert.equal(view.totalVolume,17);
 assert.ok(view.bars[0].startAt<view.bars[1].startAt);
});

test('GOLD EXCHANGE V2: chart does not invent candles without trades',()=>{
 const view=buildGoldCandles(entries.slice(0,1) as never,'15m',at+3_600_000);
 assert.equal(view.bars.length,1);
 assert.equal(buildGoldCandles([],'4h',at+3_600_000).bars.length,0);
 assert.equal(buildGoldCandles(entries as never,'1h',at+365*86_400_000).bars.length,0);
 assert.equal(buildGoldCandles(entries as never,'all',at+2*3_600_000).totalVolume,17);
});

test('GOLD EXCHANGE V2: chart button and professional order desk preserve spot server actions',()=>{
 const screen=read('../src/components/market/GoldExchangeScreen.tsx');
 const chart=read('../src/components/market/GoldExchangePriceChart.tsx');
 const css=read('../src/components/market/gold-exchange-v2.css');
 assert.match(screen,/tc-goldx tc-goldx-v2 tab-/);
 assert.match(screen,/골드 시세 캔들 차트 열기/);
 assert.match(screen,/setChartOpen\(true\)/);
 assert.match(screen,/GoldExchangePriceChart trades=\{trades\}/);
 assert.match(screen,/tc-goldx-v2-desk/);
 assert.match(screen,/tc-goldx-v2-orderbook/);
 assert.match(screen,/tc-goldx-v2-order/);
 assert.match(screen,/chooseLevel\('BUY_GOLD',level\)/);
 assert.match(screen,/chooseLevel\('SELL_GOLD',level\)/);
 assert.match(screen,/placeOnlineGoldExchangeOrder/);
 assert.match(screen,/cancelOnlineGoldExchangeOrder/);
 assert.match(screen,/Gold 매수/);
 assert.match(screen,/Gold 매도/);
 assert.doesNotMatch(screen,/손절가|익절가|이익만\s?체결|TP\/SL|Reduce Only/);
 assert.match(chart,/buildGoldCandles\(trades,range\)/);
 assert.match(chart,/role="dialog"/);
 assert.match(chart,/aria-modal="true"/);
 for(const key of ["'15m'","'1h'","'4h'","'1d'","'all'"])assert.ok(chart.includes(key));
 assert.match(chart,/서버의 최근 체결 최대 200건/);
 assert.match(css,/\.tc-goldx-chart-overlay/);
 assert.match(css,/\.tc-goldx-v2-desk/);
 assert.match(css,/grid-template-columns:minmax\(0,1\.05fr\) minmax\(0,\.95fr\)/);
});
