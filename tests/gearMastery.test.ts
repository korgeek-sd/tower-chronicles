import {resolveMonsterTurn} from '../src/game/engine/combat';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter,leave,requestReturn,cancelReturn} from '../src/game/engine/expedition.ts';
import {reward} from '../src/game/engine/drops.ts';
import {tick} from '../src/game/engine/combat.ts';
import {masteryGainForFloor,masteryRequired} from '../src/game/engine/gearMastery.ts';
import {equip} from '../src/game/engine/state.ts';
import {createRepository,SAVE_KEY,MASTERY_BACKUP_KEY} from '../src/storage/repository.ts';

const item=(id:string,kind:string,tier=1,enhancement=0)=>({id,kind,tier,enhancement});
function fullSet(floor=1){
  const s=initialState();s.items.push(item('dagger','dagger'),item('armor','armor'),item('boots','boots'),item('ring','vampire'));
  s.equipped={weapon:'dagger',armor:'armor',boots:'boots',accessory:'ring'};s.tickets.ore[floor-1]=2;
  return enter(s,'ore',floor);
}
function memory(){const mem=new Map<string,string>();return {mem,repo:createRepository({getItem:k=>mem.get(k)??null,setItem:(k,v)=>void mem.set(k,v)})};}

test('숙련 01: 한 번 처치하면 장착한 4개 슬롯이 동시에 오른다',()=>{const s=fullSet();reward(s,()=>.9);for(const k of ['dagger','armor','boots','accessory'] as const)assert.equal(s.gearMastery[k].progress,masteryGainForFloor(1));});
test('숙련 02: 장착하지 않은 무기 계열은 오르지 않는다',()=>{const s=fullSet();reward(s,()=>.9);for(const k of ['sword','bow','staff'] as const)assert.equal(s.gearMastery[k].progress,0);});
test('숙련 03: 강화 수치는 획득량과 자격 판정에 영향을 주지 않는다',()=>{const a=fullSet(),b=fullSet();b.items.find(i=>i.id==='dagger')!.enhancement=3;reward(a,()=>.9);reward(b,()=>.9);assert.equal(a.gearMastery.dagger.progress,b.gearMastery.dagger.progress);});
test('숙련 04: 현재 착용 가능 티어와 같은 장비만 다음 티어를 진행한다',()=>{const s=fullSet(21);s.gearMastery.dagger.unlockedTier=3;s.items.find(i=>i.id==='dagger')!.tier=1;reward(s,()=>.9);assert.equal(s.gearMastery.dagger.progress,0);});
test('숙련 05: 바로 이전 티어 장비는 다음 티어 숙련을 진행한다',()=>{const s=fullSet(11);s.gearMastery.dagger.unlockedTier=2;s.items.find(i=>i.id==='dagger')!.tier=2;reward(s,()=>.9);assert.equal(s.gearMastery.dagger.progress,masteryGainForFloor(11));});
test('숙련 06: 요구치를 채우면 다음 티어 착용 자격이 열린다',()=>{const s=fullSet();s.gearMastery.dagger.progress=masteryRequired(2)-masteryGainForFloor(1);reward(s,()=>.9);assert.equal(s.gearMastery.dagger.unlockedTier,2);assert.match(s.logs.join('\n'),/T2 단검 착용 자격/);});
test('숙련 07: 같은 티어 마지막 층 획득량은 첫 층보다 약 50% 높다',()=>{assert.equal(masteryGainForFloor(10),Math.round(masteryGainForFloor(1)*1.5));});
test('숙련 08: 자격보다 높은 장비를 보유해도 장착할 수 없다',()=>{const s=initialState();s.items.push(item('high','sword',4));const n=equip(s,'high');assert.equal(n.equipped.weapon,'starter');assert.match(n.notice,/T4 검을 장착하려면 검 숙련이 더 필요합니다/);});
test('숙련 09: 원정 중 장비 변경은 정확한 안내와 함께 거부된다',()=>{const s=fullSet(),n=equip(s,'starter');assert.deepEqual(n.expedition!.equipment,s.expedition!.equipment);assert.equal(n.notice,'원정 중에는 장비를 변경할 수 없습니다.');});
test('숙련 10: 사망해도 이미 획득한 장비 숙련은 유지된다',()=>{const s=fullSet();reward(s,()=>.9);const before=s.gearMastery.dagger.progress,n=leave(s,true);assert.equal(n.gearMastery.dagger.progress,before);});
test('숙련 11: 저장과 재로드 후 숙련도와 원정 장비 고정값이 복구된다',()=>{const {repo}=memory(),s=fullSet();reward(s,()=>.9);repo.save(s);assert.deepEqual(repo.load(),s);});
test('귀환 v24: 공개 귀환 요청은 적의 턴을 거치며 중복 요청할 수 없다',()=>{const s=fullSet(),pending=requestReturn(s);assert.equal(pending.expedition!.pendingFlee,true);assert.equal(pending.expedition!.phase,'MONSTER_TURN');assert.strictEqual(requestReturn(pending),pending);});
test('귀환 v24: 적의 공격에서 살아남으면 기존 정산으로 귀환한다',()=>{const s=requestReturn(fullSet());s.expedition!.monster.attack=1;const n=resolveMonsterTurn(s);assert.equal(n.expedition,null);assert.equal(n.lastExpedition?.outcome,'returned');assert.equal(n.lastExpedition?.kills,0);});
test('귀환 v24: 도망 시도 중 사망하면 전리품을 잃는다',()=>{const s=requestReturn(fullSet());s.expedition!.hp=1;s.expedition!.monster.attack=9999;assert.equal(resolveMonsterTurn(s).lastExpedition?.outcome,'dead');});
test('귀환 v24: 오래된 등장 타이머 값으로 즉시 정산을 우회할 수 없다',()=>{const s=fullSet();s.expedition!.spawnAt=3;const n=requestReturn(s);assert.ok(n.expedition);assert.equal(n.expedition!.phase,'MONSTER_TURN');});
test('v2 저장은 숙련도와 고정 장비를 추가해 v13까지 안전 이전한다',()=>{const {repo,mem}=memory(),s=fullSet(),old=JSON.parse(JSON.stringify(s));old.gold=old.silver;delete old.silver;old.expedition.loot.gold=old.expedition.loot.silver;delete old.expedition.loot.silver;old.version=2;delete old.gearMastery;delete old.expedition.equipment;delete old.expedition.returnRequested;const raw=JSON.stringify(old);mem.set(SAVE_KEY,raw);const n=repo.load();assert.equal(n.version,20);assert.equal(n.gearMastery.sword.unlockedTier,1);assert.deepEqual(n.expedition!.equipment,n.equipped);assert.equal(mem.get(MASTERY_BACKUP_KEY),raw);});







