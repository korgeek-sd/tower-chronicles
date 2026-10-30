import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=()=>readFileSync('supabase/migrations/20261028092848_character_growth_overview.sql','utf8');
const collectionSql=()=>readFileSync('supabase/migrations/20261030201500_independent_record_collections.sql','utf8');
test('growth snapshot is player-scoped, read-only and uses authoritative combat stats',()=>{
 const source=sql();
 assert.match(source,/require_active_game_session/);
 assert.match(source,/private\.combat_equipment_stats\(u,p\)/);
 assert.match(source,/private\.fixed_equipment_stats/);
 assert.match(source,/collection_equipment_registrations/);
 assert.match(source,/'applied',false/);
 assert.match(source,/revoke all on function public\.get_character_growth/);
 assert.match(source,/grant execute on function public\.get_character_growth[^;]+to authenticated/);
 assert.doesNotMatch(source,/\b(insert into|update private\.|delete from|alter table)\b/i);
});

import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {characterGrowthSummary,growthBreakdown} from '../src/components/growth/characterGrowth';
import {CharacterGrowthScreen} from '../src/components/growth/CharacterGrowthScreen';
import {characterGrowthFixture} from './characterGrowthFixture';
import {RECORD_COLLECTION_SETS,type RecordCollectionSet} from '../src/game/data/recordCollections';

test('growth sums sources to the server final value and reports non-applied fixture bonuses as pending',()=>{
 const d=characterGrowthFixture(),set:RecordCollectionSet={id:'test-collection',kind:'appearance',name:'검증 컬렉션',description:'검증',appearanceIds:['corsair','teddy'],rarity:'B',reward:{stat:'attack',value:2}};
 d.collection.unlockedAppearanceIds=[...set.appearanceIds];d.collection.registeredSetIds=[set.id];
 assert.equal(characterGrowthSummary(d).collection.total,RECORD_COLLECTION_SETS.length);
 const s=characterGrowthSummary(d,[set]);assert.equal(s.progress.level,42);assert.equal(s.points,29);
 assert.equal(s.collection.completed,1);assert.equal(s.collection.planned[set.reward.stat],set.reward.value);
 for(const key of ['hp','attack','defense','critChance','critDamage','armorPenetration','mp'] as const){
  const b=growthBreakdown(d,key);assert.ok(Math.abs(b.rows.reduce((sum,row)=>sum+row.value,0)-b.final)<1e-8);
  assert.equal(b.rows.find(r=>r.id==='collection')?.value,0);
 }
 const attack=growthBreakdown(d,'attack');assert.equal(attack.rows.find(r=>r.id==='equipment')?.value,30);
 assert.ok(Math.abs(attack.rows.find(r=>r.id==='association')!.value-42*.0085)<1e-8);
 assert.ok(Math.abs(attack.rows.find(r=>r.id==='appearance')!.value-42*1.0085*.02)<1e-8);
});

test('overview shows actual values, equipment, seals and explicitly pending collection bonuses',()=>{
 const noop=()=>{},props={data:characterGrowthFixture(),nickname:'검증 캐릭터',loading:false,onRetry:noop,onClose:noop,onStats:noop,onEquipment:noop,onSeals:noop,onCollection:noop,onGrowthRecord:noop};
 const html=renderToStaticMarkup(React.createElement(CharacterGrowthScreen,props));
 for(const text of ['성장 현황','검증 캐릭터','42','전투','수호','공격력 구성','컬렉션','영구 적용','전투 능력치에 반영','협회 보급 철검','음식 제외'])assert.ok(html.includes(text),text);
 assert.match(html,/공격력 43.2 상세 보기/);
 const failed=renderToStaticMarkup(React.createElement(CharacterGrowthScreen,{...props,data:null,error:'조회 실패'}));
 assert.match(failed,/조회 실패/);assert.match(failed,/다시 확인/);assert.doesNotMatch(failed,/Lv\. 1|2,400|최종 능력치/);
 const main=readFileSync('src/main.tsx','utf8');assert.match(main,/page==='character'&&<CharacterGrowthPage/);
 const page=readFileSync('src/components/growth/CharacterGrowthPage.tsx','utf8');assert.match(page,/snapshot\?\.identity===identity/);assert.match(page,/active=false/);
});


test('growth overview fits a mobile viewport without scrolling or hiding navigation',()=>{
 const css=readFileSync('src/components/growth/character-growth.css','utf8');
 const first=css.match(/\.tc-character-content\{[^}]*\}/)?.[0]??'';
 assert.match(first,/overflow:hidden/,'the growth overview must not scroll');
 assert.doesNotMatch(first,/overflow-y:(auto|scroll)/,'a scrolling overview is a regression');
 assert.match(css,/\.tc-character-metrics\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,'all final stats must share one compact row');
 assert.match(css,/\.tc-character-metrics\{[^}]*grid-template-rows:minmax\(44px,1fr\)/);
 assert.match(css,/@container character-growth \(max-height:560px\)/);
 assert.match(css,/@container character-growth \(max-height:480px\)/);
 assert.doesNotMatch(css,/\.tc-character-(?:tabs|actions)\{display:none\}/,'tabs and footer buttons must remain on-screen');
 const templates=[...css.matchAll(/\.tc-character-content\{[^}]*grid-template-rows:([^;}]+)/g)].map(match=>match[1].trim().split(/\s+/));
 assert.equal(templates.length,3,'base, compact and short-viewport layouts are required');
 for(const tracks of templates){
  assert.equal(tracks.length,7,'all seven overview sections must have their own grid row');
  assert.ok(tracks.every(track=>track.includes('px')),'all grid tracks must have predictable minimum heights');
 }
 const minHeight=(tracks:string[])=>tracks.reduce((sum,track)=>{
  const match=track.match(/^(?:minmax\()?([0-9]+)px/);
  assert.ok(match,'unable to determine minimum row height: '+track);
  return sum+Number(match[1]);
 },0);
 assert.ok(minHeight(templates[1])+6*3+2*4+42<=560,'compact grid must fit a 560px page');
 assert.ok(minHeight(templates[2])+6*2+2*3+40<=480,'short grid must fit a 480px page');
});


test('collection migration applies bonuses to combat using server-owned unlock and item ledgers',()=>{
 const source=collectionSql();
 assert.match(source,/private\.record_collection_bonus\(p_user\)/);
 assert.match(source,/appearance_ownership/);
 assert.match(source,/collection_equipment_registrations/);
 assert.match(source,/enhancement_level>=1/);
 assert.match(source,/'collection',jsonb_build_object\('applied',true/);
 assert.match(source,/attack:=attack\+coalesce/);
});
