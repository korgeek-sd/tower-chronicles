export type VillageWarPhase='WAITING'|'DEPLOYMENT'|'BATTLE'|'ENDED';
export function villageWarWindow(now=Date.now()){
 const shifted=new Date(now+9*3600000),day=(shifted.getUTCDay()+6)%7;
 const monday=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate()-day);
 const battleStartsAt=monday-9*3600000+5*86400000+22*3600000;
 const deploymentStartsAt=battleStartsAt-300000,battleEndsAt=battleStartsAt+3600000;
 const phase:VillageWarPhase=now<deploymentStartsAt?'WAITING':now<battleStartsAt?'DEPLOYMENT':now<battleEndsAt?'BATTLE':'ENDED';
 return {cycleKey:new Date(monday).toISOString().slice(0,10),deploymentStartsAt,battleStartsAt,battleEndsAt,phase};
}
