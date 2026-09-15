import {initialEvents} from '../events/service';
import type {GameState,Tower} from '../types';
import {CONFIG,potionIds,TOWERS,POTIONS} from '../data/config';
import {stats,log} from './state';
import {monsterFor} from './drops';
import {emptyLoot,commitLoot,lootLines} from './loot';
import {initialBossTracking} from './bossTracking';
import {createBattleJobRuntime} from '../jobs/service';
import {createMonsterRuntime} from './monsterAi';
import {emptyReactivePrepared} from './reactions';
export function enter(s:GameState,tower:Tower,floor:number):GameState {
  const n=structuredClone(s);if(n.expedition)return n;
  if(!(tower in TOWERS)||!Number.isInteger(floor)||floor<1||floor>50||n.tickets[tower][floor-1]<1)return {...n,notice:'이 층의 입장권이 없습니다.'};
  if(n.loadout.health+n.loadout.regen>CONFIG.healingLimit)return {...n,notice:'체력과 재생 포션은 합쳐서 30개까지 가져갈 수 있습니다.'};
  if(potionIds.some(p=>!Number.isInteger(n.loadout[p])||n.loadout[p]<0||n.loadout[p]>n.potions[p]))return {...n,notice:'창고의 포션 수량을 확인하세요.'};
  n.tickets[tower][floor-1]--;
  const bag={...n.loadout};potionIds.forEach(p=>n.potions[p]-=bag[p]);
  n.logs=[];n.lastExpedition=null;
  const association=n.association.associations.find(a=>a.associationId===n.association.currentId&&a.status==='ACTIVE');
  const jobRuntime=createBattleJobRuntime(n.currentJobId),monster=monsterFor(tower,floor);
  n.expedition={events:initialEvents(),revenueShareSnapshot:{associationId:association?.associationId??null,rate:association?.revenueShareRatePercent??0},tower,floor,hp:stats(n).hp,monster,monsterRuntime:createMonsterRuntime(monster),reactivePrepared:emptyReactivePrepared(),bag,time:0,playerTimer:0,enemyTimer:0,spawnAt:0,cooldowns:{},buffs:{},playerEffects:[],monsterEffects:[],preparedEffects:[],effectSequence:0,jobSnapshotId:jobRuntime.jobId,jobRuntime,kills:0,loot:emptyLoot(),equipment:{...n.equipped},returnRequested:false,bossTracking:initialBossTracking(),phase:'PLAYER_TURN',playerTurn:1,monsterTurn:0,pendingFlee:false};
  log(n,TOWERS[tower].name+' '+floor+'층 · 입장권 1장 사용');
  log(n,n.expedition.monster.name+' 등장');
  n.notice='획득물은 원정 가방에 임시 보관됩니다. 안전 귀환해야 내 재산이 됩니다.';
  return n;
}
export function requestReturn(s:GameState):GameState {if(!s.expedition||s.expedition.events.phase!=='BATTLE'||s.expedition.phase!=='PLAYER_TURN')return s;const n=structuredClone(s);n.expedition!.pendingFlee=true;n.expedition!.phase='MONSTER_TURN';return n;}
export function cancelReturn(s:GameState):GameState {
  if(!s.expedition||!s.expedition.returnRequested)return s;
  const n=structuredClone(s);n.expedition!.returnRequested=false;n.notice='안전 귀환 예약을 취소했습니다.';log(n,'안전 귀환 예약 취소');return n;
}
/** Atomic pure state transition: only an active expedition can settle.
 * lastExpedition is a display-only receipt; it is never a payment source.
 */
export function leave(s:GameState,dead=false):GameState {
  if(!s.expedition)return s;
  const n=structuredClone(s),e=n.expedition!;
  n.lastExpedition={outcome:dead?'dead':'returned',tower:e.tower,floor:e.floor,time:e.time,kills:e.kills,loot:structuredClone(e.loot),remainingPotions:{...e.bag}};
  // Remove the redeemable source before any crediting. A second call is a no-op.
  n.expedition=null;
  if(!dead){
    const snapshot=e.revenueShareSnapshot,association=snapshot?.associationId?n.association.associations.find(a=>a.associationId===snapshot.associationId&&a.status==='ACTIVE'):undefined,share=association?Math.floor(e.loot.silver*Math.max(0,Math.min(30,snapshot?.rate??0))/100):0;if(share){e.loot.silver-=share;association!.treasurySilver+=share;association!.treasuryLedger.unshift({entryId:'treasury-'+(association!.treasuryLedger.length+1),memberId:n.market.ownerId,deltaSilver:share,grossExpeditionSilver:e.loot.silver+share,revenueShareRatePercent:snapshot!.rate,createdAt:Date.now()});}
    commitLoot(n,e.loot);
    n.exploration.highestReturned[e.tower]=Math.max(n.exploration.highestReturned[e.tower],e.floor);
    if(e.floor%10===0&&e.bossTracking.bossDefeated)n.exploration.unlockedTier[e.tower]=Math.max(n.exploration.unlockedTier[e.tower],Math.min(5,e.floor/10+1));
    if(e.floor===10&&e.bossTracking.bossDefeated)n.market.traderCertified=true;
    n.progress[e.tower]=Math.max(n.progress[e.tower],e.floor);
    potionIds.forEach(p=>n.potions[p]+=e.bag[p]);
  }
  e.loot=emptyLoot();
  n.notice=dead?'원정 실패 · 이번 원정 전리품과 남은 원정 포션을 모두 잃었습니다. 기존 보관함은 유지됩니다.':'안전 귀환 · 이번 원정 전리품과 남은 포션을 보관함에 저장했습니다.';
  log(n,n.notice);
  for(const line of lootLines(n.lastExpedition.loot))log(n,(dead?'손실: ':'보관: ')+line);
  for(const p of potionIds)if(e.bag[p])log(n,(dead?'소멸: ':'반환: ')+POTIONS[p].name+' 포션 ×'+e.bag[p]);
  return n;
}




