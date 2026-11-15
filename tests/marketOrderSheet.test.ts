import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('both markets keep chart detail mounted while a modal order ticket is open',()=>{
 for(const file of ['MarketScreen','ServerMarketScreen']){
  const source=readFileSync(new URL('../src/components/market/'+file+'.tsx',import.meta.url),'utf8');
  assert.match(source,/let orderSheet:React.ReactNode=null/);
  assert.match(source,/orderSheet=<MarketOrderSheet/);
  assert.match(source,/\{orderSheet\}/);
  assert.match(source,/<MarketPriceChart/);
  assert.match(source,/onClick=\{\(\)=>setPrice\(String\(x.price\)\)\}/);
 }
});

import {priceChartGeometry} from '../src/components/market/MarketPriceChart';
test('chart handles absent and flat prices without invalid coordinates',()=>{
 assert.equal(priceChartGeometry([]),null);
 const flat=priceChartGeometry([{price:170},{price:170}])!;
 assert.ok(flat.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 assert.equal(flat.points[0].y,flat.points[1].y);
});
test('chart positions irregular trade intervals using execution time',()=>{
 const chart=priceChartGeometry([{price:170,executedAt:1000},{price:174,executedAt:2000},{price:172,executedAt:11000}])!;
 assert.equal(chart.points[1].x,10);
 assert.equal(chart.low,170);
 assert.equal(chart.high,174);
});
