import test from 'node:test';
import assert from 'node:assert/strict';
import {jobDetailById} from '../src/game/jobs/details';

// Independent expectations from the user-approved 2026-10-06 A-rank design.
const APPROVED_KITS:[string,string[],number[]][]=[
 ['executor',['처단 베기','유죄 선고','최종 집행'],[0,3,4]],
 ['inquisitor',['심문봉 타격','약점 추궁','이단 단죄'],[0,2,4]],
 ['deep_delver',['곡괭이 강타','틈새 파고들기','심층 붕괴'],[0,3,4]],
 ['bloodfighter',['혈흔 베기','피의 대가','혈전 종결'],[0,3,4]],
 ['expedition_tactician',['전술 타격','공세 전환','집중 공세'],[0,4,4]],
 ['ascetic_priest',['고행봉 타격','육신의 대가','고통의 응보'],[0,4,4]],
 ['life_stitcher',['봉합침 찌르기','응급 봉합','생명 재구성'],[0,3,5]],
 ['subjugation_officer',['제압 타격','방어 파쇄','토벌 명령'],[0,3,4]],
 ['rescuer',['구조용 철퇴','긴급 방호','생환 조치'],[0,4,5]],
 ['quartermaster',['보급검 타격','전투 보급','비상 물자 투입'],[0,4,5]],
 ['coroner',['해부도 절개','사인 분석','사망 판정'],[0,3,4]],
 ['stair_scout',['선행 찌르기','틈새 연격','층계 돌파'],[0,2,4]],
];

test('all 12 approved A-rank job details expose names, cooldowns and the skill-only resource loop',()=>{
 for(const [id,names,cooldowns] of APPROVED_KITS){
  const d=jobDetailById(id);assert.ok(d,`${id} details missing`);
  assert.deepEqual(d.skills.map(s=>s.name),names,id);
  assert.deepEqual(d.skills.map(s=>s.cooldown),cooldowns,id);
  assert.deepEqual(d.skills.map(s=>s.resourceLabel),['자원 +1','자원 변화 없음','자원 -3'],id);
  assert.deepEqual(d.skills.map(s=>s.kind),['GENERATOR','NEUTRAL','SPENDER'],id);
  assert.match(d.resourceSummary,/시작 0.*최대 4/,id);
 }
});

test('A-rank offensive descriptions preserve approved damage, duration, penetration and HP conditions',()=>{
 const rows:[string,RegExp[]][]=[
  ['executor',[/140%/,/120%.*2턴.*약화/,/300%.*적 HP 30% 이하.*380%/]],
  ['inquisitor',[/130%/,/100%.*2턴.*약화/,/관통 35%.*310%.*약화.*350%/]],
  ['deep_delver',[/145%/,/관통 30%.*180%/,/120%.*3회/]],
  ['bloodfighter',[/140%.*2턴.*출혈/,/최대 HP 8% 소비.*240%/,/최대 HP 12% 소비.*340%.*자신의 HP 50% 이하.*400%/]],
  ['expedition_tactician',[/125%/,/2턴.*25%.*15%/,/105%.*3회/]],
  ['ascetic_priest',[/125%/,/최대 HP 10% 소비.*3턴.*공격력 증가/,/320%.*자신의 HP 50% 이하.*380%/]],
  ['subjugation_officer',[/140%/,/130%.*2턴.*약화/,/관통 40%.*330%/]],
  ['coroner',[/125%.*2턴.*출혈/,/110%.*2턴.*약화/,/290%.*적 HP 30% 이하.*390%/]],
  ['stair_scout',[/130%/,/85%.*2회.*관통 20%/,/90%.*4회/]],
 ];
 for(const [id,effects] of rows){
  const d=jobDetailById(id);assert.ok(d,`${id} details missing`);
  d.skills.forEach((s,i)=>assert.match(s.description,effects[i],`${id} skill ${i+1}`));
 }
});

test('A-rank support descriptions preserve approved healing, buffs and cleansing',()=>{
 const rows:[string,RegExp[]][]=[
  ['life_stitcher',[/115%/,/최대 HP 20% 회복.*출혈 제거/,/최대 HP 30% 회복.*3턴.*재생.*출혈.*중독 제거/]],
  ['rescuer',[/120%/,/2턴.*받는 피해 -30%.*최대 HP 10% 회복/,/최대 HP 28% 회복.*출혈.*중독 제거/]],
  ['quartermaster',[/120%/,/3턴.*공격력 증가/,/최대 HP 20% 회복.*3턴.*방어력 증가.*재생/]],
 ];
 for(const [id,effects] of rows){
  const d=jobDetailById(id);assert.ok(d,`${id} details missing`);
  d.skills.forEach((s,i)=>assert.match(s.description,effects[i],`${id} skill ${i+1}`));
 }
 assert.equal(jobDetailById('unknown_job'),null);
 assert.equal(jobDetailById(null),null);
});
