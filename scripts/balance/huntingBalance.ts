import {readFileSync} from 'node:fs';
import {HUNT_MAPS,combatStats,applyStatAllocation,initialHuntingState,resolveHunt,statPointsForLevel,type CombatInput,type HuntMapId,type StatAllocation} from '../../src/game/hunting/model';
import {EQUIPMENT_SLOTS,equipmentItemStats} from '../../src/game/data/equipment';
import {HUNT_EQUIPMENT_RATES} from '../../src/game/hunting/equipmentDrops';
import type {EquipmentGrade,EquipmentKind,Slot} from '../../src/game/types';

export type BuildName='balanced'|'offense'|'defense'|'critical';
export type GearName='under'|'standard'|'high';
export type RunMode='duel'|'endurance';
export type MonsterOverride=Partial<Record<HuntMapId,{hp:number;attack:number;defense:number}>>;
export interface BalanceOptions {
 levels:number[];
 builds:BuildName[];
 gears:GearName[];
 maps:HuntMapId[]|'recommended';
 mode:RunMode;
 runs:number;
 seed:number;
 potions:number;
 food:'none'|'attack'|'defense'|'experience';
 candidate?:MonsterOverride;
}
export interface BalanceRow {
 version:'baseline'|'candidate';mapId:HuntMapId;mapName:string;level:number;
 build:BuildName;gear:GearName;equipmentStage:string;points:StatAllocation;
 hp:number;attack:number;defense:number;critChance:number;critDamage:number;armorPenetration:number;
 attempts:number;wins:number;winRate:number;win95Low:number;win95High:number;meanTurns:number;p90Turns:number;
 meanBattleHpLoss:number;potionsPerAttempt:number;potionsPerWin:number;
 xpPerVitality:number;silverPerVitality:number;equipmentPerVitality:number;expectedEquipmentPerVitality:number;
 underHealedRate:number;meanRemainingPotions:number;
}
const BASE={hp:180,attack:8,defense:3,critChance:.05,critDamage:1.5,armorPenetration:0};
const KIND_BY_SLOT:Record<Slot,EquipmentKind>={
 weapon:'association_supply_iron_sword',helmet:'expedition_iron_helmet',armor:'return_corps_plate_armor',
 gloves:'mining_detail_reinforced_gloves',boots:'survey_corps_dust_boots',
 necklace:'association_registration_tag',ring:'expedition_merit_ring',
};
const STAGES:readonly {name:string;grade:EquipmentGrade;slots:readonly Slot[]}[]=[
 {name:'starter-sword',grade:'common',slots:['weapon']},
 {name:'three-common',grade:'common',slots:['weapon','helmet','gloves']},
 {name:'full-common',grade:'common',slots:EQUIPMENT_SLOTS},
 {name:'full-uncommon',grade:'uncommon',slots:EQUIPMENT_SLOTS},
 {name:'full-rare',grade:'rare',slots:EQUIPMENT_SLOTS},
 {name:'full-heroic',grade:'heroic',slots:EQUIPMENT_SLOTS},
 {name:'full-legendary',grade:'legendary',slots:EQUIPMENT_SLOTS},
];
export const DEFAULT_BALANCE_OPTIONS:BalanceOptions={
 levels:[1,10,20,30,40,50,60,70,80,90,100],
 builds:['balanced','offense','defense','critical'],gears:['under','standard','high'],
 maps:'recommended',mode:'duel',runs:200,seed:20261010,potions:10000,food:'none',
};
export function recommendedMap(level:number):HuntMapId {
 if(level<20)return 'plains';
 if(level<40)return 'forest';
 if(level<60)return 'mine';
 if(level<80)return 'fortress';
 return 'ruins';
}
export function allocationForBuild(level:number,build:BuildName):StatAllocation {
 const total=statPointsForLevel(level);
 const fractions:Record<BuildName,readonly number[]>={
  balanced:[.30,.35,.30,.05],offense:[.12,.70,.13,.05],
  defense:[.45,.15,.35,.05],critical:[.20,.35,.20,.25],
 };
 const parts=fractions[build];if(!parts)throw Error('Unknown stat build: '+build);
 const values=parts.map(f=>Math.floor(total*f));
 values[3]=Math.min(10,values[3]);
 let remaining=total-values.reduce((x,y)=>x+y,0);
 // Largest fraction priority for the remaining points, but crit remains capped at 10.
 const priority=[...parts.keys()].sort((a,b)=>parts[b]-parts[a]||a-b);
 while(remaining>0)for(const i of priority) {
  if(remaining===0)break;
  if(i===3&&values[3]>=10)continue;
  values[i]++;remaining--;
 }
 return {hp:values[0],attack:values[1],defense:values[2],crit:values[3]};
}
export function gearStageForLevel(level:number,gear:GearName):number {
 const standard=level<10?0:level<30?1:level<60?2:level<80?3:level<90?4:5;
 return Math.max(0,Math.min(6,standard+(gear==='under'?-1:gear==='high'?1:0)));
}
export function buildPlayer(level:number,build:BuildName,gear:GearName){
 if(!Number.isInteger(level)||level<1||level>100)throw Error('Expected a level between 1 and 100');
 const stage=STAGES[gearStageForLevel(level,gear)];
 const basic:CombatInput={...BASE};
 for(const slot of stage.slots){
  const kind=KIND_BY_SLOT[slot];
  const item=equipmentItemStats({id:'simulation',kind,grade:stage.grade,enhancement:0});
  basic.hp+=(item.hp??0);basic.attack+=(item.attack??0);basic.defense+=(item.defense??0);
  basic.critChance=(basic.critChance??.05)+(item.critChance??0);
  basic.critDamage=(basic.critDamage??1.5)+(item.critDamage??0);
  basic.armorPenetration=(basic.armorPenetration??0)+(item.armorPenetration??0);
 }
 const points=allocationForBuild(level,build);
 return {basic,points,final:combatStats(applyStatAllocation(basic,points)),stage:stage.name};
}
export function seededRng(seed:number):()=>number {
 let t=seed>>>0;
 return ()=>{t=(t+0x6D2B79F5)>>>0;let z=Math.imul(t^(t>>>15),1|t);z^=z+Math.imul(z^(z>>>7),61|z);return ((z^(z>>>14))>>>0)/4294967296;};
}
function checkOptions(options:BalanceOptions){
 if(!Number.isInteger(options.runs)||options.runs<1||options.runs>100000)throw Error('runs must be 1..100000');
 if(!Number.isFinite(options.seed)||!Number.isInteger(options.seed))throw Error('seed must be an integer');
 if(!Number.isInteger(options.potions)||options.potions<0)throw Error('potions must be a nonnegative integer');
 for(const level of options.levels)if(!Number.isInteger(level)||level<1||level>100)throw Error('levels must be 1..100');
 for(const build of options.builds)if(!['balanced','offense','defense','critical'].includes(build))throw Error('Invalid build: '+build);
 for(const gear of options.gears)if(!['under','standard','high'].includes(gear))throw Error('Invalid gear: '+gear);
 for(const map of options.maps==='recommended'?[]:options.maps)if(!HUNT_MAPS.some(x=>x.id===map))throw Error('Invalid map: '+map);
 if(!['duel','endurance'].includes(options.mode))throw Error('Invalid simulation mode');
 if(!['none','attack','defense','experience'].includes(options.food))throw Error('Invalid food selection');
 for(const [key,monster] of Object.entries(options.candidate??{})) {
  if(!HUNT_MAPS.some(x=>x.id===key))throw Error('Invalid candidate map: '+key);
  if(!monster||!['hp','attack','defense'].every(k=>Number.isSafeInteger(monster[k as keyof typeof monster])&&monster[k as keyof typeof monster]!>0))throw Error('Candidate monsters require positive integer hp, attack and defense');
 }
}
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
const percentile90=(v:number[])=>v.length?[...v].sort((a,b)=>a-b)[Math.ceil(v.length*.9)-1]:0;
function withMonsterOverride<T>(mapId:HuntMapId,override:MonsterOverride|undefined,fn:()=>T):T {
 const monster=HUNT_MAPS.find(m=>m.id===mapId)!;
 const old={hp:monster.hp,attack:monster.attack,defense:monster.defense};
 const value=override?.[mapId];
 if(value)Object.assign(monster,value);
 try{return fn();}finally{Object.assign(monster,old);}
}
export function simulateBalance(options:Partial<BalanceOptions>={}):BalanceRow[] {
 const config={...DEFAULT_BALANCE_OPTIONS,...options};
 checkOptions(config);
 const rows:BalanceRow[]=[];
 const cases:{version:'baseline'|'candidate';changes?:MonsterOverride}[]=[{version:'baseline'}];
 if(config.candidate)cases.push({version:'candidate',changes:config.candidate});
 for(const level of config.levels)for(const build of config.builds)for(const gear of config.gears){
  const {basic,points,final,stage}=buildPlayer(level,build,gear);
  const mapIds=config.maps==='recommended'?[recommendedMap(level)]:config.maps;
  for(const mapId of mapIds)for(const candidate of cases){
   const map=HUNT_MAPS.find(m=>m.id===mapId)!;
   const row=withMonsterOverride(mapId,candidate.changes,()=>{
    const turns:number[]=[],damageLoss:number[]=[],potionsPer:number[]=[];
    let tries=0,wins=0,xp=0,silver=0,equipment=0,underhealed=0,remainingPotions=0,potionsOnWins=0;
    const perSeedAttempts=config.mode==='endurance'?100:1;
    for(let run=0;run<config.runs;run++){
     const rng=seededRng(config.seed+Math.imul(run,0x9E3779B1));
     let state={...initialHuntingState(0),statAllocation:{...points},
      potions:config.potions,
      foodTurns:config.food==='none'?{}:{[config.food+'_food']:config.mode==='endurance'?100:1}};
     for(let attempt=0;attempt<perSeedAttempts;attempt++){
      const {state:next,result}=resolveHunt(state,mapId,basic,['heavy','guard','quick'],0,rng);
      state=next;tries++;
      turns.push(result.turns.length);
      damageLoss.push(Math.max(0,(result.startHp??final.hp)-result.playerHp));
      potionsPer.push(result.potionsUsed??0);
      if((result.startHp??final.hp)<final.hp)underhealed++;
      if(result.outcome==='victory'){wins++;potionsOnWins+=result.potionsUsed??0;}
      xp+=result.exp;silver+=result.silver;
      if(result.equipment)equipment++;
     }
     remainingPotions+=state.potions??0;
    }
    const p=wins/tries,z=1.96,den=1+z*z/tries;
    const center=(p+z*z/(2*tries))/den,margin=z*Math.sqrt(p*(1-p)/tries+z*z/(4*tries*tries))/den;
    return {
     version:candidate.version,mapId,mapName:map.name,level,build,gear,equipmentStage:stage,points,
     hp:final.hp,attack:final.attack,defense:final.defense,critChance:final.critChance,
     critDamage:final.critDamage,armorPenetration:final.armorPenetration,
     attempts:tries,wins,winRate:p,win95Low:Math.max(0,center-margin),win95High:Math.min(1,center+margin),meanTurns:mean(turns),p90Turns:percentile90(turns),
     meanBattleHpLoss:mean(damageLoss),potionsPerAttempt:mean(potionsPer),
     potionsPerWin:wins?potionsOnWins/wins:0,
     xpPerVitality:xp/tries,silverPerVitality:silver/tries,equipmentPerVitality:equipment/tries,expectedEquipmentPerVitality:p*HUNT_EQUIPMENT_RATES[mapId].reduce((a,b)=>a+b,0)/1000000,
     underHealedRate:underhealed/tries,meanRemainingPotions:remainingPotions/config.runs,
    };
   });
   rows.push(row);
  }
 }
 return rows;
}
const round3=(value:number)=>Math.round(value*1000)/1000;
export function balanceCsv(rows:BalanceRow[]):string {
 const keys=['version','mapId','level','build','gear','equipmentStage','hp','attack','defense','critChance','attempts','winRate','win95Low','win95High','meanTurns','p90Turns','meanBattleHpLoss','potionsPerAttempt','potionsPerWin','xpPerVitality','silverPerVitality','equipmentPerVitality','expectedEquipmentPerVitality','underHealedRate','meanRemainingPotions'] as const;
 return [keys.join(','),...rows.map(row=>keys.map(k=>typeof row[k]==='number'?String(round3(row[k] as number)):row[k]).join(','))].join('\n');
}
export function balanceTable(rows:BalanceRow[]):string {
 const head='version | map | lvl | build | gear | hp | atk | def | crit% | win% | mean turns | p90 turns | potion/fight | XP/vitality | silver/vitality';
 return [head,...rows.map(r=>[r.version,r.mapId,r.level,r.build,r.gear,
  r.hp,round3(r.attack),round3(r.defense),round3(r.critChance*100),
  round3(r.winRate*100),round3(r.meanTurns),r.p90Turns,round3(r.potionsPerAttempt),
  round3(r.xpPerVitality),round3(r.silverPerVitality)].join(' | '))].join('\n');
}
function argsToOptions(args:string[]):{options:Partial<BalanceOptions>;format:'table'|'json'|'csv'} {
 const options:Partial<BalanceOptions>={};let format:'table'|'json'|'csv'='table';
 for(let i=0;i<args.length;i++){
  const flag=args[i];if(!flag.startsWith('--'))throw Error('Unexpected argument: '+flag);
  const value=args[++i];if(!value)throw Error('Missing value for '+flag);
  switch(flag){
   case '--runs':options.runs=Number(value);break;
   case '--seed':options.seed=Number(value);break;
   case '--levels':options.levels=value.split(',').map(Number);break;
   case '--builds':options.builds=value.split(',') as BuildName[];break;
   case '--gears':options.gears=value.split(',') as GearName[];break;
   case '--maps':options.maps=value==='recommended'?'recommended':value.split(',') as HuntMapId[];break;
   case '--potions':options.potions=Number(value);break;
   case '--mode':options.mode=value as RunMode;break;
   case '--food':options.food=value as BalanceOptions['food'];break;
   case '--candidate':options.candidate=JSON.parse(readFileSync(value,'utf8')) as MonsterOverride;break;
   case '--format':if(!['table','json','csv'].includes(value))throw Error('format must be table/json/csv');format=value as typeof format;break;
   default:throw Error('Unknown flag: '+flag);
  }
 }
 return {options,format};
}
if(process.argv[1]?.endsWith('/huntingBalance.ts')){
 try {
  const {options,format}=argsToOptions(process.argv.slice(2));
  const rows=simulateBalance(options);
  if(format==='csv')process.stdout.write(balanceCsv(rows)+'\n');
  else if(format==='json')process.stdout.write(JSON.stringify({source:'src/game/hunting/model.ts',mode:options.mode??'duel',seed:options.seed??DEFAULT_BALANCE_OPTIONS.seed,rows},null,2)+'\n');
  else process.stdout.write(balanceTable(rows)+'\n');
 }catch(error){process.stderr.write(String(error)+'\n');process.exitCode=1;}
}
