import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {GrowthRecordScreen} from '../src/components/growth/GrowthRecordScreen';
import {growthMasteryProgress,loadGrowthRecord} from '../src/components/growth/growthRecord';
import {initialHuntingState,huntingExperienceForLevel} from '../src/game/hunting/model';
const hunting={...initialHuntingState(),experience:huntingExperienceForLevel(42)+90024,statPoints:5};
const life:any={lifeMasteries:{herb:570,farm:1260,ticket:330}};
const props={nickname:'실제 이름',hunting,life,loading:false,onClose:()=>{},onStats:()=>{},onProduction:()=>{},onCraft:()=>{},onRetry:()=>{}};

test('growth record shows real character progress, points and three independent life tracks',()=>{
 const html=renderToStaticMarkup(React.createElement(GrowthRecordScreen,props));
 for(const text of ['실제 이름','Lv.42','55,176','미사용 능력치','약초','농업','도전권 제작','120 / 250','260 / 400','80 / 200','130 EXP','140 EXP','120 EXP'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/data-growth-track=/g)??[]).length,3);
 assert.match(html,/aria-expanded="false"[^>]*aria-controls="growth-detail-herb"/);
 assert.match(html,/Lv.5 · 제작량 \+13%/);
 assert.match(html,/약초 채집 · 회복 포션 제작/);
 assert.match(html,/스탯 분배/);assert.match(html,/생산하기/);assert.match(html,/제작 공방/);
});

test('mastery progress uses each level interval and caps without inventing another level',()=>{
 assert.deepEqual(growthMasteryProgress(570),{level:4,earned:120,required:250,remaining:130,percent:48,bonus:10,nextBonus:13});
 const cap=growthMasteryProgress(99999)!;assert.equal(cap.level,10);assert.equal(cap.remaining,0);assert.equal(cap.percent,100);assert.equal(cap.nextBonus,null);assert.equal(cap.bonus,30);
 assert.equal(growthMasteryProgress(undefined),null);assert.equal(growthMasteryProgress(NaN),null);
 const html=renderToStaticMarkup(React.createElement(GrowthRecordScreen,{...props,hunting:{...hunting,experience:huntingExperienceForLevel(100)},life:{...life,lifeMasteries:{herb:3200,farm:3200,ticket:3200}}}));
 assert.match(html,/최대 숙련/);assert.match(html,/최고 레벨 달성/);assert.doesNotMatch(html,/Lv.11|NaN|Infinity/);
});

test('unavailable data remains unknown and failed sections offer retry',()=>{
 const html=renderToStaticMarkup(React.createElement(GrowthRecordScreen,{...props,hunting:null,life:null,loading:false,huntingError:'캐릭터 정보를 불러오지 못했습니다.',lifeError:'생활 숙련도를 불러오지 못했습니다.'}));
 assert.doesNotMatch(html,/Lv\.1(?!\d)|제작량 \+0%|미사용 능력치[^]*?>0</);
 assert.match(html,/다시 확인/);assert.match(html,/role="alert"/);
 const partial=renderToStaticMarkup(React.createElement(GrowthRecordScreen,{...props,life:null,lifeError:'생활 숙련도를 불러오지 못했습니다.'}));
 assert.match(partial,/Lv.42/);assert.doesNotMatch(partial,/제작량 \+0%/);
});

test('growth reads both existing state endpoints concurrently and preserves partial success',async()=>{
 const lease:any={leaseId:'test',generation:1,clientInstanceId:'test'};
 let huntingStarted=false,lifeStarted=false;
 const result=await loadGrowthRecord(lease,async()=>{huntingStarted=true;await Promise.resolve();assert.ok(lifeStarted);return hunting;},async()=>{lifeStarted=true;assert.ok(huntingStarted);throw Error('offline');});
 assert.equal(result.hunting,hunting);assert.equal(result.life,null);assert.ok(result.lifeError);assert.equal(result.huntingError,'');
});

test('growth is reachable from home and production opens gathering directly',()=>{
 const home=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 assert.match(home,/aria-label="성장 현황 열기"[^>]*onClick=\{\(\)=>onMove\('character'\)\}/);
 assert.match(home,/name:'성장 기록'/);
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(main,/page==='growth'&&<GrowthRecordPage/);
 assert.match(main,/page==='production'\?'life'/);
});
