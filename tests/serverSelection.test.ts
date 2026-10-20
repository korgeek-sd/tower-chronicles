import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GAME_SERVERS,SERVER_PREFERENCE_KEY,loadPreferredServer,savePreferredServer,resolveServer,canEnterGame} from '../src/components/intro/serverSelection';
test('only the current deployment server can be selected; unknown IDs cannot create another world',()=>{
 assert.deepEqual(GAME_SERVERS.map(s=>s.id),['main']);
 assert.equal(resolveServer('unreleased-server').id,'main');
 assert.equal(resolveServer(null).id,'main');
});
test('server preference is separate from saved game and tolerates unavailable storage',()=>{
 const map=new Map([['game-save','untouched']]);
 const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};
 assert.equal(loadPreferredServer(storage).id,'main');
 savePreferredServer('main',storage);
 assert.equal(map.get(SERVER_PREFERENCE_KEY),'main');
 assert.equal(map.get('game-save'),'untouched');
 map.set(SERVER_PREFERENCE_KEY,'retired');
 assert.equal(loadPreferredServer(storage).id,'main');
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(loadPreferredServer(blocked).id,'main');
 assert.doesNotThrow(()=>savePreferredServer('main',blocked));
});
test('remembered login still requires explicit entry on a fresh launch',()=>{
 assert.equal(canEnterGame(true,false),false);
 assert.equal(canEnterGame(false,true),false);
 assert.equal(canEnterGame(true,true),true);
});
