import type {BattleJobRuntime} from '../types';
import type {JobDefinition} from './catalog';

export function createJobRuntime(job:JobDefinition|null):BattleJobRuntime {const kit=job?.combatKit;return {jobId:job?.id??null,passiveIds:kit?[...kit.passiveIds]:[],activeSkillIds:kit?[...kit.activeSkillIds]:[],resource:{id:'combat',value:0,maxValue:4}};}
