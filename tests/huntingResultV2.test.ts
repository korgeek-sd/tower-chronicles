import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';
import {initialState} from '../src/game/engine/state';
import {initialHuntingState,resolveHunt,type HuntResult} from '../src/game/hunting/model';

const sample=()=>resolveHunt(initialHuntingState(0),'plains',{hp:602,attack:280,defense:40},['heavy'],0,()=>0).state;
function render(result:HuntResult){
 const hunting={...sample(),lastResult:result,vitality:525,currentHp:602,currentMp:100,maxMp:100};
 return renderToStaticMarkup(React.createElement(HuntingScreen,{
  game:initialState(),hunting,now:0,busy:false,nickname:'기크',onHunt:()=>{},onSettings:()=>{}
 }));
}
test('hunting result uses actual victory, XP, silver, mastery and potion figures',()=>{
 const first=sample().lastResult!;
 const result={...first,outcome:'victory' as const,exp:110,silver:1044,mastery:1,
  playerHp:287,recoveredHp:602,potionsUsed:315,equipment:null,monsterHp:0};
 const before=JSON.stringify(result);
 const html=render(result);
 for(const text of ['tc-hunt-result-page tc-hunt-result-v2','tc-hunt-outcome-banner is-victory','전투 승리',
 '기크','획득 보상','+110','+1,044','+315 회복','315개 사용','장비 획득 없음',
 '활력','525','사냥터 변경','다음 전투','전체 기록 보기'])assert.ok(html.includes(text),text);
 assert.equal(JSON.stringify(result),before);
});
test('defeat shows no reward and never guesses missing potion data',()=>{
 const first=sample().lastResult!;
 const result={...first,outcome:'defeat' as const,exp:0,silver:0,mastery:0,equipment:null,
  potionsUsed:undefined,recoveredHp:undefined,playerHp:0};
 const html=render(result);
 for(const text of ['tc-hunt-outcome-banner is-defeat','전투 패배','획득 보상 없음',
  'HP 물약 <strong>기록 없음','전투 후 HP <strong>기록 없음'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('실버</span><strong>+'));
});
test('battle preview displays only last three turns but full history retains all lines',()=>{
 const first=sample().lastResult!;
 const result={...first,turns:[
  {turn:1,playerHp:602,monsterHp:180,lines:['탐사자의 강타! 20 피해']},
  {turn:2,playerHp:582,monsterHp:145,lines:['빈손 허수아비 반격! 8 피해']},
  {turn:3,playerHp:570,monsterHp:70,lines:['탐사자의 속공! 75 피해']},
  {turn:4,playerHp:555,monsterHp:0,lines:['빈손 허수아비 처치!']}
 ]};
 const html=render(result);
 const preview=html.split('<ol class="tc-hunt-stream-preview"')[1]?.split('</ol>')[0]??'';
 assert.equal((preview.match(/<li /g)??[]).length,3);
 assert.ok(!preview.includes('1턴'));
 for(const turn of ['2턴','3턴','4턴'])assert.ok(preview.includes(turn),turn);
 assert.ok(html.includes('검사의 강타!')===false);
 assert.ok(html.includes('기크의 강타! 20 피해'));
 assert.ok(html.includes('aria-label="전체 사냥 전투 기록"'));
 assert.ok(html.includes('role="log"'));
 assert.ok(html.includes('tabindex="0"'));
 assert.ok(html.includes('최근 10회'));
});
test('new result-only CSS provides viewport grid, fixed actions and modal history',()=>{
 const css=readFileSync(new URL('../src/components/hunting/hunting-result-v2.css',import.meta.url),'utf8');
 const page=readFileSync(new URL('../src/components/hunting/HuntingPage.tsx',import.meta.url),'utf8');
 const screen=readFileSync(new URL('../src/components/hunting/HuntingScreen.tsx',import.meta.url),'utf8');
 assert.ok(page.includes("import './hunting-result-v2.css'"));
 for(const rule of ['tc-hunt-result-page.tc-hunt-result-v2','tc-hunt-result-fighters','tc-hunt-reward-grid','tc-hunt-stream-preview','align-content:start','tc-hunt-stream-dialog[open]','max-height:565px'])assert.ok(css.includes(rule),rule);
 assert.ok(screen.includes('onClick={()=>startHunt(map.id)}'));
 assert.ok(screen.includes('disabled={huntingNow||!state||state.vitality<1||!!game.expedition}'));
 assert.ok(screen.includes('setExpanded(current=>current===m.id?null:m.id)'));
});


test('real five-row visual order overrides old combat-stream grid placements',()=>{
 const css=readFileSync(new URL('../src/components/hunting/hunting-result-v2.css',import.meta.url),'utf8');
 const legacy=readFileSync(new URL('../src/components/hunting/combat-stream.css',import.meta.url),'utf8');
 const screen=readFileSync(new URL('../src/components/hunting/HuntingScreen.tsx',import.meta.url),'utf8');
 const resultMarkup=screen.slice(screen.indexOf('  <section className="tc-hunt-result-page'));
 const positions=[
  ['tc-hunt-outcome-banner','outcome',1],
  ['tc-hunt-result-fighters','fighters',2],
  ['tc-hunt-result-rewards','rewards',3],
  ['<HuntingCombatLog','history',4],
  ['tc-hunt-repeat-dock','actions',5]
 ] as const;
 let prev=-1;
 for(const [element,area,row] of positions){
  const index=resultMarkup.indexOf(element);
  assert.ok(index>prev,element+' must follow the preceding block in the HTML');
  prev=index;
  assert.ok(css.includes('grid-area:'+area+';grid-column:1;grid-row:'+row),element+' must be visually anchored to row '+row);
 }
 assert.match(css,/grid-template-areas:"outcome" "fighters" "rewards" "history" "actions"/);
 assert.match(legacy,/\.tc-hunt-stream\{grid-column:1 \/ -1;grid-row:2/);
 assert.match(legacy,/\.tc-hunt-repeat-dock\{grid-row:3/);
 const hero=css.match(/\.tc-hunt\[data-view="result"\] \.tc-hunt-result-v2>\.tc-hunt-stream\{([^}]+)\}/)?.[1]??'';
 const actions=css.match(/\.tc-hunt\[data-view="result"\] \.tc-hunt-result-v2>\.tc-hunt-repeat-dock\{([^}]+)\}/)?.[1]??'';
 assert.match(hero,/grid-row:4/);
 assert.match(actions,/grid-row:5/);
});
