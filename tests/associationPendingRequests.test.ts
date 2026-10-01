import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingGrowthRequest,completeGrowthRequest} from '../src/online/associationPendingRequests';

test('uncertain requests reuse their identity across panel remounts, and success permits a new purchase',()=>{
 const values=new Map<string,string>();
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 const first=pendingGrowthRequest('lease:BUY:stone',storage);
 assert.equal(pendingGrowthRequest('lease:BUY:stone',storage),first);
 assert.notEqual(pendingGrowthRequest('lease:BUY:potion',storage),first);
 completeGrowthRequest('lease:BUY:stone',storage);
 assert.notEqual(pendingGrowthRequest('lease:BUY:stone',storage),first);
});
