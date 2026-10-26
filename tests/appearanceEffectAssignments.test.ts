import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APPEARANCES} from '../src/game/data/cosmetics';
import {APPEARANCE_EQUIP_EFFECT_IDS} from '../src/game/data/appearanceEquipEffects';
import {APPEARANCE_EFFECT_ASSIGNMENTS,appearanceEffectFor, equippedAppearanceEffect} from '../src/game/data/appearanceEquipAssignments';
import {initialState,stats} from '../src/game/engine/state';

test('all 60 collectible appearances have exactly one of the 16 effects',()=>{
 const collectible=APPEARANCES.filter(a=>a.rarity);
 assert.equal(collectible.length,60);
 assert.deepEqual(Object.keys(APPEARANCE_EFFECT_ASSIGNMENTS).sort(),collectible.map(a=>a.id).sort());
 const effects=new Set<string>(APPEARANCE_EQUIP_EFFECT_IDS);
 assert.ok(Object.values(APPEARANCE_EFFECT_ASSIGNMENTS).every(id=>effects.has(id)));
 for(const id of APPEARANCE_EQUIP_EFFECT_IDS)assert.ok(Object.values(APPEARANCE_EFFECT_ASSIGNMENTS).includes(id),id);
});
test('unlocked equipped appearance alone gives one effect, levels apply; default remains inert',()=>{
 const game=initialState();
 assert.equal(equippedAppearanceEffect(game.cosmetics),null);
 game.cosmetics.selectedAppearanceId='nameless_king';
 assert.equal(equippedAppearanceEffect(game.cosmetics),null);
 game.cosmetics.unlockedAppearanceIds.push('nameless_king');
 game.cosmetics.appearanceLevels={nameless_king:1};
 assert.deepEqual(equippedAppearanceEffect(game.cosmetics),{id:'attack',value:5});
 game.cosmetics.appearanceLevels.nameless_king=5;
 assert.deepEqual(equippedAppearanceEffect(game.cosmetics),{id:'attack',value:7.5});
 game.cosmetics.selectedAppearanceId='teddy';
 game.cosmetics.unlockedAppearanceIds.push('teddy');
 assert.deepEqual(equippedAppearanceEffect(game.cosmetics),{id:'max_hp',value:4});
 game.cosmetics.selectedAppearanceId='default';
 assert.equal(equippedAppearanceEffect(game.cosmetics),null);
});
test('representative assignment preview and equipment stat bonuses',()=>{
 assert.deepEqual(appearanceEffectFor('first_forgotten_one',1),{id:'hunting_equipment_drop',value:10});
 assert.deepEqual(appearanceEffectFor('intellectual',5),{id:'hunting_exp',value:6});
 assert.deepEqual(appearanceEffectFor('advanced_mage',5),{id:'max_mp',value:45});
 const game=initialState();
 const before=stats(game);
 game.cosmetics.unlockedAppearanceIds.push('seraphim');
 game.cosmetics.selectedAppearanceId='seraphim';
 assert.equal(stats(game).attack,before.attack);
 game.cosmetics.selectedAppearanceId='nameless_king';
 game.cosmetics.unlockedAppearanceIds.push('nameless_king');
 assert.ok(Math.abs(stats(game).attack-before.attack*1.05)<.0001);
 game.cosmetics.selectedAppearanceId='teddy';
 game.cosmetics.unlockedAppearanceIds.push('teddy');
 assert.ok(Math.abs(stats(game).hp-before.hp*1.04)<.0001);
});
test('server migration covers full effect catalog and authoritative battle/reward hooks',()=>{
 const sql=readFileSync('supabase/migrations/20261026123500_appearance_effect_assignments.sql','utf8');
 for(const key of APPEARANCE_EQUIP_EFFECT_IDS)assert.ok(sql.includes("'"+key+"'"),key);
 for(const id of Object.keys(APPEARANCE_EFFECT_ASSIGNMENTS))assert.ok(sql.includes("'"+id+"'"),id);
 for(const target of ['private.appearance_equipped_effect','private.combat_equipment_stats','public.hunt_once','private.guild_boss_combat'])assert.ok(sql.includes(target),target);
 assert.ok(!sql.includes('grant execute on function private.appearance_equipped_effect'));
});
