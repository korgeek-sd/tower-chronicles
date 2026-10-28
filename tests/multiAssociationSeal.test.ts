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
 assert.match(ui,/className="tc-insignia-tab is-sealed"/);
 assert.match(ui,/disabled=\{busy\|\|!seals\[item.id\]\}/);
 assert.match(ui,/aria-pressed=\{selected===item.id\}/);
 assert.match(ui,/data-seal=\{selected\}/);
 assert.match(ui,/<h2>\{sealName\}<\/h2>/);
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

test('guild seal uses the imported real sprite atlas, not the hand-drawn SVG relic',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const sprite=read('src/components/seal/SealSprite.tsx');
 const css=read('src/components/seal/seal-relic.css');
 const raw=readFileSync('src/assets/ui/seals/guild-seal-animations.avif');
 assert.equal(raw.subarray(4,12).toString(),'ftypavif');
 assert.ok(raw.length>20000,'animated sprites must contain actual image data');
 assert.match(ui,/import \{SealSpriteIcon\} from '\.\/SealSprite'/);
 assert.match(ui,/import \{SealArtwork\} from '\.\/SealArtwork'/);
 assert.doesNotMatch(ui,/function RelicSigil|<RelicSigil/);
 assert.match(ui,/<SealArtwork variant=\{selected\} level=\{level\}/);
 assert.match(ui,/mode=\{visualMode\} sequence=\{visualSequence\}/);
 assert.match(sprite,/guild-seal-animations\.avif/);
 assert.match(sprite,/totalFrames=156/);
 assert.match(sprite,/combat_tier3_forge/);
 assert.match(sprite,/guardian_tier3_forge/);
 assert.match(sprite,/combat_reset/);
 assert.match(sprite,/guardian_reset/);
 assert.match(sprite,/requestAnimationFrame|setInterval/);
 assert.match(sprite,/prefers-reduced-motion: reduce/);
 assert.match(css,/\.tc-insignia-sprite\{/);
 assert.doesNotMatch(css,/url\(|seal-generated-atlas|seal-cathedral/);
});
test('seal keeps six milestone semantics alongside the raster thirty-stage display',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const css=read('src/components/seal/seal-relic.css');
 assert.ok(ui.includes('SEAL_MILESTONES.map'));
 assert.ok(ui.includes('<SealSpriteIcon'));
 assert.ok(ui.includes('data-lit={index<activeNodes}'));
 assert.ok(ui.includes('className="tc-insignia-level"'));
 assert.ok(!ui.includes('SEAL_RING_STEPS'));
 assert.ok(!ui.includes('tc-seal-ring-rank'));
 for(const required of ['grid-template-rows:58px minmax(0,1fr) 54px 58px 108px',
   'overflow:hidden','.tc-insignia-main-body{','.tc-insignia-milestones{',
   '@media(max-height:560px)','min-height:44px']){
  assert.ok(css.includes(required),required);
 }
});
test('seal rewards and roll rates are displayed exclusively from actual game values',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 for(const required of ['const nextLevel=Math.min(ASSOCIATION_SEAL_MAX_LEVEL,level+1)',
  'rewardFor(selected,nextLevel)','level/ASSOCIATION_SEAL_MAX_LEVEL*100',
  'percent(reward.hpPercent)','percent(reward.defensePercent)',
  'ASSOCIATION_SEAL_PROBABILITIES.map','role="status" aria-live="polite"']){
  assert.ok(ui.includes(required),required);
 }
 assert.ok(!ui.includes('Math.random'));
});
test('batch forge continues to execute single-roll RPCs sequentially with server limits',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 for(const required of ['const [rollCount,setRollCount]=useState(1)',
  'const remainingRolls=Math.max(0,ASSOCIATION_SEAL_MAX_ROLLS-rolls)',
  'const affordableRolls=Math.floor(gold/ASSOCIATION_SEAL_ROLL_COST)',
  'const selectedRolls=Math.min(rollCount,maxSelectableRolls)',
  'for(let index=0;index<selectedRolls;index++)',
  'const result=await rollOnlineSeal(onlineLease,sealId)',
  'if(result.afterLevel>=ASSOCIATION_SEAL_MAX_LEVEL)break',
  'lastResultStep=result.step',
  "feel.play('seal.roll.result',{step:lastResultStep})",
  'onServerRecord(result.record',
  '(selectedRolls*ASSOCIATION_SEAL_ROLL_COST).toLocaleString()']){
  assert.ok(ui.includes(required),required);
 }
 assert.ok(!ui.includes('p_roll_count'));
});
test('reset remains confirmation-gated and all server resources remain unchanged',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const a=ui.indexOf('if(!onlineLease||!canReset||!resetOpen||resetPending.current)return;');
 const b=ui.indexOf('const result=await resetOnlineSeal(onlineLease,sealId)');
 const c=ui.indexOf("feel.play('seal.reset')");
 assert.ok(a>0&&b>a&&c>b);
 assert.ok(ui.includes('disabled={!canReset}'));
 assert.ok(ui.includes('disabled={!canRoll}'));
 assert.ok(ui.includes('setLitNode(null)'));
});

test('original seal click sound ownership is preserved after the UI redesign',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const audio=read('src/audio/gameEffects.ts');
 assert.match(ui,/className="tc-insignia-roll tc-seal-roll tc-feel-press"/);
 assert.match(ui,/className="tc-insignia-reset tc-seal-reset tc-feel-press"/);
 assert.match(audio,/button\.matches\('\.tc-hunt-enter,\.tc-hunt-next,\.tc-seal-roll,\.tc-seal-reset,\.tc-seal-audio-preview'\)/);
});

test('success sprite animation runs only after server result and resets on selection',()=>{
 const ui=read('src/components/seal/SealScreen.tsx');
 const data=read('src/components/seal/SealSprite.tsx');
 const roll=ui.indexOf('const result=await rollOnlineSeal(onlineLease,sealId)');
 const success=ui.indexOf("setVisualMode('forge')");
 const reset=ui.indexOf("setVisualMode('reset')");
 const resetRpc=ui.indexOf('const result=await resetOnlineSeal(onlineLease,sealId)');
 assert.ok(roll>0&&success>roll&&reset>resetRpc);
 assert.match(ui,/setVisualSequence\(value=>value\+1\)/);
 assert.match(ui,/setVisualMode\('idle'\)/);
 assert.match(data,/tierForLevel/);
 assert.match(data,/level>=20\?3:level>=10\?2:1/);
 assert.match(data,/clearInterval/);
});
