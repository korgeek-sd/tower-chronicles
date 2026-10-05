import test from 'node:test';
import assert from 'node:assert/strict';
import {jobDetailById} from '../src/game/jobs/details';

test('approved A-rank jobs expose three skills with resource costs and cooldowns',()=>{
 const rows:[string,string[],number[],string[]][]=[
  ['executor',['집행검 내려치기','형벌의 일격','처형'],[1,4,4],['+1','변화 없음','-3']],
  ['inquisitor',['심문칼 찌르기','엄정한 심문','판결의 연격'],[1,4,4],['+1','변화 없음','-3']],
  ['deep_delver',['도굴 곡괭이','방호 파쇄','심층 굴진'],[1,3,4],['+1','변화 없음','-2']],
  ['bloodfighter',['혈전 베기','상처 벌리기','혈전 돌파'],[1,3,5],['+1','변화 없음','-3']],
  ['expedition_tactician',['전술검 타격','공방 전술','집중 공세'],[1,4,4],['+1','변화 없음','-2']],
 ];
 for(const [id,names,cooldowns,resources] of rows){
  const d=jobDetailById(id);assert.ok(d,`${id} details missing`);
  assert.deepEqual(d.skills.map(s=>s.name),names);
  assert.deepEqual(d.skills.map(s=>s.cooldown),cooldowns);
  assert.deepEqual(d.skills.map(s=>s.resourceLabel),resources.map(r=>'자원 '+r));
  assert.deepEqual(d.skills.map(s=>s.kind),['GENERATOR','NEUTRAL','SPENDER']);
  assert.match(d.resourceSummary,/시작 0.*최대 4/);
 }
});

test('A-rank descriptions spell out duration, bleed damage, execution threshold and fixed healing',()=>{
 for(const id of ['inquisitor','bloodfighter'])assert.match(jobDetailById(id)!.skills[1].description,/2턴.*출혈.*매 턴 5/);
 assert.match(jobDetailById('executor')!.skills[2].description,/260%.*30% 이하.*360%/);
 assert.match(jobDetailById('bloodfighter')!.skills[2].description,/270%.*최대 HP의 15%/);
 assert.match(jobDetailById('expedition_tactician')!.skills[1].description,/2턴.*25%.*20%/);
 assert.equal(jobDetailById('coroner'),null);
});


test('second five A-rank job details expose approved costs, cooldowns and effects',()=>{
 const rows:[string,string[],number[],RegExp[]][]=[
  ['ascetic_priest',['고행봉 타격','인내의 기도','고행의 응답'],[1,4,5],[/115%/,/2턴.*30%/,/240%.*최대 HP의 20%/]],
  ['life_stitcher',['봉합침 찌르기','상처 봉합','생명 이어붙이기'],[1,4,5],[/110%/,/최대 HP의 20%.*출혈/,/최대 HP의 35%.*출혈.*중독/]],
  ['subjugation_officer',['토벌검 베기','방호 절개','토벌 집행'],[1,4,4],[/135%/,/110%.*2턴.*방어력.*20%/,/300%/]],
  ['rescuer',['구조도끼 타격','안전 확보','긴급 구조'],[1,4,5],[/120%/,/2턴.*20%.*출혈/,/최대 HP의 30%.*2턴.*30%/]],
  ['quartermaster',['보급봉 타격','전투 보급','예비 물자 투입'],[1,4,5],[/115%/,/최대 HP의 10%.*2턴.*25%/,/최대 HP의 30%.*2턴.*20%/]],
 ];
 for(const [id,names,cooldowns,effects] of rows){
  const d=jobDetailById(id);assert.ok(d,`${id} detail missing`);
  assert.deepEqual(d.skills.map(s=>s.name),names);
  assert.deepEqual(d.skills.map(s=>s.cooldown),cooldowns);
  assert.deepEqual(d.skills.map(s=>s.resourceLabel),['자원 +1','자원 변화 없음','자원 -3']);
  assert.deepEqual(d.skills.map(s=>s.kind),['GENERATOR','NEUTRAL','SPENDER']);
  d.skills.forEach((s,i)=>assert.match(s.description,effects[i]));
 }
});
