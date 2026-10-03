/** Direct-hit order: attack modifiers -> action/weapon multiplier -> defense -> critical. */
export const DEFENSE_SCALE=100;
export const damage=(attack:number,defense:number,multiplier=1,criticalMultiplier=1,penetrationRate=0)=>{
 const effective=Math.max(0,defense)*(1-Math.max(0,Math.min(1,penetrationRate)));
 return Math.max(1,Math.floor(Math.max(0,attack*multiplier)*DEFENSE_SCALE/(DEFENSE_SCALE+effective)*criticalMultiplier));
};
export function resolveHits(currentHp:number,hits:number,damagePerHit:()=>number){const values:number[]=[];let remaining=Math.max(0,currentHp);for(let index=0;index<Math.max(1,Math.floor(hits));index++){if(remaining<=0)break;const dealt=Math.min(remaining,Math.max(0,damagePerHit()));remaining-=dealt;values.push(dealt);}return {remaining,total:values.reduce((sum,value)=>sum+value,0),hits:values};}
