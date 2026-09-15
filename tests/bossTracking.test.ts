import {postBattle,resolveEvent,continueEvent} from '../src/game/events/service';
import {EVENT_BALANCE} from '../src/game/events/selector';
import {basicAttack} from '../src/game/engine/combat';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter,leave} from '../src/game/engine/expedition.ts';
import {tick} from '../src/game/engine/combat.ts';
import {advanceBossTracking,BOSS_TRACKING_BALANCE,challengeBoss,declineBoss,initialBossTracking} from '../src/game/engine/bossTracking.ts';
import {BOSS_TRACKING_BACKUP_KEY,SAVE_KEY,createRepository,migrateV5,validSave} from '../src/storage/repository.ts';

const bossRun=()=>{const s=initialState();s.tickets.ore[9]=2;return enter(s,'ore',10);};
const v5=(active=true)=>{const s:any=active?bossRun():initialState();s.version=5;if(s.expedition)delete s.expedition.bossTracking;return s;};
const memory=(raw?:string)=>{const mem=new Map<string,string>();if(raw)mem.set(SAVE_KEY,raw);return {mem,repo:createRepository({getItem:k=>mem.get(k)??null,setItem:(k,v)=>void mem.set(k,v)})};};
test('보스 저장 01-04: v5→v6은 영구 상태와 진행 원정을 보존하고 추적 기본값만 추가한다',()=>{const old=v5();old.silver=123;old.cosmetics.selectedAppearanceId='default';old.expedition.hp=91;old.expedition.monster.currentHp=17;old.expedition.time=8;old.expedition.loot.silver=39;const n=migrateV5(old);assert.equal(n.version,6);assert.equal(n.silver,123);assert.equal(n.expedition!.hp,91);assert.equal(n.expedition!.monster.currentHp,17);assert.equal(n.expedition!.time,8);assert.equal(n.expedition!.loot.silver,39);assert.deepEqual(n.cosmetics,old.cosmetics);assert.deepEqual(n.expedition!.bossTracking,initialBossTracking());});
test('보스 저장 05-07: v6 추적 상태 재로드, 범위 검증, v5 백업 1회',()=>{const raw=JSON.stringify(v5()),{repo,mem}=memory(raw),n=repo.load();n.expedition!.bossTracking.progress=60;repo.save(n);assert.equal(repo.load().expedition!.bossTracking.progress,60);assert.equal(mem.get(BOSS_TRACKING_BACKUP_KEY),raw);for(const value of [-1,Infinity]){const bad:any=structuredClone(n);bad.expedition.bossTracking.progress=value;assert.equal(validSave(bad),false);}});
test('보스 저장 08: 백업 실패 시 기존 메인 저장을 보호한다',()=>{const raw=JSON.stringify(v5());let main=raw;const repo=createRepository({getItem:k=>k===SAVE_KEY?main:null,setItem:(k,v)=>{if(k===BOSS_TRACKING_BACKUP_KEY)throw Error('full');main=v;}});assert.throws(()=>repo.load());assert.equal(main,raw);});
test('원정 종료 25-26: 안전귀환과 사망 뒤 새 원정은 추적도 0에서 시작한다',()=>{for(const dead of [false,true]){const active=bossRun();active.expedition!.bossTracking.progress=80;const ended=leave(active,dead);ended.tickets.ore[9]=1;assert.deepEqual(enter(ended,'ore',10).expedition!.bossTracking,initialBossTracking());}});

const kill=(s:ReturnType<typeof bossRun>,rng=()=>.999)=>{s.expedition!.monster.currentHp=1;return basicAttack(s,rng);};
test('보스 v24: 일반층은 진행도 없이 다음 전투, 보스층만 처치당 1 누적',()=>{const normal=kill(enter(initialState(),'ore',1));assert.equal(normal.expedition!.bossTracking.progress,0);const boss=kill(bossRun());assert.equal(boss.expedition!.bossTracking.progress,1);});
test('보스 v24: 조기 및 최대 진행도 조우는 이벤트 등장 시 진행도를 소비한다',()=>{const early=kill(bossRun(),()=>0);assert.ok(early.expedition!.events.pendingEvent!.bossId);assert.equal(early.expedition!.bossTracking.progress,0);const s=bossRun();s.expedition!.bossTracking.progress=EVENT_BALANCE.bossMaxProgress-1;const max=kill(s);assert.ok(max.expedition!.events.pendingEvent!.bossId);assert.equal(max.expedition!.bossTracking.progress,0);});
test('보스 v24: legacy challenge/decline도 같은 이벤트 결과를 통해 한 번만 처리한다',()=>{const event=kill(bossRun(),()=>0),id=event.expedition!.events.pendingEvent!.instanceId;const challenged=challengeBoss(event);assert.strictEqual(challengeBoss(challenged),challenged);const battle=continueEvent(challenged,id);assert.equal(battle.expedition!.monster.name,'광산 오우거');const declined=declineBoss(event),normal=continueEvent(declined,id);assert.notEqual(normal.expedition!.monster.name,'광산 오우거');assert.equal(normal.expedition!.bossTracking.progress,0);});
test('보스 v24: 이벤트 대기 중 전투 및 중복 postBattle 판정 중지',()=>{const s=kill(bossRun(),()=>0);assert.strictEqual(tick(s,10,()=>0),s);assert.strictEqual(basicAttack(s),s);assert.strictEqual(postBattle(s,false,()=>0),s);});
test('보스 v24: 보상은 임시 보관, 원정을 계속하며 같은 보스 재조우 허용',()=>{const event=kill(bossRun(),()=>0),id=event.expedition!.events.pendingEvent!.instanceId;const defeated=kill(continueEvent(resolveEvent(event,id,'challenge'),id),()=>0);assert.equal(defeated.expedition!.bossTracking.bossDefeated,true);assert.ok(defeated.expedition!.loot.silver>0);assert.equal(defeated.silver,0);assert.equal(defeated.expedition!.events.pendingEvent,null);assert.ok(kill(defeated,()=>0).expedition!.events.pendingEvent!.bossId);});

