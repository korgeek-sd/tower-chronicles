import type {BattleJobRuntime} from '../types';
import type {JobDefinition} from './catalog';

export function createJobRuntime(job:JobDefinition|null):BattleJobRuntime {const kit=job?.combatKit;return {jobId:job?.id??null,passiveIds:kit?[...kit.passiveIds]:[],activeSkillIds:kit?[...kit.activeSkillIds]:[],resource:job?.jobResource?{id:job.jobResource.id,value:job.jobResource.initialValue,maxValue:job.jobResource.maxValue}:null};}
