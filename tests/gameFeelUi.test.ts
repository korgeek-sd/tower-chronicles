import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const provider=()=>readFileSync(new URL('../src/gameFeel/react/GameFeelProvider.tsx',import.meta.url),'utf8');
const hook=()=>readFileSync(new URL('../src/gameFeel/react/useGameFeel.ts',import.meta.url),'utf8');
const layer=()=>readFileSync(new URL('../src/gameFeel/react/FeedbackLayer.tsx',import.meta.url),'utf8');
const css=()=>readFileSync(new URL('../src/gameFeel/game-feel.css',import.meta.url),'utf8');

test('GAME FEEL UI 01: one provider wraps the application root',()=>{
 assert.match(main,/import \{GameFeelProvider\} from '\.\/gameFeel\/react\/GameFeelProvider'/);
 assert.match(main,/import '\.\/gameFeel\/game-feel\.css'/);
 assert.match(main,/render\(<GameFeelProvider><App\/><\/GameFeelProvider>\)/);
});

test('GAME FEEL UI 02: provider resolves semantic events and contains presentation failures',()=>{
 const source=provider();
 assert.match(source,/resolveGameFeelRecipe/);
 assert.match(source,/createFeedbackQueue/);
 assert.match(source,/playHaptic/);
 assert.match(source,/try\s*\{/);
 assert.match(source,/catch\s*\{/);
 assert.match(source,/<FeedbackLayer/);
});

test('GAME FEEL UI 03: hook degrades to a safe no-op outside provider',()=>{
 const source=hook();
 assert.match(source,/noopGameFeel/);
 assert.match(source,/useContext/);
 assert.match(source,/play/);
});

test('GAME FEEL UI 04: feedback layer renders from ephemeral entries, not gameplay state',()=>{
 const source=layer();
 assert.match(source,/FeedbackEntry/);
 assert.match(source,/entry\.recipe\.commands/);
 assert.doesNotMatch(source,/GameState/);
 assert.doesNotMatch(source,/expedition/);
});

test('GAME FEEL UI 05: shared CSS provides reusable feedback primitives',()=>{
 const source=css();
 for(const token of ['tc-gf-press','tc-gf-pending','tc-gf-flash','tc-gf-pulse','tc-gf-shake','tc-gf-burst','tc-gf-particles','tc-gf-value-pop']){
  assert.match(source,new RegExp('\\.'+token.replaceAll('-','\\-')));
 }
 assert.match(source,/@media\(prefers-reduced-motion:reduce\)/);
});

test('GAME FEEL UI 06: feedback primitives avoid permanent animation loops',()=>{
 const source=css();
 assert.doesNotMatch(source,/tc-gf-[^\n{]*\{[^}]*animation:[^;}]*infinite/i);
});
