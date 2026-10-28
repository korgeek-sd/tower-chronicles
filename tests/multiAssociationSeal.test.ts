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

test('generated 15-frame seal texture atlas renders in selection, forging ring and milestone sockets',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const css=read('src/components/seal/seal-collection.css');
 const atlas=readFileSync('src/assets/ui/seal-generated-atlas.jpg');
 assert.ok(atlas.length>4500);
 assert.equal(atlas[0],0xff);
 assert.equal(atlas[1],0xd8);
 assert.equal(atlas.at(-2),0xff);
 assert.equal(atlas.at(-1),0xd9);
 for(const marker of ['tc-seal-slot-emblem tc-seal-art','tc-seal-locked-art tc-seal-art','tc-seal-core-art','tc-seal-badge-art','tc-seal-progress-dot','tc-seal-flare']){
  assert.ok(ui.includes(marker),marker);
 }
 assert.match(css,/seal-generated-atlas\.jpg/);
 for(const id of ['association','guardian','sealed-3','sealed-4'])assert.ok(css.includes('.tc-seal-art.'+id),id);
 assert.match(css,/\.tc-seal-multi \.tc-seal-node\.active/);
 assert.match(css,/\.tc-seal-multi \.tc-seal-rank-cartouche/);
 assert.match(css,/\.tc-seal-multi \.tc-seal-progress-dot/);
 assert.doesNotMatch(css,/seals\/seal-.*\.svg/);
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

test('cathedral seal forge follows the reference composition with a full 30-number orbit',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const css=read('src/components/seal/seal-collection.css');
 const backdrop=read('src/assets/ui/seal-cathedral.svg');
 assert.match(ui,/tc-seal-cathedral/);
 assert.match(ui,/SEAL_RING_STEPS=Array\.from\(\{length:ASSOCIATION_SEAL_MAX_LEVEL\}/);
 assert.match(ui,/SEAL_RING_STEPS\.map/);
 assert.match(ui,/className="tc-seal-ring-rank/);
 assert.match(ui,/className="tc-seal-quantity"/);
 assert.match(ui,/className="tc-seal-stage-number"/);
 assert.match(ui,/className="tc-seal-status"/);
 assert.match(ui,/SEAL_MILESTONES\.map/);
 assert.match(css,/\.tc-seal\.tc-seal-multi\.tc-seal-cathedral\{/);
 assert.match(css,/seal-cathedral\.svg/);
 assert.match(css,/\.tc-seal-cathedral \.tc-seal-ring-rank/);
 assert.match(css,/grid-template-rows/);
 assert.match(css,/overflow:hidden/);
 assert.match(backdrop,/<svg[^>]*viewBox/);
 assert.ok(backdrop.length>3500);
});
test('quantity controls execute only sequential server-authoritative rolls within limits',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 assert.match(ui,/const \[rollCount,setRollCount\]=useState\(1\)/);
 assert.match(ui,/const remainingRolls=Math\.max\(0,ASSOCIATION_SEAL_MAX_ROLLS-rolls\)/);
 assert.match(ui,/const affordableRolls=Math\.floor\(gold\/ASSOCIATION_SEAL_ROLL_COST\)/);
 assert.match(ui,/const selectedRolls=Math\.min\(rollCount,maxSelectableRolls\)/);
 assert.match(ui,/for\(let index=0;index<selectedRolls;index\+\+\)/);
 assert.match(ui,/await rollOnlineSeal\(onlineLease,sealId\)/);
 assert.match(ui,/if\(result\.afterLevel>=ASSOCIATION_SEAL_MAX_LEVEL\)break/);
 assert.match(ui,/onServerRecord\(result\.record/);
 assert.doesNotMatch(ui,/Math\.random/);
 assert.doesNotMatch(ui,/p_roll_count/);
});

test('mobile cathedral prioritizes unobstructed 30-stage altar over duplicate status chrome',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const css=read('src/components/seal/seal-collection.css');
 assert.match(ui,/SEAL_RING_STEPS\.map/);
 assert.match(ui,/data-active=\{rank<=level\}/);
 assert.match(ui,/tc-seal-stage-number/);
 assert.match(css,/\/\* Screenshot-driven mobile cathedral refinement \*\//);
 assert.match(css,/\.tc-seal\.tc-seal-multi\.tc-seal-cathedral\{[\s\S]*?grid-template-rows:48px 20px minmax\(0,1fr\) 54px 48px 54px/);
 assert.match(css,/\.tc-seal-cathedral \.tc-seal-stage\{[\s\S]*?grid-template-rows:minmax\(0,1fr\) 36px/);
 assert.match(css,/\.tc-seal-cathedral \.tc-seal-altar\{[\s\S]*?grid-template-rows:35px minmax\(0,1fr\) 16px/);
 assert.match(css,/\.tc-seal-cathedral \.tc-seal-wheel\{[\s\S]*?--seal-wheel-size:min\(94cqw,calc\(100cqh - 57px\),400px\)/);
 assert.match(css,/\.tc-seal-cathedral \.tc-seal-status\{[\s\S]*?height:36px/);
 assert.match(css,/\.tc-seal-cathedral \.tc-seal-status h3,[\s\S]*?\.tc-seal-cathedral \.tc-seal-next\{display:none\}/);
 assert.match(css,/\.tc-seal-cathedral \.tc-seal-ring-rank\{[\s\S]*?--rank-radius/);
 assert.match(css,/@media\(max-height:700px\)\{[\s\S]*?\.tc-seal\.tc-seal-multi\.tc-seal-cathedral\{grid-template-rows:46px 19px minmax\(0,1fr\) 50px 46px 52px/);
 assert.match(css,/\.tc-seal-cathedral \.tc-seal-quantity-stepper button,[\s\S]*?min-height:44px/);
});


test('the new association seal UI is entirely drawn in code, not loaded from previous visual assets',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const css=read('src/components/seal/seal-relic.css');
 assert.match(ui,/import '\.\/seal-relic\.css'/);
 assert.match(ui,/function RelicSigil/);
 assert.match(ui,/tc-insignia-board/);
 assert.match(ui,/tc-insignia-milestone/);
 assert.match(ui,/tc-insignia-probability/);
 assert.match(ui,/tc-insignia-quantity/);
 assert.match(ui,/tc-insignia-roll/);
 assert.match(ui,/tc-insignia-reset/);
 assert.doesNotMatch(ui,/tc-seal-cathedral|tc-seal-art|tc-seal-wheel|tc-seal-core-art/);
 assert.doesNotMatch(css,/url\(|seal-generated-atlas|seal-cathedral|seal-emblems|\.webp|\.jpg|\.png|\.svg/);
 assert.match(css,/\.tc-insignia-board\{/);
 assert.match(css,/\.tc-insignia-relic\{/);
 assert.match(css,/@media\s*\(max-height:700px\)/);
 assert.match(css,/@media\s*\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/min-height:44px/);
});
