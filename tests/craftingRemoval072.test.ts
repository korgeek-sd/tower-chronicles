import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('CRAFT REMOVAL 01: workshop and crafting runtime modules are gone',()=>{
 assert.equal(existsSync(new URL('../src/components/workshop/WorkshopScreen.tsx',import.meta.url)),false);
 assert.equal(existsSync(new URL('../src/game/engine/crafting.ts',import.meta.url)),false);
});

test('CRAFT REMOVAL 02: app routing no longer exposes craft or crafting mastery screens',()=>{
 const main=read('src/main.tsx'),core=read('src/components/mobile/CoreScreens.tsx');
 assert.doesNotMatch(main,/WorkshopScreen|settleCrafting|page==='craft'|page==='mastery'/);
 assert.doesNotMatch(core,/\|'craft'|\|'mastery'|MasteryScreen|engine\/crafting|discount\(/);
 assert.match(main,/page==='enhancement'.*onBack=\{\(\)=>setPage\('inventory'\)\}/s);
});

test('CRAFT REMOVAL 03: client runtime exposes no online crafting RPC wrappers or crafting balance constants',()=>{
 const economy=read('src/online/economy.ts'),config=read('src/game/data/config.ts');
 assert.doesNotMatch(economy,/startOnlineCraft|cancelOnlineCraft|claimOnlineCraft|start_online_craft|cancel_online_craft|claim_online_craft/);
 assert.doesNotMatch(config,/POTION_CRAFTING|export const FIELDS:|craftCost|masteryRequired|discountPerCraft|maxDiscount/);
});

test('CRAFT REMOVAL 04: server migration retires crafting RPCs and clears outstanding jobs',()=>{
 const path='supabase/migrations/20260929072000_remove_crafting_v0172.sql';
 assert.equal(existsSync(new URL('../'+path,import.meta.url)),true,path);
 const sql=read(path);
 for(const fn of ['start_online_craft','cancel_online_craft','claim_online_craft'])assert.match(sql,new RegExp('drop function if exists public\\.'+fn,'i'));
 assert.match(sql,/delete from private\.online_craft_jobs/i);
 assert.match(sql,/\{crafting\}/i);\n assert.match(sql,/jsonb_build_object\('jobs','\[\]'::jsonb,'nextJobId',1\)/i);
});

test('CRAFT REMOVAL 05: materials are no longer described as crafting ingredients in inventory',()=>{
 const inventory=read('src/game/inventoryView.ts');
 assert.doesNotMatch(inventory,/제작 재료입니다/);
 assert.match(inventory,/탑.*확보한 재료/);
});
