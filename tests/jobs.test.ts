import test from 'node:test';import assert from 'node:assert/strict';
import {JOB_CATALOG,JOB_RARITIES,jobsByRarity,validateCombatKit,validateJobCatalog} from '../src/game/jobs/catalog';
import {grantJob,ownsJob,resolveBattleJobId,setCurrentJob} from '../src/game/jobs/service';
import {createJobRuntime} from '../src/game/jobs/runtime';
import {initialState} from '../src/game/engine/state';import {enter} from '../src/game/engine/expedition';import {createRepository,SAVE_KEY} from '../src/storage/repository';
import {withHistoricalTickets} from './legacyFixture.ts';

const EXPECTED_COUNTS={C:8,B:10,A:12,SR:11,SSR:7} as const;
const EXPANSION_JOBS=[
 ['green_crown_pilgrim','녹관 순례자'],['porter','짐꾼'],['guide','길잡이'],
 ['relic_collector','유품회수인'],['monster_dismantler','몬스터 해체꾼'],['expedition_archivist','탐사기록원'],
 ['ascetic_priest','고행사제'],['life_stitcher','생명봉합사'],['subjugation_officer','토벌관'],['rescuer','구조대원'],['quartermaster','보급관'],['coroner','검시관'],['stair_scout','층계척후'],
 ['green_crown_martyr','녹관의 수난자'],['unity_apostle','귀일사도'],['deep_rescue_officer','심층구조관'],['boss_tracker','보스추적자'],['return_guardian','귀환수호자'],['green_crown_inquisitor','녹관 이단심문관'],
 ['false_saint_proxy','거짓 성자의 대리인'],['hundred_battle_returnee','백전귀환자'],
] as const;

test('직업 01-03: 카탈로그는 48개이며 등급별 8/10/12/11/7개, ID와 이름이 고유하고 확장 21종을 포함한다',()=>{assert.equal(validateJobCatalog(),true);assert.equal(JOB_CATALOG.length,48);for(const rarity of JOB_RARITIES)assert.equal(jobsByRarity(rarity).length,EXPECTED_COUNTS[rarity]);assert.equal(new Set(JOB_CATALOG.map(job=>job.id)).size,48);assert.equal(new Set(JOB_CATALOG.map(job=>job.displayName)).size,48);assert.equal(JOB_CATALOG.filter(job=>job.implementationStatus==='COMBAT_READY').length,5);assert.equal(JOB_CATALOG.filter(job=>job.implementationStatus==='CATALOG_ONLY').length,43);for(const [id,displayName] of EXPANSION_JOBS){const job=JOB_CATALOG.find(candidate=>candidate.id===id);assert.equal(job?.displayName,displayName);assert.equal(job?.implementationStatus,'CATALOG_ONLY');}});
test('직업 04-08: 지급은 멱등이고 보유 직업만 원정 밖에서 선택한다',()=>{const base=initialState(),first=grantJob(base,'hunter'),second=grantJob(first.state,'hunter');assert.equal(first.status,'granted');assert.equal(second.status,'alreadyOwned');assert.equal(second.state.ownedJobIds.length,1);assert.equal(setCurrentJob(base,'hunter').currentJobId,null);const selected=setCurrentJob(first.state,'hunter');assert.equal(selected.currentJobId,'hunter');const active=enter(selected,'ore',1);assert.equal(setCurrentJob(active,null).currentJobId,'hunter');assert.match(setCurrentJob(active,null).notice,/원정 중/);assert.equal(ownsJob(active,'hunter'),true);});
test('직업 09-10: 원정은 직업 ID를 고정하고 전투는 스냅샷을 우선한다',()=>{let state=grantJob(initialState(),'hunter').state;state=setCurrentJob(state,'hunter');state=enter(state,'ore',1);assert.equal(state.expedition?.jobSnapshotId,'hunter');state.currentJobId=null;assert.equal(resolveBattleJobId(state),'hunter');});
test('직업 11-15: TEST_JOB의 패시브 2, 액티브 3, 별도 자원 런타임을 연결한다',()=>{const kit={passiveIds:['p1','p2'],activeSkillIds:['a1','a2','a3']} as const;assert.equal(validateCombatKit(kit as any,new Set(['p1','p2']),new Set(['a1','a2','a3'])),true);const runtime=createJobRuntime({id:'test_job',displayName:'TEST_JOB',rarity:'C',implementationStatus:'COMBAT_READY',combatKit:kit as any,jobResource:{id:'test_resource',initialValue:0,maxValue:3}});assert.deepEqual(runtime.passiveIds,['p1','p2']);assert.deepEqual(runtime.activeSkillIds,['a1','a2','a3']);assert.deepEqual(runtime.resource,{id:'test_resource',value:0,maxValue:3});});
test('직업 16-18: v15 저장은 직업 없는 최신 v21 저장으로 이전하며 플레이 기록을 보존한다',()=>{const old:any=withHistoricalTickets(initialState());old.version=15;delete old.ownedJobIds;delete old.currentJobId;const map=new Map([[SAVE_KEY,JSON.stringify(old)]]);const storage={getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>void map.set(key,value)};const loaded=createRepository(storage).load();assert.equal(loaded.version,23);assert.deepEqual(loaded.ownedJobIds,[]);assert.equal(loaded.currentJobId,null);assert.equal(loaded.silver,old.silver);});
