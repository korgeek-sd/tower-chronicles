import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {initialState,stats} from '../src/game/engine/state';
import {startExpedition} from '../src/game/engine/expedition';
import {homeSummary} from '../src/components/home/homePresentation';
import {inventoryPageSize,inventoryIconPath,equipmentPreview,descriptionPages} from '../src/components/inventory/inventoryPresentation';

test('home distinguishes discovered floors from returned floors without inventing current hp',()=>{
 const game=initialState();game.progress.ore=8;game.exploration.highestReturned.ore=3;
 const before=structuredClone(game),result=homeSummary(game);
 assert.equal(result.currentHp,null);assert.equal(result.highestReturned,3);
 assert.equal(result.primaryPage,'towers');assert.deepEqual(game,before);
});
test('home resumes an active expedition using its health and equipment snapshot',()=>{
 const game=startExpedition(initialState(),'ore');assert.ok(game.expedition);
 game.expedition.hp=17;
 const result=homeSummary(game);
 assert.equal(result.primaryPage,'battle');assert.equal(result.currentHp,17);
 assert.equal(result.maxHp,stats(game,game.expedition.equipment).hp);
});
test('inventory fits actual available area instead of scaling touch targets',()=>{
 assert.equal(inventoryPageSize(210,282),12);assert.equal(inventoryPageSize(285,282),16);
 assert.equal(inventoryPageSize(355,282),20);assert.equal(inventoryPageSize(100,282),4);
});
test('icons return only tracked assets and unknown categories have no broken image URL',()=>{
 for(const id of ['sword','bow','staff','dagger'])for(let tier=1;tier<=5;tier++){
  const path=inventoryIconPath(id,tier);assert.ok(path);
  assert.ok(existsSync(new URL('../public/'+path!.replace('./',''),import.meta.url)));
 }
 assert.equal(inventoryIconPath('armor'),null);assert.equal(inventoryIconPath('sword',8),null);
 assert.equal(inventoryIconPath('search'),null);
});
test('equipment preview is read-only and reports mastery and expedition locks',()=>{
 const game=initialState();game.items.push({id:'candidate',kind:'sword',tier:2,enhancement:0});
 const before=structuredClone(game),preview=equipmentPreview(game,'candidate');
 assert.ok(preview);assert.ok(preview.attack>0);assert.equal(preview.reason,'장비 숙련이 부족합니다.');
 assert.deepEqual(game,before);
 const active=startExpedition(game,'ore');
 assert.equal(equipmentPreview(active,'candidate')?.reason,'원정 중 변경 불가');
});
test('long descriptions paginate without losing any characters',()=>{
 const text='아주 긴 아이템 설명입니다. '.repeat(40);
 const pages=descriptionPages(text,90);
 assert.ok(pages.length>1);assert.equal(pages.join(''),text);
 assert.ok(pages.every(p=>Array.from(p).length<=90));
});
