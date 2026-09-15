import test from 'node:test';import assert from 'node:assert/strict';
import {marketChart,marketStats,tradesInRange} from '../src/game/market/marketStatistics.ts';import type {MarketTrade} from '../src/game/types.ts';
const now=1_000_000_000,trade=(price:number,quantity:number,executedAt:number,sequence:number):MarketTrade=>({tradeId:'t'+sequence,itemId:'material:ore:1',price,quantity,buyOrderId:'b',sellOrderId:'s',buyerId:'a',sellerId:'b',executedAt,sequence});
test('통계 TC-01 기간 필터는 시작 경계를 포함한다',()=>{const ts=[trade(90,1,now-5_400_000,1),trade(100,1,now-3_600_000,2),trade(110,1,now-1,3)];assert.deepEqual(tradesInRange(ts,'material:ore:1','1H',now).map(t=>t.price),[100,110]);});
test('통계 TC-02~05 고저·수량 가중 평균·거래량·변동을 계산한다',()=>{const ts=[trade(90,1,now-3,1),trade(100,9,now-2,2),trade(95,2,now-1,3)],s=marketStats(ts,'material:ore:1','1H',now);assert.equal(s.highPrice,100);assert.equal(s.lowPrice,90);assert.equal(s.averagePrice,(90+900+190)/12);assert.equal(s.volume,12);assert.equal(s.tradeCount,3);assert.equal(s.priceChange,5);});
test('통계 TC-06 단일 체결은 변동 비교 데이터를 만들지 않는다',()=>{const s=marketStats([trade(100,2,now-1,1)],'material:ore:1','1H',now);assert.equal(s.priceChange,null);assert.equal(s.priceChangePercent,null);});
test('통계 TC-07 차트 버킷은 마지막 가격과 실제 거래량만 사용한다',()=>{const ts=[trade(90,2,now-3_000_000,1),trade(95,3,now-2_900_000,2)],chart=marketChart(ts,'material:ore:1','1H',now);assert.equal(chart.length,1);assert.deepEqual([chart[0].price,chart[0].volume],[95,5]);});

