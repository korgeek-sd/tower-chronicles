import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {savePreset,getPresetSlotLimit} from '../src/game/engine/presets.ts';
import {createRepository,GOLDEN_RECORDER_BACKUP_KEY,migrateV7,SAVE_KEY,validSave} from '../src/storage/repository.ts';
import {withHistoricalTickets} from './legacyFixture.ts';

const NOW=2_000_000_000_000;
const legacyActive=()=>{const s=initialState();s.goldenRecorder.expiresAt=NOW+86_400_000;return s;};
const v7=()=>{const s:any=initialState();s.version=7;delete s.goldenRecorder;return withHistoricalTickets(s);};

test('레거시 프리미엄 제거 01: 모든 계정이 프리셋 5칸을 사용한다',()=>{
 let s=initialState();assert.equal(getPresetSlotLimit(),5);s=savePreset(s,5,'다섯번째');assert.equal(s.expeditionPresets[4]?.name,'다섯번째');
});
test('레거시 프리미엄 제거 02: 예전 저장 필드는 호환성 검증만 유지한다',()=>{assert.equal(validSave(legacyActive()),true);});
test('레거시 프리미엄 제거 03: v7→v8 이력 마이그레이션과 원본 백업은 계속 동작한다',()=>{
 const old=v7(),direct=migrateV7(old);assert.equal(direct.version,8);assert.deepEqual(direct.goldenRecorder,{expiresAt:null});
 const raw=JSON.stringify(old),mem=new Map<string,string>([[SAVE_KEY,raw]]),repo=createRepository({getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)});
 assert.equal(repo.load().version,23);assert.equal(mem.get(GOLDEN_RECORDER_BACKUP_KEY),raw);
});
