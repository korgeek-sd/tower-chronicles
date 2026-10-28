import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=()=>readFileSync('supabase/migrations/20261028092848_character_growth_overview.sql','utf8');
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
import {APPEARANCE_SETS,type AppearanceSet} from '../src/game/data/appearanceSets';

test('growth sums sources to the server final value and keeps collection proposals out of combat',()=>{
 const d=characterGrowthFixture(),set:AppearanceSet={id:'test-collection',name:'검증 컬렉션',description:'검증',appearanceIds:['corsair','teddy'],equipment:{kind:'outer_guard_longbow',grade:'uncommon'},rarity:'B',reward:{stat:'attack',value:2}};
 d.collection.unlockedAppearanceIds=[...set.appearanceIds];d.collection.registeredSetIds=[set.id];
 assert.equal(characterGrowthSummary(d).collection.total,APPEARANCE_SETS.length);
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
 for(const text of ['성장 현황','검증 캐릭터','42','전투','수호','공격력 구성','컬렉션','적용 예정','현재 전투 능력치에는 미적용','협회 보급 철검','음식 제외'])assert.ok(html.includes(text),text);
 assert.match(html,/공격력 43.2 상세 보기/);
 const failed=renderToStaticMarkup(React.createElement(CharacterGrowthScreen,{...props,data:null,error:'조회 실패'}));
 assert.match(failed,/조회 실패/);assert.match(failed,/다시 확인/);assert.doesNotMatch(failed,/Lv\. 1|2,400|최종 능력치/);
 const main=readFileSync('src/main.tsx','utf8');assert.match(main,/page==='character'&&<CharacterGrowthPage/);
 const page=readFileSync('src/components/growth/CharacterGrowthPage.tsx','utf8');assert.match(page,/snapshot\?\.identity===identity/);assert.match(page,/active=false/);
});
