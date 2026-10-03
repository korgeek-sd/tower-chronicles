import test from 'node:test';
import assert from 'node:assert/strict';
import {chatEntryStorageKey,readChatEntryPlacement,resolveChatEntryPlacement,saveChatEntryPlacement,type ChatEntryStorage} from '../src/components/chatEntryPlacement.ts';
const memory=()=>{const values=new Map<string,string>();const storage:ChatEntryStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>void values.set(key,value)};return {values,storage};};
test('drag release snaps to nearest edge and clamps vertical position',()=>{
 assert.deepEqual(resolveChatEntryPlacement(20,400,500,800),{side:'left',y:.5});
 assert.deepEqual(resolveChatEntryPlacement(480,-30,500,800),{side:'right',y:.06});
 assert.deepEqual(resolveChatEntryPlacement(480,900,500,800),{side:'right',y:.94});
});
test('normal and immersive chat positions persist independently',()=>{
 const {storage}=memory();saveChatEntryPlacement('normal',{side:'left',y:.4},storage);saveChatEntryPlacement('immersive',{side:'right',y:.7},storage);
 assert.deepEqual(readChatEntryPlacement('normal',storage),{side:'left',y:.4});
 assert.deepEqual(readChatEntryPlacement('immersive',storage),{side:'right',y:.7});
 assert.notEqual(chatEntryStorageKey('normal'),chatEntryStorageKey('immersive'));
});
test('invalid stored chat placement is ignored',()=>{
 const {storage}=memory();storage.setItem(chatEntryStorageKey('normal'),'{"side":"middle","y":"bad"}');
 assert.equal(readChatEntryPlacement('normal',storage),null);
});
