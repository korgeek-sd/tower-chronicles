import type {ExpeditionEventDefinition} from './types';
// Authored tower events go here. Test content is NEVER merged into this catalog.
export const EVENT_CATALOG:ExpeditionEventDefinition[]=[];
export const BOSS_EVENT:ExpeditionEventDefinition={id:'boss_encounter',type:'BOSS',title:'강력한 존재의 흔적',description:'앞쪽에서 거대한 발소리가 들려옵니다. 흔적을 따라가면 이 구역의 보스와 마주할 수 있습니다.',weight:1,conditions:[{kind:'BOSS_FLOOR',value:true}],choices:[{id:'challenge',label:'도전한다',description:'준비를 마치고 보스에게 향합니다.',icon:'⚔',styleVariant:'PRIMARY',effects:[{kind:'START_BOSS_BATTLE'}],resultText:'보스에게 향할 준비를 마쳤습니다.'},{id:'skip',label:'지나간다',description:'이번 흔적을 포기하고 탐사를 계속합니다.',icon:'⇥',styleVariant:'SKIP',effects:[],resultText:'흔적을 뒤로하고 다른 길로 나아갑니다.'}]};
// Asset keys are resolved centrally; missing or failed art receives a neutral placeholder.
export const EVENT_ASSETS:Record<string,string>={dev_mine_backdrop:'./assets/backgrounds/ore/t1.png',potion:'./assets/ui/inventory/health.png',ore:'./assets/ui/inventory/ore.png',silver:'./assets/ui/pixel-v1/13-silver-icon.png'};
export const eventAsset=(key?:string)=>key?EVENT_ASSETS[key]:undefined;
