import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {createAssociation} from '../src/game/association/service';
import {grantJob} from '../src/game/jobs/service';
import {AssociationScreen} from '../src/components/association/AssociationScreen';
import {JobsScreen} from '../src/components/JobsScreen';

function associationWithRecords(){
  let game=initialState();
  game.market.traderCertified=true;
  game.silver=5000;
  game=createAssociation(game,{name:'검은등불',description:'심층 탐사 조합',joinPolicy:'APPROVAL'},1000);
  const current=game.association.associations[0];
  current.members=[
    {playerId:game.market.ownerId,role:'LEADER',joinedAt:1000},
    ...Array.from({length:8},(_,i)=>({playerId:'member-'+(i+1),role:'MEMBER' as const,joinedAt:1100+i})),
  ];
  current.activityLog=Array.from({length:9},(_,i)=>({at:2000+i,text:'활동 '+(i+1)}));
  return game;
}

test('joined association exposes summary members activity and manage tabs',()=>{
  const html=renderToStaticMarkup(React.createElement(AssociationScreen,{
    game:associationWithRecords(),
    setGame:()=>{},
  }));
  for(const label of ['요약','조합원','활동','관리'])assert.match(html,new RegExp(label));
  assert.match(html,/aria-selected="true"/);
  assert.doesNotMatch(html,/활동 9/);
});

test('association source paginates members and activity instead of rendering every row',()=>{
  const source=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');
  assert.match(source,/pageSizeFor\('association'/);
  assert.match(source,/pageSlice\(/);
  assert.match(source,/PageStepper/);
});

test('not-joined association view separates find and create instead of stacking the full form',()=>{
  const game=initialState();
  const html=renderToStaticMarkup(React.createElement(AssociationScreen,{game,setGame:()=>{}}));
  assert.match(html,/조합 찾기/);
  assert.match(html,/조합 창설/);
  assert.equal((html.match(/<textarea/g)||[]).length,0);
});

test('jobs screen shows one rarity at a time and five standard-height cards',()=>{
  const html=renderToStaticMarkup(React.createElement(JobsScreen,{
    game:initialState(),
    setGame:()=>{},
  }));
  for(const rarity of ['C','B','A','SR','SSR'])assert.match(html,new RegExp('>'+rarity+'<'));
  assert.equal((html.match(/class="job-card/g)||[]).length,5);
  assert.doesNotMatch(html,/선봉 탐사자/);
});

test('jobs screen keeps job changes locked during an expedition',()=>{
  let game=grantJob(initialState(),'hunter').state;
  game.currentJobId='hunter';
  game.expedition={} as any;
  const html=renderToStaticMarkup(React.createElement(JobsScreen,{game,setGame:()=>{}}));
  assert.match(html,/원정 잠금/);
});

test('jobs source uses mobile pagination and a shared detail sheet',()=>{
  const source=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
  assert.match(source,/pageSizeFor\('jobs'/);
  assert.match(source,/pageSlice\(/);
  assert.match(source,/BottomSheet/);
  assert.match(source,/PageStepper/);
});
