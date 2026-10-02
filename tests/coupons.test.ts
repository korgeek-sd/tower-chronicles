import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCouponWindow} from '../src/online/coupons';
const coupon={code:'TEST',name:'Test',reward:{silver:10},startsAt:'2026-10-01T00:00:00Z',expiresAt:'2026-10-02T00:00:00Z'};
test('coupon expires exactly at its deadline',()=>{
 assert.equal(validateCouponWindow(coupon,new Date(coupon.expiresAt)).ok,false);
});
test('invalid dates never make a coupon redeemable',()=>{
 assert.equal(validateCouponWindow({...coupon,expiresAt:'bad'},new Date(coupon.startsAt)).ok,false);
});
test('coupon is valid from its start until just before expiry',()=>{
 assert.equal(validateCouponWindow(coupon,new Date(coupon.startsAt)).ok,true);
 assert.equal(validateCouponWindow(coupon,new Date('2026-10-01T23:59:59.999Z')).ok,true);
 assert.equal(validateCouponWindow(coupon,new Date('2026-09-30T23:59:59Z')).ok,false);
});

