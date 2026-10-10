import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {StatAllocationScreen} from '../src/components/stats/StatAllocationScreen';
import {applyStatAllocation,statResetCost,statPointsForLevel,normalizeStatAllocation,usedStatPoints,resolveHunt,initialHuntingState} from '../src/game/hunting/model';

test('every level from 2 through 100 grants exactly one point, and old players receive retroactive points',()=>{
 assert.equal(statPointsForLevel(1),0);
 assert.equal(statPointsForLevel(2),1);
 assert.equal(statPointsForLevel(40),39);
 assert.equal(statPointsForLevel(100),99);
 assert.equal(statPointsForLevel(101),99);
 const old=normalizeStatAllocation(undefined);
 assert.equal(usedStatPoints(old),0);
 assert.equal(statPointsForLevel(40)-usedStatPoints(old),39);
});
test('allocation increases four stats with crit investment and total crit caps',()=>{
 const bonus=applyStatAllocation({hp:180,attack:18,defense:7,critChance:.05},{hp:3,attack:4,defense:2,crit:10});
 assert.deepEqual(bonus,{hp:216,attack:22,defense:11,critChance:.25});
 assert.equal(applyStatAllocation({hp:180,attack:18,defense:7,critChance:.55},{hp:0,attack:0,defense:0,crit:10}).critChance,.6);
 assert.equal(statResetCost(40,0),0);
 assert.equal(statResetCost(40,1),50000);
 assert.equal(statResetCost(100,2),110000);
});
test('guest hunting battle uses actual allocated stats rather than a cosmetic preview',()=>{
 const withStats={...initialHuntingState(0),statAllocation:{hp:5,attack:10,defense:5,crit:0}};
 const result=resolveHunt(withStats,'plains',{hp:180,attack:18,defense:7,critChance:0},['heavy'],0,()=>.95).result;
 assert.equal(result.player.hp,240);assert.equal(result.player.attack,28);assert.equal(result.player.defense,17);
});
test('stat screen enables point controls, shows remaining points and preview, reset cost and pending restrictions',()=>{
 const game=initialState(),allocation={hp:2,attack:1,defense:0,crit:0};
 const html=renderToStaticMarkup(React.createElement(StatAllocationScreen,{game,level:20,allocation,remaining:16,resets:1,onHome:()=>{},onConfirm:()=>{},onReset:()=>{}}));
 assert.match(html,/남은 스탯 포인트/);assert.match(html,/>16<\/strong>/);
 assert.match(html,/초기화 30,000 실버/);assert.match(html,/최대 10 PT/);
 assert.match(html,/aria-label="최대 HP 배분 늘리기"/);
 assert.doesNotMatch(html,/포인트당 증가량 미정/);
 const busy=renderToStaticMarkup(React.createElement(StatAllocationScreen,{game,level:20,allocation,remaining:16,busy:true,onHome:()=>{}}));
 assert.match(busy,/<button disabled="" aria-label="공격력 배분 늘리기"/);
});
test('SQL grants only authenticated lease-protected mutations and prevents reset replay charges',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261010130000_hunting_stat_allocation.sql',import.meta.url),'utf8');
 for(const name of ['allocate_hunting_stats','reset_hunting_stats'])assert.ok(sql.includes('function public.'+name));
 assert.match(sql,/private\.require_active_game_session/);
 assert.match(sql,/stat_allocation/);assert.match(sql,/stat_resets/);
 assert.match(sql,/primary key\(user_id,request_id\)/);
 assert.match(sql,/grant execute on function public\.reset_hunting_stats\([^;]+to authenticated/);
 assert.match(sql,/STAT_POINTS_EMPTY/);assert.match(sql,/STAT_SILVER_SHORTAGE/);
 assert.match(sql,/STAT_COMBAT_ACTIVE/);
});
