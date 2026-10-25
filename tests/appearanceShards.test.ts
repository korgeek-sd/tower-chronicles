import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,stats} from '../src/game/engine/state.ts';
import {appearanceLevel,appearanceShardCount,appearanceShardCost,appearanceEffectPercent,APPEARANCE_MAX_LEVEL} from '../src/game/data/appearanceProgress.ts';
import {appearanceById} from '../src/game/data/cosmetics.ts';

test('every rarity uses one named shard per summon, 5 to unlock and 10 for each level',()=>{
 assert.equal(appearanceShardCost(0),5);
 for(let level=1;level<5;level++)assert.equal(appearanceShardCost(level),10);
 assert.equal(appearanceShardCost(5),0);
 assert.equal(APPEARANCE_MAX_LEVEL,5);
 const sql=readFileSync('supabase/migrations/20261025223500_appearance_shards_levels.sql','utf8');
 for(const phrase of ["'fragments',1","fragment_balance+1","old_level=0 then 5 else 10","old_level>=5","request_id","enhancement_level","appearance_authoritative_payload","private.combat_equipment_stats"]){
  assert.ok(sql.includes(phrase),phrase);
 }
 assert.doesNotMatch(sql,/shard_exchange|pity_counter|guaranteed_tier/);
});
test('shards do not equip unowned appearances and levels scale the proposed base bonus',()=>{
 const c=initialState().cosmetics;
 c.appearanceItems.nameless_king=4;
 assert.equal(appearanceLevel(c,'nameless_king'),0);
 assert.equal(appearanceShardCount(c,'nameless_king'),4);
 const king=appearanceById('nameless_king')!;
 assert.equal(appearanceEffectPercent(king,0),0);
 assert.equal(appearanceEffectPercent(king,1),5);
 assert.equal(appearanceEffectPercent(king,2),5.5);
 assert.equal(appearanceEffectPercent(king,3),6);
 assert.equal(appearanceEffectPercent(king,4),6.75);
 assert.equal(appearanceEffectPercent(king,5),7.5);
 c.unlockedAppearanceIds.push('nameless_king');
 c.appearanceLevels={nameless_king:5};
 assert.equal(appearanceLevel(c,'nameless_king'),5);
 assert.equal(appearanceShardCost(5),0);
});

test('equipped unlocked SSR increases actual player attack and Lv5 exceeds Lv1',()=>{
 const base=initialState();
 const baseline=base.equipmentItems.length;
 assert.ok(baseline>0);
 const before=base.cosmetics.selectedAppearanceId;
 assert.equal(before,'default');
 const attack=stats(base).attack;
 base.cosmetics.unlockedAppearanceIds.push('nameless_king');
 base.cosmetics.selectedAppearanceId='nameless_king';
 base.cosmetics.appearanceLevels={nameless_king:1};
 assert.ok(Math.abs(stats(base).attack-attack*1.05)<0.0001);
 base.cosmetics.appearanceLevels.nameless_king=5;
 assert.ok(Math.abs(stats(base).attack-attack*1.075)<0.0001);
 base.cosmetics.selectedAppearanceId='default';
 assert.equal(stats(base).attack,attack);
});
