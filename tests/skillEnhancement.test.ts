import test from 'node:test';
import assert from 'node:assert/strict';
import {SKILL_TREE_CATALOG} from '../src/game/skills/catalog';
import {enhancementCost,enhancedSkill,skillEnhancementLevel} from '../src/game/skills/enhancement';
import {initialState} from '../src/game/engine/state';
import {validSave} from '../src/storage/repository';
test('old saves remain compatible and new skill levels validate in exported saves',()=>{
 const game=initialState();delete game.skillEnhancements;assert.equal(validSave(game),true);
 game.skillEnhancements={sword_strike_c:3};assert.equal(validSave(JSON.parse(JSON.stringify(game))),true);
 for(const invalid of [-1,1.5,4]){game.skillEnhancements={sword_strike_c:invalid};assert.equal(validSave(game),false);}
});
test('skill enhancement uses approved book and gold costs and stops at +3',()=>{
 const grades=['C','B','A','S','SR','SSR'] as const;
 for(const [i,grade] of grades.entries())for(let level=0;level<3;level++)assert.deepEqual(enhancementCost(grade,level),{level:level+1,books:[2,3,5][level],gold:500*2**i*2**level,bonus:[5,10,15][level]});
 assert.equal(enhancementCost('SSR',3),null);assert.equal(enhancementCost('C',-1),null);
 assert.equal(skillEnhancementLevel(4),0);assert.equal(skillEnhancementLevel(1.5),0);assert.equal(skillEnhancementLevel(undefined),0);
});
test('enhancement increases effect amounts without changing MP, trigger chance, turns or hits',()=>{
 for(const skill of SKILL_TREE_CATALOG){const upgraded=enhancedSkill(skill,3);assert.equal(upgraded.mp,skill.mp);assert.equal(upgraded.chance,skill.chance);assert.equal(upgraded.id,skill.id);}
 const get=(id:string)=>SKILL_TREE_CATALOG.find(s=>s.id===id)!;
 assert.equal(enhancedSkill(get('sword_strike_ssr'),3).power,'345%');
 assert.equal(enhancedSkill(get('sword_strike_a'),1).power,'173.25%');
 assert.equal(enhancedSkill(get('sword_wound_c'),3).effect,'출혈 9.2% · 3턴');
 assert.equal(enhancedSkill(get('bow_volley_ssr'),3).effect,'4회 공격 · 중독 20.7%');
 assert.equal(enhancedSkill(get('restore_c'),3).power,'29 MP');
 assert.equal(enhancedSkill(get('return_oath_ssr'),3).effect,'최대 HP +17.25% · 전투당 한 번 치명 피해를 받으면 HP 1로 생존하고 보호막 획득');
 assert.equal(enhancedSkill(get('sixth_mark_ssr'),3).effect,'액티브 6회 사용마다 MP 92 회복 · 다음 공격 피해 +17.25%');
 assert.equal(enhancedSkill(get('bow_mastery_c'),3).power,'0%');
});
