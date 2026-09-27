export const ASSOCIATION_SEAL_MAX_LEVEL=30;
export const ASSOCIATION_SEAL_MAX_ROLLS=20;
export const ASSOCIATION_SEAL_ROLL_COST=300;
export const ASSOCIATION_SEAL_RESET_COST=3000;
export const ASSOCIATION_SEAL_PROBABILITIES=[
 {step:1 as const,rate:76},
 {step:2 as const,rate:20},
 {step:3 as const,rate:4},
];

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
