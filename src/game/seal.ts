export const ASSOCIATION_SEAL_MAX_LEVEL=30;
export const ASSOCIATION_SEAL_MAX_ROLLS=20;
export const ASSOCIATION_SEAL_ROLL_COST=300;
export const ASSOCIATION_SEAL_RESET_COST=3000;
// Official basic table only. Index = current level; source row = current level + 1.
// Keep in sync with private.association_seal_probability_weights (tested in SQL).
export const ASSOCIATION_SEAL_STAGE_WEIGHTS=[
 [6250,3300,450],[6450,3100,450],[6650,2900,450],[6850,2700,450],
 [7050,2500,450],[7250,2300,450],[7450,2100,450],[7650,1900,450],
 [7950,1700,350],[8150,1500,350],[8350,1300,350],[8550,1100,350],
 [8650,1000,350],[8750,900,350],[8850,800,350],[8850,800,350],
 [8850,800,350],[8950,800,250],[8950,800,250],[8950,800,250],
 [8950,800,250],[9150,700,150],[9150,700,150],[9150,700,150],
 [9350,500,150],[9600,300,100],[9700,200,100],[9805,150,45],
 [9925,75,0],[10000,0,0],
] as const;

/** Display only: the server selects the outcome from the locked seal level. */
export function associationSealProbabilities(level:number){
 const safe=Math.max(0,Math.min(29,Math.floor(Number.isFinite(level)?level:0)));
 const weights=ASSOCIATION_SEAL_STAGE_WEIGHTS[safe];
 return ([1,2,3] as const).map((step,index)=>({step,rate:weights[index]/100}));
}

const MILESTONE_HP_BONUS:[number,number][]=[
 [5,.2],[10,.3],[15,.4],[20,.5],[25,.6],[30,1],
];

export interface AssociationSealReward {
 hpPercent:number;
 attackPercent:number;
 defensePercent:number;
}

export function associationSealReward(level:number):AssociationSealReward {
 const safe=Math.max(0,Math.min(ASSOCIATION_SEAL_MAX_LEVEL,Math.floor(Number.isFinite(level)?level:0)));
 let hp=safe*.1;
 for(const [threshold,bonus] of MILESTONE_HP_BONUS)if(safe>=threshold)hp+=bonus;
 hp=Number(hp.toFixed(2));
 return {
  hpPercent:hp,
  attackPercent:Number((hp/2).toFixed(2)),
  defensePercent:Number((hp/2).toFixed(2)),
 };
}

const ROMAN:[number,string][]=[
 [10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I'],
];

export function associationSealRoman(level:number){
 let value=Math.max(0,Math.min(ASSOCIATION_SEAL_MAX_LEVEL,Math.floor(level)));
 if(value===0)return '0';
 let out='';
 while(value>0){
  const pair=ROMAN.find(([n])=>n<=value)!;
  out+=pair[1];
  value-=pair[0];
 }
 return out;
}

export function associationSealNextMilestone(level:number){
 const safe=Math.max(0,Math.min(ASSOCIATION_SEAL_MAX_LEVEL,Math.floor(level)));
 return [5,10,15,20,25,30].find(value=>value>safe)??30;
}

/** Must match private.guardian_seal_bonus_json for server-authoritative stats. */
export function guardianSealReward(level:number):AssociationSealReward {
 const combat=associationSealReward(level);
 return {hpPercent:Number((combat.hpPercent/2).toFixed(2)),attackPercent:0,defensePercent:combat.hpPercent};
}
