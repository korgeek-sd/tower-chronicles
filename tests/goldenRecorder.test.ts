import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {cost,startCraft,CRAFT_QUEUE_LIMIT} from '../src/game/engine/crafting.ts';
import {savePreset,getPresetSlotLimit} from '../src/game/engine/presets.ts';
import {createRepository,GOLDEN_RECORDER_BACKUP_KEY,migrateV7,SAVE_KEY,validSave} from '../src/storage/repository.ts';
import {withHistoricalTickets} from './legacyFixture.ts';

const NOW=2_000_000_000_000;
const legacyActive=()=>{const s=initialState();s.goldenRecorder.expiresAt=NOW+86_400_000;return s;};
const v7=()=>{const s:any=initialState();s.version=7;delete s.goldenRecorder;return withHistoricalTickets(s);};

test('레거시 프리미엄 제거 01: 예전 만료값이 있어도 제작 비용에 영향을 주지 않는다',()=>{
 const normal=initialState(),legacy=legacyActive();
 normal.mastery.alchemy.crafts=1;legacy.mastery.alchemy.crafts=1;
 assert.equal(cost(normal,'alchemy',4,NOW),cost(legacy,'alchemy',4,NOW));
});
test('레거시 프리미엄 제거 02: 모든 계정이 프리셋 5칸을 사용한다',()=>{
 let s=initialState();assert.equal(getPresetSlotLimit(),5);s=savePreset(s,5,'다섯번째');assert.equal(s.expeditionPresets[4]?.name,'다섯번째');
});
test('레거시 프리미엄 제거 03: 모든 계정이 제작 대기열 3칸을 사용한다',()=>{
 let s=initialState();s.mastery.alchemy.unlocked=1;s.materials.kaleon[0]=999;
 for(let i=0;i<1+CRAFT_QUEUE_LIMIT;i++)s=startCraft(s,'healing_lesser',1,10,NOW+i);
 assert.equal(s.crafting.jobs.filter(j=>j.status==='CRAFTING').length,1);
 assert.equal(s.crafting.jobs.filter(j=>j.status==='QUEUED').length,CRAFT_QUEUE_LIMIT);
 const blocked=startCraft(s,'healing_lesser',1,10,NOW+99);assert.equal(blocked.crafting.jobs.length,s.crafting.jobs.length);assert.match(blocked.notice,/대기열/);
});
test('레거시 프리미엄 제거 04: 예전 저장 필드는 호환성 검증만 유지한다',()=>{assert.equal(validSave(legacyActive()),true);});
test('레거시 프리미엄 제거 05: v7→v8 이력 마이그레이션과 원본 백업은 계속 동작한다',()=>{
 const old=v7(),direct=migrateV7(old);assert.equal(direct.version,8);assert.deepEqual(direct.goldenRecorder,{expiresAt:null});
 const raw=JSON.stringify(old),mem=new Map<string,string>([[SAVE_KEY,raw]]),repo=createRepository({getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)});
 assert.equal(repo.load().version,23);assert.equal(mem.get(GOLDEN_RECORDER_BACKUP_KEY),raw);
});
