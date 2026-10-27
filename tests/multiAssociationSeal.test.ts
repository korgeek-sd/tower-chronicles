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
