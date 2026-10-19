import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('unconfirmed orders have an explicit recovery control and block new submissions',()=>{
 const source=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 assert.ok(source.includes('미확정 주문 다시 확인'));assert.ok(source.includes('retryOnlineMarketOrder(lease)'));
 assert.ok(source.includes('!pendingOrder'));assert.ok(source.includes('if(pendingOrder)return <Screen'));assert.ok(source.includes('title="주문 결과 확인"'));assert.ok(source.includes('minHeight:44'));
});
