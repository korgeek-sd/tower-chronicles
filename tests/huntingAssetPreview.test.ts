import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {assetUrl,playerGraphicForJob} from '../src/game/data/graphics';
import {initialState} from '../src/game/engine/state';
import {initialHuntingState,resolveHunt} from '../src/game/hunting/model';
import {HUNT_MONSTERS} from '../src/game/hunting/encounters';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';

test('grave-digging hound loads exact newly imported PNG, retaining server encounter metadata',()=>{
 const monster=HUNT_MONSTERS.plains[0];
 assert.equal(monster.name,'무덤파는 들개');
 assert.equal(monster.image,'assets/monsters/new/plains/grave_digger_hound.svg');
 assert.match(assetUrl(monster.image),/^\.\/assets\/monsters\/new\/plains\/grave_digger_hound\.png\?v=/);
 assert.ok(existsSync(new URL('../public/assets/monsters/new/plains/grave_digger_hound.png',import.meta.url)));
 assert.ok(existsSync(new URL('../public/assets/characters/preview/grave_hound_job_reference.jpg',import.meta.url)));
});
test('preview link compares supplied job and actual hound in hunting screen, without changing normal class selection',()=>{
 const shared={game:initialState(),hunting:initialHuntingState(0),now:0,busy:false,onHunt:()=>{},onSettings:()=>{}};
 const preview=renderToStaticMarkup(React.createElement(HuntingScreen,{...shared,previewAppearance:true}));
 const normal=renderToStaticMarkup(React.createElement(HuntingScreen,{...shared,previewAppearance:false}));
 assert.match(preview,/외형 비교 미리보기/);
 assert.match(preview,/무덤파는 들개 · 직업 외형 비교/);
 assert.match(preview,/assets\/characters\/preview\/grave_hound_job_reference.jpg/);
 assert.match(preview,/assets\/monsters\/new\/plains\/grave_digger_hound.png/);
 const hound=HUNT_MONSTERS.plains[0];
 assert.match(preview,/aria-label="무덤파는 들개 몬스터 정보"/);
 assert.match(preview,new RegExp('<h2>'+hound.name+'</h2>'));
 assert.match(preview,new RegExp('<span>공격 <b>'+hound.attack+'</b></span>'));
 assert.match(preview,new RegExp('<span>방어 <b>'+hound.defense+'</b></span>'));
 assert.match(preview,new RegExp('aria-label="'+hound.name+' 미리보기 HP"[^>]*aria-valuemax="'+hound.hp+'"[^>]*aria-valuenow="'+hound.hp+'"'));
 assert.match(preview,/외곽 평야 · 기본 능력치/);
 assert.doesNotMatch(normal,/무덤파는 들개 미리보기 HP/);
 assert.doesNotMatch(normal,/외형 비교 미리보기/);
 assert.doesNotMatch(normal,/assets\/characters\/preview\/grave_hound_job_reference.jpg/);
});

test('active selected job is used in normal hunting battles; image comparison is accessible in both result and region views',()=>{
 const game={...initialState(),currentJobId:'duelist'};
 const hunting=initialHuntingState(0);
 const normal=renderToStaticMarkup(React.createElement(HuntingScreen,{game,hunting,now:0,busy:false,onHunt:()=>{},onSettings:()=>{},previewAppearance:false}));
 assert.match(normal,/외형 비교/);
 assert.doesNotMatch(normal,/외형 비교 미리보기/);
 assert.equal(playerGraphicForJob('duelist',game.cosmetics.selectedAppearanceId).image.idle,'assets/characters/jobs/duelist.webp');
 assert.match(normal,/assets\/characters\/jobs\/duelist\.webp/);
 assert.match(normal,/aria-pressed="false"/);

});

test('grave-digging hound battle uses the provided job reference beside the enemy image',()=>{
 const state=resolveHunt(initialHuntingState(0),'plains',{hp:900,attack:300,defense:80},['heavy'],0,()=>0).state;
 assert.equal(state.lastResult?.monster?.id,'grave_digger_hound');
 const game={...initialState(),currentJobId:'duelist'};
 const markup=renderToStaticMarkup(React.createElement(HuntingScreen,{game,hunting:state,now:0,busy:false,onHunt:()=>{},onSettings:()=>{},previewAppearance:false}));
 const resultSection=markup.match(/<section class="tc-hunt-result-page"[^>]*>.*?<article[^>]*data-monster-id=/)?.[0]??'';
 assert.match(resultSection,/assets\/characters\/preview\/grave_hound_job_reference.jpg/);
 assert.doesNotMatch(resultSection,/assets\/characters\/jobs\/duelist.webp/);
});

test('actual compact monster panel shows name, ATK, DEF and HP before any skill details',()=>{
 const h=resolveHunt(initialHuntingState(0),'plains',{hp:900,attack:300,defense:80},['heavy'],0,()=>0).state;
 const result=h.lastResult!;
 const markup=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting:h,now:0,busy:false,onHunt:()=>{},onSettings:()=>{},previewAppearance:false}));
 const card=markup.match(/<article[^>]*data-monster-id="[^"]+"[^>]*>.*?<\/article>/)?.[0]??'';
 assert.ok(card.length>0,'opponent card must render');
 const posName=card.indexOf('<h2>'+result.monster!.name+'</h2>');
 const posStats=card.indexOf('공격 <b>'+result.monster!.attack+'</b>');
 const posHP=card.indexOf('aria-label="'+result.monster!.name+' HP"');
 assert.ok(posName>=0&&posStats>posName&&posHP>posStats,'monster name/stats/HP must appear in that order');
 assert.match(card,/스킬 보기/);
 assert.doesNotMatch(card,/tc-hunt-monster-skill/);
 assert.match(markup,/aria-label="[^"]+ 스킬 정보"/);
 assert.match(markup,/몬스터 스킬/);
 for(const skill of result.monster!.skills)assert.ok(markup.includes(skill.name));
});
