import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
test('GAME FEEL UI: provider, hook, layer and reduced motion are wired once',()=>{
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const provider=readFileSync(new URL('../src/gameFeel/react/GameFeelProvider.tsx',import.meta.url),'utf8');
 const hook=readFileSync(new URL('../src/gameFeel/react/useGameFeel.ts',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/gameFeel/game-feel.css',import.meta.url),'utf8');
 assert.match(main,/GameFeelProvider/);assert.match(provider,/FeedbackLayer/);
 assert.match(hook,/play/);assert.match(css,/tc-feel-press/);assert.match(css,/tc-feel-flash/);
 assert.match(css,/prefers-reduced-motion:\s*reduce/);
 assert.doesNotMatch(css,/animation:[^;]*infinite/);
});
