import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guardianSealReward,associationSealReward,ASSOCIATION_SEAL_ROLL_COST,ASSOCIATION_SEAL_RESET_COST} from '../src/game/seal.ts';
const read=(p:string)=>readFileSync(p,'utf8');
test('combat seal retains original progression and guardian develops independently',()=>{
 assert.deepEqual(associationSealReward(0),{hpPercent:0,attackPercent:0,defensePercent:0});
 assert.deepEqual(guardianSealReward(0),{hpPercent:0,attackPercent:0,defensePercent:0});
 assert.equal(guardianSealReward(30).hpPercent,3);
 assert.equal(guardianSealReward(30).defensePercent,6);
 assert.equal(guardianSealReward(30).attackPercent,0);
 assert.equal(ASSOCIATION_SEAL_ROLL_COST,300);
 assert.equal(ASSOCIATION_SEAL_RESET_COST,3000);
});
test('two server-backed seals with independent state and future sealed slots',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 assert.match(ui,/getOnlineSealState\(onlineLease,'association'\)/);
 assert.match(ui,/getOnlineSealState\(onlineLease,'guardian'\)/);
 assert.match(ui,/rollOnlineSeal\(onlineLease,sealId\)/);
 assert.match(ui,/resetOnlineSeal\(onlineLease,sealId\)/);
 assert.match(ui,/SEALED_SLOT_NUMBERS=\[3,4\]/);
 assert.match(ui,/봉인된 인장/);
 assert.match(ui,/className="tc-seal-slot sealed"/);
 assert.match(ui,/disabled=\{busy\|\|!seals\[item.id\]\}/);
 assert.match(ui,/aria-pressed=\{selected===item.id\}/);
 assert.match(ui,/tc-seal-guardian/);
 assert.match(ui,/<h3>\{sealName\} 효과<\/h3>/);
});
test('guardian RPCs use lease and server replay receipts',()=>{
 const src=read('src/online/seal.ts');
 for(const word of ['get_guardian_seal_state','roll_guardian_seal','reset_guardian_seal'])assert.ok(src.includes(word));
 assert.match(src,/await remember\(result.record\)/);
 const ddl=read('supabase/migrations/20261027231000_guardian_seal_and_multi_seal.sql');
 assert.match(ddl,/private\.player_guardian_seals/);
 assert.match(ddl,/private\.guardian_seal_roll_requests/);
 assert.match(ddl,/private\.guardian_seal_reset_requests/);
 assert.match(ddl,/p_request_id/);
 assert.match(ddl,/private\.require_active_game_session/);
 assert.match(ddl,/private\.combat_equipment_stats/);
 assert.match(ddl,/guardian_seal_bonus_json/);
 assert.match(ddl,/revoke all on private\.player_guardian_seals from public,anon,authenticated/);
});

test('seal collection stays within one screen without duplicate progress or completed footer',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const css=read('src/components/seal/seal-collection.css');
 assert.doesNotMatch(ui,/className="tc-seal-progression"/);
 assert.doesNotMatch(ui,/className="tc-seal-owned"/);
 assert.doesNotMatch(ui,/className="tc-seal-costs"/);
 assert.doesNotMatch(ui,/30단계 효과가 적용 중입니다/);
 assert.match(ui,/role="status"/);
 assert.match(css,/\.tc-seal\.tc-seal-multi\{[^}]*overflow:hidden/s);
 assert.doesNotMatch(css,/\.tc-seal\.tc-seal-multi\{[^}]*overflow-y:auto/s);
 assert.match(css,/\.tc-seal-multi \.tc-seal-actions button\{min-height:44px/);
 assert.match(css,/@media\s*\(max-width:560px\)\{[\s\S]*?\.tc-seal-multi \.tc-seal-stage\{grid-template-columns:minmax\(0,/);
});

test('guild emblems use transparent layered image assets for live seals and locked slots',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const css=read('src/components/seal/seal-collection.css');
 for(const marker of ['tc-seal-slot-emblem tc-seal-art','tc-seal-locked-art tc-seal-art','tc-seal-core-art','tc-seal-badge-art'])assert.ok(ui.includes(marker),marker);
 assert.doesNotMatch(ui,/item\.id==='guardian'\?'◆':'✦'/);
 const art=[
  'seal-combat-core.svg','seal-guardian-core.svg',
  'seal-combat-frame.svg','seal-guardian-frame.svg',
  'seal-combat-track.svg','seal-guardian-track.svg',
  'seal-combat-node-off.svg','seal-combat-node-on.svg',
  'seal-guardian-node-off.svg','seal-guardian-node-on.svg',
  'seal-combat-plate.svg','seal-guardian-plate.svg',
  'seal-combat-flare-1.svg','seal-combat-flare-2.svg',
  'seal-guardian-flare-1.svg','seal-guardian-flare-2.svg',
  'seal-sealed-3.svg','seal-sealed-4.svg'
 ];
 for(const name of art){
  const source=read('src/assets/ui/seals/'+name);
  assert.match(source,/<svg[^>]*viewBox/);
  assert.doesNotMatch(source,/<image[^>]*href="https?:/);
  assert.ok(source.length>550,'art asset is too sparse: '+name);
  assert.ok(css.includes('seals/'+name),'CSS must use '+name);
 }
 assert.doesNotMatch(css,/seal-emblems-v1\.webp/);
 assert.match(css,/\.tc-seal-multi \.tc-seal-node\.active/);
 assert.match(css,/\.tc-seal-multi \.tc-seal-rank-cartouche/);
});

test('seal upgrade dial engraves the real 0 to 30 level over illustrated metalwork',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const css=read('src/components/seal/seal-collection.css');
 const frame=read('src/assets/ui/seal-level-cartouche.svg');
 assert.match(ui,/const SEAL_MILESTONES=\[5,10,15,20,25,30\] as const/);
 assert.match(ui,/Math\.floor\(level\/5\)/);
 assert.match(ui,/Math\.floor\(result\.beforeLevel\/5\)/);
 assert.match(ui,/Math\.floor\(result\.afterLevel\/5\)/);
 assert.match(ui,/--seal-progress/);
 assert.match(ui,/tc-seal-progress-arc/);
 assert.match(ui,/tc-seal-rank-cartouche/);
 assert.match(ui,/tc-seal-engraved-level/);
 assert.match(ui,/\{level\}/);
 assert.match(ui,/SEAL_MILESTONES\.map/);
 assert.doesNotMatch(ui,/\{index\+1\}<\/span>/);
 assert.match(css,/\.tc-seal-multi \.tc-seal-progress-arc/);
 assert.match(css,/conic-gradient/);
 assert.match(css,/seal-level-cartouche\.svg/);
 assert.match(css,/\.tc-seal-multi\.tc-seal-guardian \.tc-seal-rank-cartouche/);
 assert.match(frame,/<svg/);
 assert.match(frame,/linearGradient/);
});

test('new forged seal visuals show every rank and the immediate next server-derived bonus',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const css=read('src/components/seal/seal-collection.css');
 assert.match(ui,/const nextLevel=Math\.min\(ASSOCIATION_SEAL_MAX_LEVEL,level\+1\)/);
 assert.match(ui,/rewardFor\(selected,nextLevel\)/);
 assert.match(ui,/SEAL_MILESTONES\.map/);
 assert.match(ui,/--seal-progress/);
 assert.match(ui,/tc-seal-flare/);
 assert.match(ui,/tc-seal-milestone-label/);
 assert.match(css,/\.tc-seal-multi\.tc-seal-guardian \.tc-seal-progress-arc/);
 assert.doesNotMatch(ui,/style=\{\{[^}]*Math\.random/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
