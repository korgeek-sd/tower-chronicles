import test from 'node:test';
import assert from 'node:assert/strict';
import {mailBody} from '../src/online/mail';
test('partial sell expiry shows only five returned without paying twice',()=>{
 const body=mailBody({title:'판매 주문 만료',category:'trade',body:'',details:{itemName:'검',original:10,filled:5,remaining:5,total:5000,fee:0,refund:0},attachment:{itemId:'other:test',quantity:5,gear:null}});
 assert.match(body,/주문 수량: 10개/);assert.match(body,/판매된 수량: 5개/);assert.match(body,/반환 수량: 5개/);assert.match(body,/받기/);assert.doesNotMatch(body,/보유 실버에 반영/);
});
test('buy cancellation describes reserve refund and retained fills',()=>{
 const body=mailBody({title:'구매 주문 취소',category:'trade',body:'',details:{itemName:'검',original:10,filled:5,remaining:5,total:5000,fee:0,refund:5000},attachment:null});
 assert.match(body,/반환 금액: 5,000 실버/);assert.match(body,/이미 구매된 아이템은 유지/);
});
