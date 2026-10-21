import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {EntryConnectionScreen,connectionErrorMessage} from '../src/components/intro/EntryConnectionScreen';
const render=(stage:'account'|'session'|'record',error='')=>renderToStaticMarkup(React.createElement(EntryConnectionScreen,{stage,error,onRetry:()=>{},onLogout:()=>{}}));
test('connection screen reflects real stages without invented percent completion',()=>{
 for(const stage of ['account','session','record'] as const){const html=render(stage);assert.match(html,/role="status"/);assert.match(html,/aria-current="step"/);assert.doesNotMatch(html,/다시 시도|progressbar/);}
 assert.match(render('account'),/계정 확인 중/);assert.match(render('record'),/기록을 불러오는 중/);
});
test('failed load exposes a retry while keeping account exit available',()=>{
 const html=render('record','기록을 불러오지 못했습니다.');
 assert.match(html,/role="alert"/);assert.match(html,/다시 시도/);assert.match(html,/로그아웃/);
});
test('initial entry waits for the authoritative restore result and ignores obsolete leases',()=>{
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(main,/void loadEntryRecord\(result.lease\)/);
 assert.match(main,/entryLoadStatus!=='ready'/);
 assert.match(main,/const restored=await restoreServerRun\(lease\)/);
 assert.match(main,/entryLoadOwner.current!==owner/);
 assert.match(main,/async function restoreServerRun\(lease:GameplayLease\):Promise<boolean>/);
});
test('enter button validates remembered session and prevents duplicate requests',()=>{
 const source=readFileSync(new URL('../src/components/intro/StartScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/async function enter\(\)/);
 assert.match(source,/await getFreshSession\(\)/);
 assert.match(source,/계정 확인 중…/);
 assert.match(source,/if\(pending.current\)return/);
});

test('technical connection failures become actionable user messages',()=>{
 assert.match(connectionErrorMessage(Error('AUTH_USER_UNVERIFIED')),/로그인/);
 assert.match(connectionErrorMessage(Error('request timed out')),/서버 응답/);
 assert.doesNotMatch(connectionErrorMessage(Error('SQLSTATE internal-query-id')),/SQLSTATE|internal-query/);
});
