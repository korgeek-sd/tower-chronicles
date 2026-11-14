import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {FirstTimeOnboarding} from '../src/components/intro/FirstTimeOnboarding';
import {CLASS_CATALOG} from '../src/game/classes/progression';
import {getOnboardingClassLabel} from '../src/components/intro/onboardingClassLabels';
import {onboardingClassKey,readOnboardingClass,saveOnboardingClass,storySeenKey,markOnboardingStorySeen,hasOnboardingStorySeen} from '../src/components/intro/firstTimeOnboardingState';

const makeStorage=()=>{
 const data=new Map<string,string>();
 return {data,storage:{
  getItem:(k:string)=>data.get(k)??null,
  setItem:(k:string,v:string)=>{data.set(k,v);},
  removeItem:(k:string)=>{data.delete(k);}
 }};
};

test('new account starts without a profession and class selection is immutable',()=>{
 const {storage,data}=makeStorage();
 assert.equal(readOnboardingClass('alice',storage),null);
 saveOnboardingClass('alice','mage',storage);
 assert.equal(readOnboardingClass('alice',storage),'mage');
 assert.equal(JSON.parse(data.get(onboardingClassKey('alice'))!).picks.length,10);
 saveOnboardingClass('alice','mage',storage);
 assert.throws(()=>saveOnboardingClass('alice','warrior',storage),/변경할 수 없습니다/);
 assert.equal(readOnboardingClass('bob',storage),null,'another account has no inherited profession');
});

test('class onboarding preserves existing growth data and can detect blocked storage',()=>{
 const {storage,data}=makeStorage();
 const key=onboardingClassKey('alice');
 data.set(key,JSON.stringify({classId:'archer',picks:[1,...Array(9).fill(null)],order:[0]}));
 saveOnboardingClass('alice','archer',storage);
 assert.equal(JSON.parse(data.get(key)!).picks[0],1,'existing talent choices must be kept');
 const denied={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(readOnboardingClass('alice',denied),null);
 assert.throws(()=>saveOnboardingClass('alice','warrior',denied),/blocked/);
 assert.deepEqual(Object.keys(CLASS_CATALOG),['warrior','mage','archer']);
});

test('story completion marker is scoped to the new account, separate from existing story key',()=>{
 const {storage,data}=makeStorage();
 assert.equal(hasOnboardingStorySeen(storage,'alice'),false);
 markOnboardingStorySeen(storage,'alice');
 assert.equal(hasOnboardingStorySeen(storage,'alice'),true);
 assert.equal(hasOnboardingStorySeen(storage,'bob'),false);
 assert.equal(data.get(storySeenKey('alice')),'1');
 assert.equal(data.get('tower-world-intro-v1'),undefined);
});

test('new onboarding uses localized image-only archival cards, parchment nickname form and existing story',()=>{
 const ui=readFileSync('src/components/intro/FirstTimeOnboarding.tsx','utf8');
 const css=readFileSync('src/components/intro/first-time-onboarding.css','utf8');
 const app=readFileSync('src/main.tsx','utf8');
 const intro=readFileSync('src/components/intro/GameEntry.tsx','utf8');
 assert.match(app,/import \{FirstTimeOnboarding\}/);
 assert.match(app,/if\(onlineSession&&!profileReady\)return <FirstTimeOnboarding/);
 assert.match(ui,/getOnboardingClassLabel\(id\)/);
 assert.match(ui,/\['warrior','mage','archer'\]/);
 assert.match(ui,/assetUrl\(ONBOARDING_CLASS_ART\[id\]\)/);
 assert.match(ui,/onRegister\(validation\.nickname\)/);
 assert.match(ui,/lockPermanentClass\(userId,selected\)/);
 assert.match(ui,/adoptPermanentClass\(userId,committed,localStorage\)/);
 assert.match(ui,/loadPermanentClass\(userId\)/);
 assert.match(ui,/onReady\(profile\)/);
 assert.match(ui,/hasOnboardingStorySeen\(/);
 assert.match(ui,/tower:replay-world-intro/);
 assert.match(ui,/tower:world-intro-finished/);
 assert.match(ui,/tc-first__class-card/);
 assert.match(ui,/tc-first__book/);
 assert.match(ui,/로그아웃/);
 assert.match(css,/\.tc-first__book\{/);
 assert.match(css,/\.tc-first__class-card\.is-selected/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/min-height:44px/);
 assert.match(intro,/WORLD_INTRO_PAGES/);
 assert.match(intro,/tower:world-intro-finished/);
 assert.match(intro,/current\.body\.split\('\\n\\n'\)/);
});


test('first-time class screen renders the real three class assets and an accessible selection action',()=>{
 const html=renderToStaticMarkup(React.createElement(FirstTimeOnboarding,{
  userId:'new-user',
  onRegister:async nickname=>({userId:'new-user',nickname}),
  onReady:()=>{},onLogout:()=>{}
 }));
 for(const id of ['전사','마법사','궁수'])assert.ok(html.includes(id),id);
 assert.equal((html.match(/class="tc-first__class-card tc-feel-press/g)??[]).length,3);
 for(const path of ['warrior-art-v2.svg','mage-art-v2.svg','archer-art-v2.svg'])assert.ok(html.includes(path),path);
 assert.equal((html.match(/class="tc-first__class-title"/g)??[]).length,3,'the three labels must render as actual text');
 assert.match(html,/aria-label="시작 직업 선택"/);
 assert.match(html,/선택 완료/);
 assert.match(html,/disabled=""/,'no class is implicitly chosen for a new player');
});


test('the three class backgrounds are text-free while titles remain localizable and accessible',()=>{
 const src=readFileSync('src/components/intro/FirstTimeOnboarding.tsx','utf8');
 const css=readFileSync('src/components/intro/first-time-onboarding.css','utf8');
 const overrides=css.split('/* approved onboarding class cards: 2026-11-14 */')[1];
 assert.ok(overrides,'scoped image-only art layout must exist');
 for(const name of ['warrior','mage','archer']){
  const original=readFileSync('public/assets/classes/onboarding/'+name+'-card-v1.webp');
  assert.ok(original.length>10000,name+' must retain the original approved painting');
  assert.equal(original.toString('ascii',0,4),'RIFF');
  assert.equal(original.toString('ascii',8,12),'WEBP');
  const svg=readFileSync('public/assets/classes/onboarding/'+name+'-art-v2.svg','utf8');
  assert.match(svg,/<clipPath id="scene">/,'hide the embedded title/icon region');
  assert.match(svg,/href="data:image\/webp;base64,/,'self-contained artwork should work when embedded as an image');
  assert.doesNotMatch(svg,/<text(?:\s|>)/,'no visible SVG text baked into the art');
  assert.ok(src.includes("'assets/classes/onboarding/"+name+"-art-v2.svg'"),name+' should use the image-only asset');
 }
 assert.equal(getOnboardingClassLabel('warrior'),'전사');
 assert.equal(getOnboardingClassLabel('mage','en'),'Mage');
 assert.equal(getOnboardingClassLabel('archer','en'),'Archer');
 assert.match(src,/aria-label=\{label\+' · '\+ROLES\[id\]\}/,'class selection must remain accessible');
 assert.match(src,/tc-first__class-title/,'real text should render on top of each class artwork');
 assert.doesNotMatch(src,/tc-first__choice-check/,'no extra check badge at the bottom-right corner');
 assert.match(overrides,/\.tc-first__portrait img\{[^}]*object-fit:contain/,'preserve the complete vertical art without stretching');
 assert.match(overrides,/\.tc-first__class-title\{/,'show translated class labels independently from images');
 assert.match(overrides,/\.tc-first__class-card\.is-selected\{/,'selected card should remain visibly distinct');
});
