import type {BattleJobRuntime,GameState} from '../types';
import {jobById,isValidJobId,type JobCombatKit} from './catalog';
import {createJobRuntime} from './runtime';

export type GrantJobResult={state:GameState;status:'granted'|'alreadyOwned'|'invalid'};
export function ownsJob(state:GameState,jobId:string){return state.ownedJobIds.includes(jobId);}
export function getOwnedJobs(state:GameState){return state.ownedJobIds.map(jobById).filter((job):job is NonNullable<typeof job>=>!!job);}
export function grantJob(state:GameState,jobId:string):GrantJobResult {if(!isValidJobId(jobId))return {state,status:'invalid'};if(ownsJob(state,jobId))return {state,status:'alreadyOwned'};const next=structuredClone(state);next.ownedJobIds.push(jobId);return {state:next,status:'granted'};}
export function setCurrentJob(state:GameState,jobId:string|null):GameState {if(state.expedition)return {...state,notice:'원정 중에는 직업을 변경할 수 없습니다.'};if(jobId!==null&&(!isValidJobId(jobId)||!ownsJob(state,jobId)))return {...state,notice:'보유한 직업만 선택할 수 있습니다.'};const next=structuredClone(state);next.currentJobId=jobId;next.notice=jobId?`${jobById(jobId)!.displayName} 직업을 선택했습니다.`:'직업 선택을 해제했습니다.';return next;}
export function resolveBattleJobId(state:GameState){return state.expedition?state.expedition.jobSnapshotId:(isValidJobId(state.currentJobId)?state.currentJobId:null);}
export function createBattleJobRuntime(jobId:string|null):BattleJobRuntime {return createJobRuntime(jobById(jobId));}
/** Deprecated compatibility: real job kits take priority once authored in v0.1.24. */
export function resolvePlayerCombatKit(state:GameState):JobCombatKit {const job=jobById(resolveBattleJobId(state));return job?.combatKit??{passiveIds:['legacy-passive-1','legacy-passive-2'],activeSkillIds:state.skills.map(id=>id??'') as [string,string,string]};}
