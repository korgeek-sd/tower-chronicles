import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('entry requires account before mounting gameplay or showing first-run lore',()=>{
 const entry=read('src/components/intro/GameEntry.tsx');
 assert.match(entry,/splashDone&&ready&&open/);
 assert.match(entry,/ready&&<div inert=/);
 assert.match(entry,/!ready&&<StartScreen/);
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

test('start screen waits for explicit entry and offers only configured server choices',()=>{
 const screen=read('src/components/intro/StartScreen.tsx');
 assert.match(screen,/GAME_SERVERS.map/);
 assert.match(screen,/서버 선택/);
 assert.match(screen,/탑에 들어가기/);
 assert.match(screen,/로그아웃/);
 const entry=read('src/components/intro/GameEntry.tsx');
 assert.match(entry,/useState\(qa\)/);
 assert.match(entry,/canEnterGame\(signedIn,entered\)/);
 assert.doesNotMatch(entry,/addEventListener\('(?:focus|visibilitychange)'/);
});
test('server selector and enter button stay compact without shrinking Google sign-in or touch targets',()=>{
 const css=read('src/components/intro/start-screen.css');
 const server=css.match(/\.tc-start-screen__server\{([^}]+)\}/)![1];
 const enter=css.match(/\.tc-start-screen \.tc-start-screen__enter\{([^}]+)\}/)![1];
 for(const rule of [server,enter])assert.match(rule,/width:70%/);
 assert.match(enter,/min-height:44px/);
 assert.match(css,/\.tc-start-screen__server select\{[^}]*min-height:44px/);
 assert.match(css,/\.tc-start-screen \.tc-start-screen__google\{[^}]*width:100%;min-height:56px/);
});
test('title screen loads the approved pixel background through the deployment base path',()=>{
 const screen=read('src/components/intro/StartScreen.tsx');
 assert.match(screen,/import.meta.env.BASE_URL\+'assets\/intro\/start-background-pixel.webp'/);
});
test('background is a real image so relative URLs resolve against the page, not the CSS asset directory',()=>{
 const screen=read('src/components/intro/StartScreen.tsx');
 assert.match(screen,/<img className="tc-start-screen__art" src=\{import.meta.env.BASE_URL\+'assets\/intro\/start-background-pixel.webp'\}/);
 assert.doesNotMatch(screen,/--tc-start-background/);
 const css=read('src/components/intro/start-screen.css');
 assert.match(css,/\.tc-start-screen__art\{[^}]*width:100%;height:100%;object-fit:cover/);
});
