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
 assert.equal(jobDetailById('ascetic_priest'),null);
});
