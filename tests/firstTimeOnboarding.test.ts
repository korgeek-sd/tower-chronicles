import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {FirstTimeOnboarding} from '../src/components/intro/FirstTimeOnboarding';
import {CLASS_CATALOG} from '../src/game/classes/progression';
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

test('new onboarding uses approved archival job cards, parchment nickname form and existing story',()=>{
 const ui=readFileSync('src/components/intro/FirstTimeOnboarding.tsx','utf8');
 const css=readFileSync('src/components/intro/first-time-onboarding.css','utf8');
 const app=readFileSync('src/main.tsx','utf8');
 const intro=readFileSync('src/components/intro/GameEntry.tsx','utf8');
 assert.match(app,/import \{FirstTimeOnboarding\}/);
 assert.match(app,/if\(onlineSession&&!profileReady\)return <FirstTimeOnboarding/);
 assert.match(ui,/CLASS_CATALOG\[id\]/);
 assert.match(ui,/\['warrior','mage','archer'\]/);
 assert.match(ui,/assetUrl\(job\.art\)/);
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
 for(const path of ['contract_mercenary.webp','soulcaster.webp','hunter.webp'])assert.ok(html.includes(path),path);
 assert.match(html,/aria-label="시작 직업 선택"/);
 assert.match(html,/선택 완료/);
 assert.match(html,/disabled=""/,'no class is implicitly chosen for a new player');
});
