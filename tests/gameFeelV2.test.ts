import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('GAME FEEL V2: newly forged obsidian relic and milestones receive local server-driven result feedback',()=>{
 const s=read('src/components/seal/SealScreen.tsx');
 const css=read('src/components/seal/seal-relic.css');
 assert.match(s,/data-result=\{lastStep!==null\}/);
 assert.match(s,/data-lit=\{index<activeNodes\}/);
 assert.match(s,/data-new=\{litNode===index\}/);
 assert.match(s,/setLitNode\(afterNodes>beforeNodes\?afterNodes-1:null\)/);
 assert.match(css,/\.tc-insignia-relic\[data-result="true"\] \.tc-insignia-art/);
 assert.match(css,/\.tc-insignia-milestone\[data-new="true"\] span/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('GAME FEEL V2: enhancement preview gets outcome-specific local classes',()=>{
 const s=read('src/components/enhancement/EnhancementScreen.tsx');
 assert.match(s,/tc-enhance-feel-/);
 assert.match(s,/setEnhanceFx/);
});

test('GAME FEEL V2: battle scene distinguishes targeted normal and critical impacts',()=>{
 const s=read('src/components/battle/BattleScene.tsx');
 assert.match(s,/is-critical/);
 assert.match(s,/monsterImpact/);
 assert.match(s,/playerImpact/);
});

test('GAME FEEL V2: all main combat action cards share press feedback',()=>{
 const s=read('src/components/battle/BattleScreen.tsx');
 assert.match(s,/tc-ref-card tc-feel-press[^\n]*key=\{i\}/);
 assert.match(s,/tc-ref-card tc-feel-press[^\n]*<strong>포션<\/strong>/);
 assert.match(s,/tc-ref-card tc-feel-press[^\n]*onClick=\{onFlee\}[^\n]*<strong>귀환<\/strong>/);
});

test('GAME FEEL V2: real silver and gold trade updates emit trade feedback',()=>{
 const silver=read('src/components/market/ServerMarketScreen.tsx');
 const gold=read('src/components/market/GoldExchangeScreen.tsx');
 for(const s of[silver,gold]){
  assert.match(s,/seenTradeIds/);
  assert.match(s,/market\.trade-filled/);
 }
});

test('GAME FEEL V2: targeted CSS exists with reduced-motion fallback',()=>{
 const s=read('src/gameFeel/game-feel.css');
 for(const name of['tc-seal-result-3','tc-enhance-feel-success','tc-combat-impact-critical','tc-market-trade-pulse'])assert.ok(s.includes(name),name);
 assert.match(s,/prefers-reduced-motion:\s*reduce/);
});
