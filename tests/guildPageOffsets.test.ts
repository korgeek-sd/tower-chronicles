import test from 'node:test';
import assert from 'node:assert/strict';
import {guildPageOffsets} from '../src/components/association/guildPageOffsets';

test('short panels fit on one page',()=>{
 assert.deepEqual(guildPageOffsets(219,220,[]),[0]);
});
test('a control crossing the page boundary starts fully visible on the following page',()=>{
 assert.deepEqual(guildPageOffsets(590,240,[{top:211,bottom:255}]),[0,211,451]);
});
test('long content keeps continuous coverage and the final page reaches the last pixel',()=>{
 const pages=guildPageOffsets(2031,185,[]);
 assert.equal(pages.at(-1),1850);
 assert.ok(pages.every((start,i)=>!i||start>pages[i-1]&&start-pages[i-1]<=185));
});
