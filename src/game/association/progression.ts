import type {Association} from '../types';

export type AssociationMissionType='EXPEDITION_CLEAR'|'BOSS_DEFEAT'|'EQUIPMENT_DROP';

export interface AssociationMission {
  id:string;
  title:string;
  type:AssociationMissionType;
  target:number;
  progress:number;
  rewardExp:number;
  completed:boolean;
}

export interface AssociationProgress {
  level:number;
  experience:number;
  missions:AssociationMission[];
}

export const ASSOCIATION_LEVEL_TABLE=[0,1000,5000,15000,30000,60000,120000,250000,500000,1000000];

export function associationLevel(exp:number){
  let level=1;
  ASSOCIATION_LEVEL_TABLE.forEach((need,index)=>{if(exp>=need)level=index+1;});
  return Math.min(level,10);
}

export function addAssociationExp(progress:AssociationProgress,amount:number):AssociationProgress{
  const next={...progress,experience:Math.max(0,progress.experience+amount)};
  next.level=associationLevel(next.experience);
  return next;
}

export const ASSOCIATION_BUFFS={
  expeditionGold:'탐험 종료 Silver +2%',
  recovery:'귀환 비용 -5%',
  equipment:'장비 발견 확률 +1%'
} as const;

export function createWeeklyMissions():AssociationMission[]{
  return [
    {id:'ore-explore',title:'철맥 탐사 기록',type:'EXPEDITION_CLEAR',target:100,progress:0,rewardExp:500,completed:false},
    {id:'boss-hunt',title:'탑의 수호자 토벌',type:'BOSS_DEFEAT',target:10,progress:0,rewardExp:1000,completed:false}
  ];
}

export function hasAssociationMember(association:Association,playerId:string){
  return association.members.some(member=>member.playerId===playerId);
}
