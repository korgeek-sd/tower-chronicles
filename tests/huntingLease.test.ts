import test from 'node:test';import assert from 'node:assert/strict';
import {isHuntingLeaseCurrent} from '../src/online/huntingLease';
test('late hunting response is rejected after lease takeover even on same account',async()=>{
 const origin={leaseId:'old',generation:1,clientInstanceId:'tab'};let active={...origin};let applied=false;
 let release!:()=>void;const response=new Promise<void>(r=>{release=r;}).then(()=>{if(isHuntingLeaseCurrent(origin,active))applied=true;});
 active={...origin,leaseId:'new',generation:2};release();await response;assert.equal(applied,false);
 assert.equal(isHuntingLeaseCurrent(origin,{...origin}),true);assert.equal(isHuntingLeaseCurrent(origin,null),false);
});
