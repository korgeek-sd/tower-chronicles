import test from 'node:test';
import assert from 'node:assert/strict';
import {mailBody} from '../src/online/mail';
test('coupon mail explains every currency and item in the reward bundle',()=>{
 const body=mailBody({title:'쿠폰 보상',category:'reward',body:'테스트 선물',details:{} as any,attachment:{itemId:'coupon_reward',quantity:1,gear:null,reward:{silver:1000,gold:5,items:[{id:'other:job_draw_ticket',quantity:2}]}}} as any);
 assert.match(body,/1,000 실버/);assert.match(body,/5 골드/);assert.match(body,/직능 등록권 × 2/);
});
test('partial sell expiry shows only five returned without paying twice',()=>{
 const body=mailBody({title:'판매 주문 만료',category:'trade',body:'',details:{itemName:'검',original:10,filled:5,remaining:5,total:5000,fee:0,refund:0},attachment:{itemId:'other:test',quantity:5,gear:null}});
 assert.match(body,/주문 수량: 10개/);assert.match(body,/판매된 수량: 5개/);assert.match(body,/반환 수량: 5개/);assert.match(body,/받기/);assert.doesNotMatch(body,/보유 실버에 반영/);
});
test('buy cancellation describes reserve refund and retained fills',()=>{
 const body=mailBody({title:'구매 주문 취소',category:'trade',body:'',details:{itemName:'검',original:10,filled:5,remaining:5,total:5000,fee:0,refund:5000},attachment:null});
 assert.match(body,/반환 금액: 5,000 실버/);assert.match(body,/이미 구매된 아이템은 유지/);
});

