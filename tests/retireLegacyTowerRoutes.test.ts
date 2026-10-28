import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('obsolete tower expedition selection and floor preparation are not in active routes',()=>{
 const main=read('src/main.tsx');
 const core=read('src/components/mobile/CoreScreens.tsx');
 assert.doesNotMatch(main,/page==='towers'|page==='floor'|<TowersScreen|<FloorScreen/);
 assert.doesNotMatch(core,/export function TowersScreen|export function FloorScreen/);
 assert.match(main,/page==='hunt'&&<HuntingPage/);
 assert.match(core,/onMove\(game\.expedition\?'battle':'hunt'\)/);
});
