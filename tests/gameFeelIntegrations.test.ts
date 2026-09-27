import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const seal=()=>readFileSync(new URL('../src/components/seal/SealScreen.tsx',import.meta.url),'utf8');
const enhancement=()=>readFileSync(new URL('../src/components/enhancement/EnhancementScreen.tsx',import.meta.url),'utf8');

test('GAME FEEL SEAL 01: seal uses the shared semantic hook',()=>{
 const source=seal();
 assert.match(source,/useGameFeel/);
 assert.match(source,/const feel=useGameFeel\(\)/);
});

test('GAME FEEL SEAL 02: roll start feedback precedes RPC and result feedback follows authoritative step',()=>{
 const source=seal();
 const start=source.indexOf("feel.play('seal.roll.start')");
 const rpc=source.indexOf('await rollOnlineAssociationSeal');
 const result=source.indexOf("feel.play('seal.roll.result',{step:result.step})");
 assert.ok(start>=0);
 assert.ok(rpc>start);
 assert.ok(result>rpc);
 assert.doesNotMatch(source,/Math\.random\(/);
});

test('GAME FEEL SEAL 03: reset feedback only follows authoritative reset success',()=>{
 const source=seal();
 const rpc=source.indexOf('await resetOnlineAssociationSeal');
 const result=source.indexOf("feel.play('seal.reset')");
 assert.ok(rpc>=0);
 assert.ok(result>rpc);
});

test('GAME FEEL SEAL 04: RPC failures use shared error feedback without synthetic result',()=>{
 const source=seal();
 assert.match(source,/catch\(error\)\{feel\.play\('ui\.error'/);
});

test('GAME FEEL SEAL 05: busy state exposes the reusable pending class',()=>{
 const source=seal();
 assert.match(source,/tc-gf-pending/);
 assert.match(source,/disabled=\{!canRoll\}/);
 assert.match(source,/disabled=\{!canReset\}/);
});

test('GAME FEEL SEAL 06: visible result/status copy remains in the DOM',()=>{
 const source=seal();
 assert.match(source,/role="status"/);
 assert.match(source,/ASSOCIATION_SEAL_PROBABILITIES\.map/);
 assert.match(source,/<b>\+\{item\.step\}<\/b><strong>\{item\.rate\}%<\/strong>/);
});


test('GAME FEEL ENHANCEMENT 01: enhancement screen uses the shared semantic hook',()=>{
 const source=enhancement();
 assert.match(source,/useGameFeel/);
 assert.match(source,/const feel=useGameFeel\(\)/);
});

test('GAME FEEL ENHANCEMENT 02: attempt feedback precedes both local and online resolution',()=>{
 const source=enhancement();
 const attempt=source.indexOf("feel.play('enhancement.attempt')");
 const local=source.indexOf('enhanceEquipment(game,selected.id)');
 const online=source.indexOf('await enhanceOnlineEquipment');
 assert.ok(attempt>=0);
 assert.ok(local>attempt);
 assert.ok(online>attempt);
});

test('GAME FEEL ENHANCEMENT 03: online authoritative outcome is forwarded unchanged',()=>{
 const source=enhancement();
 const rpc=source.indexOf('await enhanceOnlineEquipment');
 const result=source.indexOf("feel.play('enhancement.result',{outcome:result.outcome");
 assert.ok(rpc>=0);
 assert.ok(result>rpc);
});

test('GAME FEEL ENHANCEMENT 04: offline outcome is derived from resulting item state, not guessed RNG',()=>{
 const source=enhancement();
 assert.match(source,/const localResult=enhanceEquipment\(game,selected\.id\)/);
 assert.match(source,/const localOutcome:ServerEnhancementOutcome=/);
 assert.match(source,/localResult\.items\.find/);
 assert.doesNotMatch(source,/feel[^\n]*Math\.random/);
});

test('GAME FEEL ENHANCEMENT 05: failed server request produces only shared error feedback',()=>{
 const source=enhancement();
 assert.match(source,/catch\(error\)\{feel\.play\('ui\.error'/);
});
