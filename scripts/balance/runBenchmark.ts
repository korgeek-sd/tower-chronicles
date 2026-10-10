import {writeFileSync,mkdirSync} from 'node:fs';
import {allocationForBuild,buildPlayer,balanceCsv,simulateBalance,recommendedMap,type BalanceRow} from './huntingBalance';
import {HUNT_MAPS,huntingExperienceToNextLevel} from '../../src/game/hunting/model';
import {HUNT_EQUIPMENT_RATES} from '../../src/game/hunting/equipmentDrops';

const LEVELS=[1,10,19,20,30,39,40,50,59,60,70,79,80,90,99,100];
const ENTRIES=[1,20,40,60,80];
const BUILDS=['balanced','offense','defense','critical'] as const;
const GEARS=['under','standard','high'] as const;
const fmt=(v:number,d=1)=>Number(v.toFixed(d));
function report(label:string,rows:BalanceRow[]) {
 console.log('=== '+label+' ===');
 for(const r of rows){
  console.log(['BALANCE',r.version,r.level,r.mapId,r.build,r.gear,r.equipmentStage,
    'HP',r.hp,'ATK',fmt(r.attack),'DEF',fmt(r.defense),'CRIT',fmt(r.critChance*100),
    'win',fmt(r.winRate*100),'95CI',fmt(r.win95Low*100)+'-'+fmt(r.win95High*100),
    'turns',fmt(r.meanTurns),'p90',r.p90Turns,'potions',fmt(r.potionsPerAttempt),
    'underheal',fmt(r.underHealedRate*100),'xp',fmt(r.xpPerVitality),
    'silver',fmt(r.silverPerVitality)].join('|'));
 }
}
console.log('SOURCE_VERSION 71216766dd96c33969a413813ce52e058847c5dc');
console.log('MONSTERS '+JSON.stringify(HUNT_MAPS.map(m=>({id:m.id,lv:m.recommendedLevel,hp:m.hp,attack:m.attack,defense:m.defense,xp:m.exp,rate:HUNT_EQUIPMENT_RATES[m.id]}))));
console.log('GROWTH_TABLE level|xp_to_next|build|gear|hp|atk|def|crit|points');
for(const level of [1,10,20,30,40,50,60,70,80,90,100]){
 const p=buildPlayer(level,'balanced','standard');
 console.log(['GROWTH',level,huntingExperienceToNextLevel(level),'balanced','standard',p.final.hp,fmt(p.final.attack),fmt(p.final.defense),fmt(p.final.critChance*100),JSON.stringify(p.points)].join('|'));
}
const duel=simulateBalance({levels:LEVELS,builds:[...BUILDS],gears:[...GEARS],maps:'recommended',runs:500,seed:20261010,potions:10000,mode:'duel'});
report('DUEL ALL 16 LEVELS, 4 BUILDS, 3 GEARS; 500 independent fights each',duel);
const entryEndurance=simulateBalance({levels:ENTRIES,builds:[...BUILDS],gears:['under','standard'],maps:'recommended',runs:15,seed:20261010,potions:1200,mode:'endurance'});
report('ENDURANCE 100 VITALITY, 1200 POTIONS PER SESSION, 15 seeds',entryEndurance);
const zero=simulateBalance({levels:[1,20,40,60,80],builds:['balanced'],gears:['standard'],maps:'recommended',runs:20,seed:20261010,potions:0,mode:'endurance'});
report('ZERO POTIONS / 100 VITALITY',zero);
const mapTransitions=simulateBalance({levels:[19,20,39,40,59,60,79,80],builds:['balanced'],gears:['under','standard'],maps:['plains','forest','mine','fortress','ruins'],runs:150,seed:20261010,potions:10000,mode:'duel'});
report('MAP TRANSITIONS',mapTransitions);
mkdirSync('balance-output',{recursive:true});
writeFileSync('balance-output/duel.csv',balanceCsv(duel)+'\n');
writeFileSync('balance-output/endurance.csv',balanceCsv(entryEndurance)+'\n');
writeFileSync('balance-output/zero-potions.csv',balanceCsv(zero)+'\n');
writeFileSync('balance-output/transitions.csv',balanceCsv(mapTransitions)+'\n');
console.log('RESULT_COUNT '+JSON.stringify({duel:duel.length,endurance:entryEndurance.length,zero:zero.length,transitions:mapTransitions.length}));
