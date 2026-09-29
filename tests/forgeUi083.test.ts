import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const screen=read('src/components/enhancement/EnhancementScreen.tsx');
const inventory=read('src/components/inventory/InventoryScreen.tsx');
const main=read('src/main.tsx');
const market=read('src/components/market/MarketScreen.tsx');
const server=read('src/components/market/ServerMarketScreen.tsx');
const css=read('src/mobile-game.css');

test('FORGE UI 0.1.83 01: selected equipment is the focus of an in-world forge workbench',()=>{
 for(const token of ['NOVAR FORGE / ENHANCEMENT','tc-forge-workbench','tc-forge-sigil','tc-forge-level','tc-forge-stats'])assert.match(screen,new RegExp(token));
 assert.match(screen,/equipmentEnhancementPreviewRows/);
 assert.match(screen,/강화 단계/);
});

test('FORGE UI 0.1.83 02: risks and costs are decision-first before the enhancement CTA',()=>{
 for(const token of ['tc-forge-risk','성공','유지','하락','파괴','tc-forge-costs','Silver','강화석','강화 실행'])assert.ok(screen.includes(token),token);
 assert.match(screen,/failDestroyRate/);
 assert.match(screen,/view\.canAttempt/);
});

test('FORGE UI 0.1.83 03: inventory opens exact equipment and market can return to enhancement',()=>{
 assert.match(inventory,/onEnhancement\(sandboxGame\?undefined:item\.sourceId,sandboxGame\?undefined:item\.key\)/);
 assert.match(main,/enhancementInitialId/);
 assert.match(screen,/initialSelectedId/);
 assert.match(screen,/enhancementItemId:selected\.id/);
 assert.match(market,/returnEnhancementId/);
 assert.match(server,/returnEnhancementId/);
 assert.match(server,/‹ 강화/);
});

test('FORGE UI 0.1.83 04: mobile forge remains contained and touch-safe',()=>{
 const section=css.slice(css.indexOf('/* v0.1.83 — NOVAR FORGE'));
 assert.match(section,/@media\(max-width:380px\)/);
 assert.match(section,/\.tc-forge-actions button\{min-height:44px\}/);
 assert.match(section,/@media\(max-width:340px\)/);
 assert.match(section,/@media\(max-height:700px\)/);
 assert.equal(/url\s*\(/i.test(section),false);
});
