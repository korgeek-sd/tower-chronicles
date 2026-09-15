import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,emptyBag} from '../src/game/engine/state.ts';
import {enter,leave} from '../src/game/engine/expedition.ts';
import {reward} from '../src/game/engine/drops.ts';
import {basicAttack,resolveMonsterTurn} from '../src/game/engine/combat.ts';
import {emptyLoot,lootLines} from '../src/game/engine/loot.ts';
import {useSkillBook} from '../src/game/engine/skills.ts';
import {createRepository,SAVE_KEY,LEGACY_BACKUP_KEY,validSave} from '../src/storage/repository.ts';
import {towerIds} from '../src/game/data/config.ts';
import type {GameState} from '../src/game/types.ts';

function owned() {
  const s=initialState();s.silver=10000;s.materials.ore[0]=100;s.materials.gem[2]=17;
  s.skillBooks={heavy:3};s.lootItems={relic:2};s.tickets.ore[1]=4;
  return s;
}
function rewarded() {const s=enter(owned(),'ore',1);reward(s,()=>0);return s;}
function repository(){
  const mem=new Map<string,string>();
  const repo=createRepository({getItem:k=>mem.get(k)??null,setItem:(k,v)=>{mem.set(k,v);}});
  return {repo,mem};
}
test('요청 01: 처치 후 영구 재료는 변하지 않는다',()=>{
  const s=rewarded();assert.equal(s.materials.ore[0],100);assert.equal(s.materials.gem[2],17);
});
test('요청 02: 처치 후 Silver는 변하지 않는다',()=>{
  assert.equal(rewarded().silver,10000);
});
test('요청 03: 모든 전투 보상은 expedition.loot에 기록된다',()=>{
  const s=rewarded(),loot=s.expedition!.loot;
  assert.equal(loot.silver,13);assert.equal(loot.materials.ore[0],2);assert.equal(loot.tickets.ore[1],1);assert.equal(loot.skillBooks.execute,1);
});
test('요청 04: 안전 귀환은 여러 티어/탑/종류의 보상을 정확히 합산한다',()=>{
  const s=rewarded(),e=s.expedition!;
  e.loot.materials.gem[2]=7;e.loot.materials.ore[1]=48;e.loot.tickets.leather[11]=2;
  e.loot.skillBooks.heavy=2;e.loot.items.relic=5;
  const n=leave(s);
  assert.equal(n.silver,10013);assert.equal(n.materials.ore[0],102);assert.equal(n.materials.ore[1],48);assert.equal(n.materials.gem[2],24);
  assert.equal(n.tickets.ore[0],19);assert.equal(n.tickets.ore[1],5);assert.equal(n.tickets.leather[11],2);
  assert.equal(n.skillBooks.execute,1);assert.equal(n.skillBooks.heavy,5);assert.equal(n.lootItems.relic,7);
  assert.ok(!n.learned.includes('execute'));assert.equal(n.progress.leather,12);
});
test('요청 05: 귀환 후 활성 원정과 정산 가능한 loot가 제거된다',()=>{
  const n=leave(rewarded());assert.equal(n.expedition,null);assert.equal(n.lastExpedition!.outcome,'returned');
  // Receipts retain readable history, not a payable expedition.
  assert.equal(n.lastExpedition!.loot.silver,13);
  const again=enter(n,'ore',1);assert.deepEqual(again.expedition!.loot,emptyLoot());assert.equal(again.lastExpedition,null);
});
test('요청 06: 사망하면 이번 원정 전리품은 지급되지 않고 삭제된다',()=>{
  const n=leave(rewarded(),true);assert.equal(n.expedition,null);assert.equal(n.silver,10000);assert.equal(n.materials.ore[0],100);
  assert.deepEqual(n.skillBooks,{heavy:3});assert.deepEqual(n.lootItems,{relic:2});
  assert.equal(n.lastExpedition!.outcome,'dead');
});
test('요청 07: 사망은 기존 영구 재산, 장착, 숙련도, 배운 스킬에 영향이 없다',()=>{
  const before=enter(owned(),'ore',1),s=structuredClone(before);reward(s,()=>0);
  s.expedition!.loot.items.relic=9;
  const n=leave(s,true);
  for(const key of ['silver','materials','tickets','skillBooks','lootItems','items','equipped','learned','skills','mastery','progress','potions'] as const)assert.deepEqual(n[key],before[key],key);
});
test('요청 08: 사망 시 원정에 남은 모든 종류 포션만 소멸한다',()=>{
  const before=owned(),s=enter(before,'ore',1);
  s.expedition!.bag.health-=2;
  const n=leave(s,true);
  for(const p of ['health','regen','attack','defense','haste'] as const)assert.equal(n.potions[p],before.potions[p]-before.loadout[p]);
  assert.equal(n.lastExpedition!.remainingPotions.health,8);
});
test('요청 09: 귀환 시 사용하지 않은 포션만 창고로 돌아온다',()=>{
  const before=owned(),s=enter(before,'ore',1);s.expedition!.bag.health-=2;s.expedition!.bag.attack=0;
  const n=leave(s);assert.equal(n.potions.health,before.potions.health-2);assert.equal(n.potions.regen,before.potions.regen);assert.equal(n.potions.attack,before.potions.attack-1);
});
test('요청 10: 원정에서 획득한 입장권은 귀환 전 영구 티켓과 진행도에 포함되지 않는다',()=>{
  const s=rewarded();assert.equal(s.tickets.ore[1],4);assert.equal(s.progress.ore,1);assert.equal(s.expedition!.loot.tickets.ore[1],1);
});
test('요청 11: 사망은 임시 티켓을 없애되 기존 티켓은 입장 소비량 외에 유지한다',()=>{
  const n=leave(rewarded(),true);assert.equal(n.tickets.ore[1],4);assert.equal(n.tickets.ore[0],19);assert.equal(n.expedition,null);
});
test('요청 12: 원정 스킬북은 귀환 전에 영구 인벤토리에 없다',()=>{
  const s=rewarded();assert.equal(s.skillBooks.execute,undefined);assert.equal(s.expedition!.loot.skillBooks.execute,1);
});
test('요청 13: 스킬북은 드롭 즉시 자동으로 학습되지 않는다',()=>{
  const s=rewarded();assert.ok(!s.learned.includes('execute'));assert.deepEqual(useSkillBook(s,'execute').learned,s.learned);
});
test('요청 14: 귀환한 스킬북은 직접 사용해야 1개 소비하고 학습한다',()=>{
  let s=rewarded();reward(s,()=>0);s=leave(s);assert.equal(s.skillBooks.execute,2);assert.ok(!s.learned.includes('execute'));
  s=useSkillBook(s,'execute');assert.equal(s.skillBooks.execute,1);assert.ok(s.learned.includes('execute'));
  const duplicate=useSkillBook(s,'execute');assert.equal(duplicate.skillBooks.execute,1);assert.equal(duplicate.learned.filter(id=>id==='execute').length,1);
});
test('요청 15: 저장/새로고침 후 HP·포션·쿨타임·loot가 변경 없이 복구된다',()=>{
  const {repo}=repository();const s=rewarded();s.expedition!.hp=93;s.expedition!.bag.health=7;s.expedition!.cooldowns.heavy=8;s.expedition!.time=4;
  repo.save(s);const n=repo.load();assert.deepEqual(n,s);assert.equal(n.silver,10000);assert.equal(n.materials.ore[0],100);
});
test('요청 16: 연속 귀환·재렌더·저장 복구는 보상을 중복 지급하지 않는다',()=>{
  const {repo}=repository(),once=leave(rewarded()),twice=leave(once);
  assert.deepEqual(twice,once);repo.save(twice);assert.deepEqual(leave(repo.load()),once);
  assert.deepEqual(leave(leave(once,true)),once);
});
test('이미 배운 스킬의 책도 반복 드롭하고 미사용 아이템으로 보관한다',()=>{
  let s=owned();s.learned.push('execute');s=enter(s,'ore',1);reward(s,()=>0);reward(s,()=>0);
  assert.equal(s.expedition!.loot.skillBooks.execute,2);s=leave(s);assert.equal(s.skillBooks.execute,2);
});
test('손실 영수증은 이번 원정의 전리품만 표시하고 기존 재산은 표시하지 않는다',()=>{
  const n=leave(rewarded(),true),lines=lootLines(n.lastExpedition!.loot).join('\n');
  assert.match(lines,/Silver 13/);assert.match(lines,/광석 ×2/);assert.match(lines,/2층 입장권 ×1/);assert.match(lines,/처형 스킬북 ×1/);
  assert.ok(!lines.includes('10,000'));assert.ok(!lines.includes('강공'));assert.ok(!lines.includes('보석'));
});
test('실제 전투 사망도 임시 보상·포션만 잃고 결과를 저장한다',()=>{
  let s=owned();s.tickets.ore[3]=1;s.loadout=emptyBag();s=enter(s,'ore',4);
  s.expedition!.monster.currentHp=1;s=basicAttack(s,()=>.99);
  s.expedition!.hp=1;s.expedition!.monster.attack=999;s.expedition!.phase='MONSTER_TURN';s=resolveMonsterTurn(s);
  assert.equal(s.expedition,null);assert.equal(s.lastExpedition!.outcome,'dead');assert.ok(s.lastExpedition!.kills>0);
  assert.ok(s.lastExpedition!.loot.silver>0);assert.equal(s.silver,10000);assert.equal(s.materials.ore[0],100);
  const {repo}=repository();repo.save(s);assert.deepEqual(repo.load(),s);
});
test('4개 탑 모두 귀환 전 격리와 귀환 후 재료 확정이 동작한다',()=>{
  for(const t of towerIds){const s=enter(initialState(),t,1);reward(s,()=>0);assert.equal(s.materials[t][0],0);const n=leave(s);assert.equal(n.materials[t][0],2);assert.equal(n.silver,13);}
});
function legacy(active:boolean){
  const state=active?enter(owned(),'ore',1):owned();
  const old=JSON.parse(JSON.stringify(state));old.gold=old.silver;delete old.silver;old.version=1;delete old.skillBooks;delete old.lootItems;delete old.lastExpedition;
  if(active){delete old.expedition.loot;old.expedition.gold=13;old.expedition.material=2;old.gold+=13;old.materials.ore[0]+=2;old.tickets.ore[1]++;old.learned.push('execute');old.expedition.bag.health--;}
  return old;
}
test('v1 비원정 저장은 기존 재산을 보존하고 새 필드를 초기화한다',()=>{
  const {repo,mem}=repository(),old=legacy(false);mem.set(SAVE_KEY,JSON.stringify(old));const n=repo.load();
  assert.equal(n.version,19);assert.equal(n.silver,old.gold);assert.deepEqual(n.materials,old.materials);assert.deepEqual(n.skillBooks,{});assert.equal(n.expedition,null);
  assert.equal(mem.get(LEGACY_BACKUP_KEY),JSON.stringify(old));assert.deepEqual(repo.load(),n);
});
test('v1 진행 원정은 재지급 없이 종료하고 남은 포션만 한 번 반환한다',()=>{
  const {repo,mem}=repository(),old=legacy(true);mem.set(SAVE_KEY,JSON.stringify(old));const n=repo.load();
  assert.equal(n.version,19);assert.equal(n.silver,10013);assert.equal(n.materials.ore[0],102);assert.equal(n.tickets.ore[1],5);assert.equal(n.tickets.ore[0],19);assert.equal(n.potions.health,29);
  assert.ok(n.learned.includes('execute'));assert.equal(n.expedition,null);assert.equal(n.lastExpedition,null);
  assert.deepEqual(repo.load(),n);assert.deepEqual(leave(repo.load()),n);
});
test('잘못된 loot·누락 필드·음수 보상은 저장/로드 시 거부하고 원본을 보존한다',()=>{
  const {repo,mem}=repository(),s=rewarded();s.expedition!.loot.silver=-1;
  assert.equal(validSave(s),false);assert.throws(()=>repo.save(s));
  const raw=JSON.stringify(s);mem.set(SAVE_KEY,raw);assert.throws(()=>repo.load());assert.equal(mem.get(SAVE_KEY),raw);
  const missing=JSON.parse(JSON.stringify(rewarded()));delete missing.expedition.loot.tickets;assert.equal(validSave(missing),false);
});
test('구버전 백업/이전 저장이 실패하면 이전 원본을 덮어쓰지 않는다',()=>{
  const raw=JSON.stringify(legacy(true));let writes=0;
  const repo=createRepository({getItem:k=>k===SAVE_KEY?raw:null,setItem:()=>{writes++;throw Error('storage unavailable');}});
  assert.throws(()=>repo.load());assert.equal(writes,1);
});
test('사망 결과를 다시 로드하고 귀환해도 손실 보상을 되살릴 수 없다',()=>{
  const {repo}=repository();const dead=leave(rewarded(),true);repo.save(dead);const n=leave(repo.load());
  assert.equal(n.silver,10000);assert.equal(n.materials.ore[0],100);assert.equal(n.skillBooks.execute,undefined);
});









