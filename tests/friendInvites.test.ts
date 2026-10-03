import test from 'node:test';
import assert from 'node:assert/strict';
import {createFriendInviteApi,parseInviteState} from '../src/online/friendInvites';
const state={code:'TC-ABCDEF123456',rewardedInvites:0,rewardLimit:100,appliedCode:null,appliedAt:null};
const config={url:'https://example.supabase.co',publishableKey:'public-test-key'};
test('invite API uses current authentication and sends only normalized code',async()=>{
 const requests:{url:string;init:RequestInit|undefined}[]=[];
 const api=createFriendInviteApi(config,async()=>({userId:'player',accessToken:'fresh-token'}),async(url,init)=>{requests.push({url:String(url),init});return new Response(JSON.stringify(requests.length===1?state:{...state,appliedCode:'TC-123456ABCDEF',appliedAt:'2026-10-03T00:00:00Z',duplicate:false}));});
 assert.deepEqual(await api.load('player'),state);assert.equal((await api.apply('player',' tc-123456abcdef ')).duplicate,false);
 assert.equal(requests[1].url,config.url+'/rest/v1/rpc/apply_friend_invite_code');assert.deepEqual(JSON.parse(String(requests[1].init?.body)),{p_code:'TC-123456ABCDEF'});
 assert.equal((requests[1].init?.headers as Record<string,string>).Authorization,'Bearer fresh-token');
});
test('invite API rejects switched account before issuing requests',async()=>{
 let called=false;const api=createFriendInviteApi(config,async()=>({userId:'other',accessToken:'token'}),async()=>{called=true;return new Response('{}');});await assert.rejects(()=>api.apply('player',state.code),/계정이 변경/);assert.equal(called,false);
});
test('invite API explains server rejection and rejects malformed results',async()=>{
 const api=createFriendInviteApi(config,async()=>({userId:'player',accessToken:'token'}),async()=>new Response('{"message":"INVITE_SELF_FORBIDDEN"}',{status:400}));await assert.rejects(()=>api.apply('player',state.code),/자신의 초대 코드/);
 for(const invalid of [null,{}, {...state,rewardedInvites:101},{...state,rewardedInvites:-1},{...state,rewardLimit:101},{...state,appliedCode:'TC-123456ABCDEF'},{...state,appliedAt:'invalid'}])assert.throws(()=>parseInviteState(invalid));
 const incomplete=createFriendInviteApi(config,async()=>({userId:'player',accessToken:'token'}),async()=>new Response(JSON.stringify(state)));await assert.rejects(()=>incomplete.apply('player',state.code),/적용 결과/);
});
