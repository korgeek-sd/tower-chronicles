import {mergeServerRecordState} from '../src/online/serverRecordState';
import {initialState} from '../src/game/engine/state';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
test('운영 진입점은 테스트 지급과 로컬 은행 정산을 실행하지 않는다',()=>{
 assert.doesNotMatch(main,/ensureTestSilverGrant|ensureTestBankExists|processBankTick|setBankState/);
 assert.doesNotMatch(main,/from ['"].*bank\/(?:service|testGrant)['"]/);
 assert.match(main,/<BankScreen\s*\/>/);
});
test('서버 잔액 감소와 프리미엄 만료를 그대로 적용한다',()=>{
 const local=initialState();local.silver=10000000;local.market.gold=1000;local.goldenRecorder={expiresAt:Date.now()+86400000};
 const server=initialState();server.silver=12;server.market.gold=0;server.goldenRecorder={expiresAt:0};
 const result=mergeServerRecordState(server);
 assert.equal(result.silver,12);
 assert.equal(result.market.gold,0);
 assert.equal(result.goldenRecorder.expiresAt,0);
 assert.deepEqual(result,server);
 assert.equal(local.silver,10000000);
});
