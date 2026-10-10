import {writeFileSync,mkdirSync} from 'node:fs';
import {HUNT_MAPS,type HuntMapId} from '../../src/game/hunting/model';
import {simulateBalance,balanceCsv,type BalanceRow,type MonsterOverride} from './huntingBalance';

const targets=[
 {map:'plains',level:1,turns:6.5,potions:35},
 {map:'forest',level:20,turns:7,potions:45},
 {map:'mine',level:40,turns:7,potions:55},
 {map:'fortress',level:60,turns:7.5,potions:70},
 {map:'ruins',level:80,turns:8.5,potions:105},
] as const;
type Target=(typeof targets)[number];
type MonsterValues={hp:number;attack:number;defense:number};
const hpFactors=[1,1.15,1.3,1.45,1.6] as const;
const atkFactors=[.35,.45,.55,.65,.75] as const;
const defFactors=[1,1.3,1.6] as const;
const round=(n:number)=>Math.round(n*10)/10;
function by(rows:BalanceRow[],build:BalanceRow['build'],gear:BalanceRow['gear']){
 const v=rows.find(r=>r.version==='candidate'&&r.build===build&&r.gear===gear);
 if(!v)throw Error('Missing candidate scenario '+build+gear);
 return v;
}
export function rankMonsterCandidate(t:Target,rows:BalanceRow[]):number {
 const normal=by(rows,'balanced','standard'),weak=by(rows,'balanced','under');
 const attack=by(rows,'offense','standard'),defense=by(rows,'defense','standard');
 // Targets are provisional player-experience hypotheses, NOT approved production constraints.
 let score=3*Math.abs(normal.meanTurns-t.turns)+.20*Math.abs(normal.potionsPerAttempt-t.potions);
 score+=3*Math.max(0,normal.p90Turns-13);
 score+=100*Math.max(0,.985-normal.winRate)+65*Math.max(0,.97-weak.winRate);
 score+=50*Math.max(0,.95-attack.winRate)+50*Math.max(0,.95-defense.winRate);
 score+=2*Math.max(0,defense.meanTurns-15);
 // Unfixable with monsters alone: track but don't over-optimize stat-build disparity.
 if(defense.potionsPerAttempt>attack.potionsPerAttempt*1.8)score+=.015*(defense.potionsPerAttempt-attack.potionsPerAttempt*1.8);
 return score;
}
export function tuneMonsterMap(t:Target,runs=80){
 const original=HUNT_MAPS.find(m=>m.id===t.map)!;
 let best:{stats:MonsterValues;score:number;rows:BalanceRow[]}|null=null;
 for(const hpFactor of hpFactors)for(const attackFactor of atkFactors)for(const defenseFactor of defFactors){
  const stats={hp:Math.round(original.hp*hpFactor),attack:Math.max(1,Math.round(original.attack*attackFactor)),defense:Math.max(1,Math.round(original.defense*defenseFactor))};
  const rows=simulateBalance({levels:[t.level],builds:['balanced','offense','defense','critical'],gears:['under','standard'],maps:[t.map],mode:'duel',runs,seed:20261010,potions:10000,candidate:{[t.map]:stats}});
  const score=rankMonsterCandidate(t,rows);
  if(!best||score<best.score)best={stats,score,rows};
 }
 if(!best)throw Error('No balanced candidate for '+t.map);
 return {map:t.map,level:t.level,target:{turns:t.turns,potions:t.potions},...best};
}
function report(label:string,rows:BalanceRow[]){
 console.log('=== '+label+' ===');
 for(const r of rows.filter(r=>r.gear==='standard')){
  console.log(['OPT',r.version,r.level,r.mapId,r.build,'HP',r.hp,'ATK',round(r.attack),'DEF',round(r.defense),
  'win%',round(r.winRate*100),'turn',round(r.meanTurns),'p90',r.p90Turns,'pot',round(r.potionsPerAttempt),'xp',round(r.xpPerVitality),'underHeal%',round(r.underHealedRate*100)].join('|'));
 }
}
if(process.argv[1]?.endsWith('/tuneMonsters.ts')){
 const best=targets.map(t=>tuneMonsterMap(t,80));
 const proposal=Object.fromEntries(best.map(t=>[t.map,t.stats])) as MonsterOverride;
 mkdirSync('balance-output',{recursive:true});
 writeFileSync('balance-output/tuned-monsters.json',JSON.stringify(proposal,null,2)+'\n');
 console.log('OPTIMIZED_MONSTERS '+JSON.stringify(proposal));
 for(const t of best){
  const b=by(t.rows,'balanced','standard');
  console.log(['TARGET',t.map,'level',t.level,'turn',t.target.turns,'potion',t.target.potions,
   'picked',JSON.stringify(t.stats),'score',round(t.score),'actual-turns',round(b.meanTurns),'actual-potions',round(b.potionsPerAttempt)].join('|'));
 }
 const validated=simulateBalance({levels:[1,20,40,60,80],builds:['balanced','offense','defense','critical'],gears:['under','standard','high'],maps:'recommended',mode:'duel',runs:1000,seed:20261010,potions:10000,candidate:proposal});
 report('OPTIMIZED 1000 SEEDED DUELS, CURRENT VS PROPOSAL',validated);
 writeFileSync('balance-output/tuned-duel.csv',balanceCsv(validated)+'\n');
 const streak=simulateBalance({levels:[1,20,40,60,80],builds:['balanced','offense','defense','critical'],gears:['under','standard'],maps:'recommended',mode:'endurance',runs:15,seed:20261010,potions:1200,candidate:proposal});
 report('OPTIMIZED 100-VITALITY STREAKS, 1200 POTIONS',streak);
 writeFileSync('balance-output/tuned-endurance.csv',balanceCsv(streak)+'\n');
 console.log('AUTO_TUNING_CHECK '+JSON.stringify({trialCount:best.length*hpFactors.length*atkFactors.length*defFactors.length,targets:best.map(x=>({map:x.map,score:round(x.score)}))}));
}
