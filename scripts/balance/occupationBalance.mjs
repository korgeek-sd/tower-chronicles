/**
 * Tower Chronicles occupation war prototype (read-only).
 * NOT production PvP: only heavy/guard/quick skills are modeled.
 * Source: src/game/hunting/model.ts (damage, crit, 100 turns),
 * docs/balance/2026-10-10-hunting-balance-report.md (hypothetical stat fixtures).
 */
export const RULES=Object.freeze({fronts:5,defendersPerFront:5,cooldownSeconds:30,warSeconds:1800,holdSeconds:300,turnsPerDuel:100});
export const FIXTURES=Object.freeze({
 level50Standard:{hp:475,attack:43,defense:50,critChance:.10,critDamage:1.5,armorPenetration:0},
 level80Standard:{hp:643,attack:61,defense:80,critChance:.14,critDamage:1.5,armorPenetration:0},
 level80Offense:{hp:463,attack:89,defense:54,critChance:.14,critDamage:1.5,armorPenetration:0},
 level80Defense:{hp:787,attack:45,defense:88,critChance:.14,critDamage:1.5,armorPenetration:0},
 level100Optimistic:{hp:765,attack:74,defense:99,critChance:.17,critDamage:1.5,armorPenetration:0}
});
export const EQUIPMENT_DROP_MILLIONTHS=Object.freeze({
 plains:[13000,2000,0,0,0],forest:[13000,3000,500,0,0],
 mine:[13000,3500,900,100,0],fortress:[13000,4000,1300,200,0],
 ruins:[13000,4500,1600,350,116]
});
export const SPLIT_STONES_PER_GRADE=[1,3,6,10,15];
export function expectedSplitStonesPerWin(map){
 return EQUIPMENT_DROP_MILLIONTHS[map].reduce((total,p,i)=>total+p*SPLIT_STONES_PER_GRADE[i],0)/1000000;
}
export function expectedWeeklyTickets(map,{members=5,winsPerDay=100,days=7,recipeStones=10,recipeYield=1}={}){
 return expectedSplitStonesPerWin(map)*members*winsPerDay*days/recipeStones*recipeYield;
}
export function seededRng(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function damage(attack,defense,multiplier,penetration=0){
 return Math.max(1,Math.floor(attack*multiplier*100/(100+Math.max(0,defense)*(1-Math.max(0,Math.min(1,penetration))))));
}
function skill(turn,hp,maxHp,cooldowns){
 if((cooldowns.heavy??0)<=turn){cooldowns.heavy=turn+3;return'heavy';}
 if(hp/maxHp<=.5&&(cooldowns.guard??0)<=turn){cooldowns.guard=turn+4;return'guard';}
 if((cooldowns.quick??0)<=turn){cooldowns.quick=turn+2;return'quick';}
 return'wait';
}
/**
 * One attack token -> one PvP attempt against one defender.
 * Attacker begins at full HP each attempt. Defender carries remaining HP.
 * Defender's guard on its own turn blocks the next incoming attack.
 * No heals, real learned catalog skills, queues, food or NPC AI modeled.
 */
export function duel(attackerStats,defenderStats,defenderHp,rng){
 const a={hp:attackerStats.hp},d={hp:defenderHp};const ac={},dc={};
 let turns=0,defenderGuardPending=false;
 for(let t=1;t<=RULES.turnsPerDuel&&a.hp>0&&d.hp>0;t++){
  turns=t;
  const aMove=skill(t,a.hp,attackerStats.hp,ac),aGuard=aMove==='guard';
  if(aMove==='heavy'||aMove==='quick'){
   const critical=rng()<attackerStats.critChance;
   const amount=damage(attackerStats.attack,defenderStats.defense,(aMove==='heavy'?1.8:1.2)*(critical?attackerStats.critDamage:1),attackerStats.armorPenetration);
   d.hp=Math.max(0,d.hp-(defenderGuardPending?Math.max(1,Math.floor(amount*.5)):amount));
   defenderGuardPending=false;
  }
  if(d.hp<=0)break;
  const dMove=skill(t,d.hp,defenderStats.hp,dc);
  if(dMove==='guard')defenderGuardPending=true;
  if(dMove==='heavy'||dMove==='quick'){
   const critical=rng()<defenderStats.critChance;
   const amount=damage(defenderStats.attack,attackerStats.defense,(dMove==='heavy'?1.8:1.2)*(critical?defenderStats.critDamage:1),defenderStats.armorPenetration);
   a.hp=Math.max(0,a.hp-(aGuard?Math.max(1,Math.floor(amount*.5)):amount));
  }
 }
 return{attackerWon:d.hp===0&&a.hp>0,attackerHp:a.hp,defenderHp:d.hp,turns};
}
/** Total attempts to exhaust a fixed, uncontested 5x5 defender roster. */
export function simulateCapture(attackerStats,defenderStats,{seed=20261011,maxAttempts=600}={}){
 const rng=seededRng(seed);
 let attempts=0,duelVictories=0,totalTurns=0,remainingHp=defenderStats.hp,kills=0;
 while(kills<RULES.fronts*RULES.defendersPerFront&&attempts<maxAttempts){
  const result=duel(attackerStats,defenderStats,remainingHp,rng);
  attempts++;totalTurns+=result.turns;
  if(result.attackerWon)duelVictories++;
  remainingHp=result.defenderHp;
  if(remainingHp<=0){kills++;remainingHp=defenderStats.hp;}
 }
 return{attempts,defendersKilled:kills,duelVictories,totalTurns,captured:kills===RULES.fronts*RULES.defendersPerFront};
}
/**
 * Lower bound only: perfect player availability, distributed 30s cooldown,
 * 5s click/network time, no defense reinforcements/contested queues.
 */
export function throughput(attempts,members,{uiSeconds=5}={}){
 if(!Number.isInteger(members)||members<1)return Infinity;
 const interval=Math.max(RULES.cooldownSeconds,uiSeconds);
 const batches=Math.ceil(attempts/members);
 return batches<=0?0:(batches-1)*interval+uiSeconds;
}
export function benchmark({trials=1000,seed=20261011}={}){
 const fortified80={...FIXTURES.level80Standard,hp:Math.floor(FIXTURES.level80Standard.hp*1.25)};
 const cases=[
  ['Lv50 mirror',FIXTURES.level50Standard,FIXTURES.level50Standard],
  ['Lv80 mirror',FIXTURES.level80Standard,FIXTURES.level80Standard],
  ['Lv80 -> fortified Lv80 (+25% defender HP)',FIXTURES.level80Standard,fortified80],
  ['Lv80 offense -> defense',FIXTURES.level80Offense,FIXTURES.level80Defense],
  ['Lv80 defense -> offense',FIXTURES.level80Defense,FIXTURES.level80Offense],
  ['Lv80 standard -> defense',FIXTURES.level80Standard,FIXTURES.level80Defense],
  ['Lv50 -> Lv80',FIXTURES.level50Standard,FIXTURES.level80Standard],
  ['Lv100 optimistic mirror',FIXTURES.level100Optimistic,FIXTURES.level100Optimistic]
 ];
 return cases.map(([name,attacker,defender],caseIndex)=>{
  const results=Array.from({length:trials},(_,i)=>simulateCapture(attacker,defender,{seed:(seed+Math.imul(caseIndex+1,1000003)+Math.imul(i,2654435761))>>>0}));
  const attempts=results.map(r=>r.attempts).sort((a,b)=>a-b);
  const q=p=>attempts[Math.ceil(p*attempts.length)-1],mean=attempts.reduce((a,b)=>a+b,0)/attempts.length;
  return{name,trials,captureRate:results.filter(r=>r.captured).length/trials,meanAttempts:+mean.toFixed(2),
   medianAttempts:q(.5),p90Attempts:q(.9),meanAttemptsPerDefender:+(mean/25).toFixed(2),
   minutes5:+(throughput(q(.5),5)/60).toFixed(2),minutes10:+(throughput(q(.5),10)/60).toFixed(2),
   can5HoldIn30:throughput(q(.5),5)+RULES.holdSeconds<=RULES.warSeconds};
 });
}
if(process.argv[1]?.endsWith('occupationBalance.mjs')){
 console.log(JSON.stringify({source:'hypothetical PvP design, NOT live server data',seed:20261011,rules:RULES,
 results:benchmark(),expectedStonesPerWin:Object.fromEntries(Object.keys(EQUIPMENT_DROP_MILLIONTHS).map(map=>[map,expectedSplitStonesPerWin(map)]))},null,2));
}
