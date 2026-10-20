import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('entry requires account before mounting gameplay or showing first-run lore',()=>{
 const entry=read('src/components/intro/GameEntry.tsx');
 assert.match(entry,/splashDone&&signedIn&&open/);
 assert.match(entry,/signedIn&&<div inert=/);
 assert.match(entry,/!signedIn&&<StartScreen/);
 assert.match(entry,/tower:session-changed/);
 assert.match(read('src/main.tsx'),/dispatchEvent\(new Event\('tower:session-changed'\)\)/);
});
test('start screen uses the real Google OAuth action and separate responsive artwork',()=>{
 const screen=read('src/components/intro/StartScreen.tsx');
 assert.match(screen,/await signInWithGoogle\(\)/);
 assert.match(screen,/Google로 로그인/);
 assert.match(screen,/role="alert"/);
 assert.match(screen,/disabled=\{busy\|\|!onlineConfigured\}/);
 assert.doesNotMatch(screen,/게스트|type="password"|type="email"/);
 assert.match(screen,/title-logo.webp/);
 const css=read('src/components/intro/start-screen.css');
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/object-fit:contain/);
 assert.match(css,/100dvh/);
});
