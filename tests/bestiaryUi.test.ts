import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {bestiaryEntryById,BESTIARY_ENTRIES} from '../src/game/data/bestiary.ts';
import {bestiaryDiscoveredCount,bestiaryEntryView,aiConditionText} from '../src/components/bestiary/presentation.ts';

test('BESTIARY UI 01: 미조우 개체는 이름과 전투 정보가 잠긴다',()=>{
 const s=initialState(),entry=bestiaryEntryById('quartz_carapace_beetle')!;
 const view=bestiaryEntryView(s,entry);
 assert.equal(view.knowledge,'UNKNOWN');
 assert.equal(view.displayName,'미확인 개체');
 assert.equal(view.skills.length,0);
});

test('BESTIARY UI 02: 1회 조우 후 이름과 층 기록만 공개된다',()=>{
 const s=initialState(),entry=bestiaryEntryById('quartz_carapace_beetle')!;
 s.bestiary.entries[entry.id]={encounters:1,defeats:0};
 const view=bestiaryEntryView(s,entry);
 assert.equal(view.knowledge,'ENCOUNTERED');
 assert.equal(view.displayName,'석영등갑충');
 assert.match(view.floorLabel,/1F/);
 assert.equal(view.skills.length,0);
});

test('BESTIARY UI 03: 일반 개체 1회 처치 후 스킬 이름만 공개된다',()=>{
 const s=initialState(),entry=bestiaryEntryById('crystal_scale_serpent')!;
 s.bestiary.entries[entry.id]={encounters:2,defeats:1};
 const view=bestiaryEntryView(s,entry);
 assert.equal(view.knowledge,'DEFEATED');
 assert.ok(view.skills.some(skill=>skill.name==='균열독니'));
 assert.ok(view.skills.some(skill=>skill.name==='파쇄교상'));
 assert.ok(view.skills.every(skill=>skill.description===null&&skill.cooldown===null&&skill.conditions.length===0));
});

test('BESTIARY UI 04: 일반 개체 3회 처치 후 설명, 대기시간과 AI 조건이 공개된다',()=>{
 const s=initialState(),entry=bestiaryEntryById('crystal_scale_serpent')!;
 s.bestiary.entries[entry.id]={encounters:4,defeats:3};
 const view=bestiaryEntryView(s,entry);
 assert.equal(view.knowledge,'MASTERED');
 const shatter=view.skills.find(skill=>skill.name==='파쇄교상')!;
 assert.match(shatter.description??'',/균열/);
 assert.equal(shatter.cooldown,2);
 assert.ok(shatter.conditions.some(condition=>condition.includes('결정 균열')&&condition.includes('2중첩')));
});

test('BESTIARY UI 05: 보스는 1회 처치로 완전 해금된다',()=>{
 const s=initialState(),entry=bestiaryEntryById('celestial_core_matrix')!;
 s.bestiary.entries[entry.id]={encounters:1,defeats:1};
 const view=bestiaryEntryView(s,entry);
 assert.equal(view.knowledge,'MASTERED');
 assert.equal(view.displayName,'천광심핵 모체');
 assert.ok(view.skills.some(skill=>skill.description&&skill.cooldown!==null));
});

test('BESTIARY UI 06: 전체 발견 수는 조우 기록이 있는 canonical 개체만 계산한다',()=>{
 const s=initialState();
 s.bestiary.entries.quartz_carapace_beetle={encounters:1,defeats:0};
 s.bestiary.entries.celestial_core_matrix={encounters:2,defeats:1};
 s.bestiary.entries['not-in-catalog']={encounters:99,defeats:99};
 assert.equal(bestiaryDiscoveredCount(s,BESTIARY_ENTRIES),2);
});

test('BESTIARY UI 07: AI 조건 설명은 엔진 조건을 사람이 읽는 문구로 변환한다',()=>{
 assert.equal(aiConditionText({kind:'SELF_HP_BELOW',value:.5}),'자신 HP 50% 미만');
 assert.equal(aiConditionText({kind:'TARGET_EFFECT_STACKS_AT_LEAST',effectId:'crystal_fracture',requiredStacks:2}),'대상의 결정 균열 2중첩 이상');
 assert.equal(aiConditionText({kind:'SKILL_READY',skillId:'anything'}),null);
});
