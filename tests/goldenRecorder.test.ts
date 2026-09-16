import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {cost} from '../src/game/engine/crafting.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {applyPreset,savePreset} from '../src/game/engine/presets.ts';
import {extendGoldenRecorder,getGoldenPresetSlotLimit,getGoldenRecorderBenefits,isGoldenRecorderActive,remainingGoldenTime} from '../src/game/premium/goldenRecorder.ts';
import {createRepository,GOLDEN_RECORDER_BACKUP_KEY,migrateV7,SAVE_KEY,validSave} from '../src/storage/repository.ts';

const NOW=2_000_000_000_000;
const active=()=>{const s=initialState();s.goldenRecorder.expiresAt=NOW+86_400_000;return s;};
const v7=()=>{const s:any=initialState();s.version=7;delete s.goldenRecorder;return s;};

test('황금기록자 01-04: null·과거·정각은 비활성이고 미래 시각만 활성이다',()=>{
 const s=initialState();assert.equal(isGoldenRecorderActive(s,NOW),false);
 s.goldenRecorder.expiresAt=NOW-1;assert.equal(isGoldenRecorderActive(s,NOW),false);
 s.goldenRecorder.expiresAt=NOW;assert.equal(isGoldenRecorderActive(s,NOW),false);
 s.goldenRecorder.expiresAt=NOW+1;assert.equal(isGoldenRecorderActive(s,NOW),true);
});

test('황금기록자 05-07: 권한별 혜택은 한 도우미에서 계산된다',()=>{
 assert.deepEqual(getGoldenRecorderBenefits(initialState(),NOW),{presetSlots:2,craftingMaterialReductionBonus:0,goldSaleFeeRate:.02});
 assert.deepEqual(getGoldenRecorderBenefits(active(),NOW),{presetSlots:5,craftingMaterialReductionBonus:.02,goldSaleFeeRate:.01});
 assert.equal(getGoldenPresetSlotLimit(active(),NOW),5);
});

test('황금기록자 08-12: 만료 시 전용 프리셋 데이터는 보존되고 재활성화하면 다시 쓴다',()=>{
 let s=active();s=savePreset(s,3,'보존',getGoldenPresetSlotLimit(s,NOW));const stored=structuredClone(s.expeditionPresets[2]);
 assert.equal(getGoldenPresetSlotLimit(s,NOW+86_400_000),2);
 const blocked=applyPreset(s,3,getGoldenPresetSlotLimit(s,NOW+86_400_000));assert.deepEqual(blocked.expeditionPresets[2],stored);assert.match(blocked.notice,/잠긴/);
 const restored=applyPreset(s,3,getGoldenPresetSlotLimit(s,NOW));assert.equal(restored.notice,'보존 프리셋을 불러왔습니다.');
});

test('황금기록자 13-15: 시간 경과는 현재 준비 설정과 진행 중 원정을 바꾸지 않는다',()=>{
 let s=active();s.loadout.healing_lesser=7;s=enter(s,'ore',1);const before=structuredClone(s);
 assert.equal(isGoldenRecorderActive(s,NOW+86_400_000),false);assert.deepEqual(s,before);
});

test('황금기록자 16-19: 제작 할인은 숙련도와 합산되고 만료 즉시 빠진다',()=>{
 const s=active();s.mastery.weapon.crafts=1;
 assert.equal(cost(s,'weapon',5,NOW),29);assert.equal(cost(s,'weapon',5,NOW+86_400_000),30);
 s.mastery.weapon.crafts=1000;assert.equal(cost(s,'weapon',5,NOW),21);
 s.materials.ore[0]=1;assert.equal(cost(s,'weapon',1,NOW),5);
});

test('황금기록자 20-23: 남은 기간은 24시간 이상 일, 미만 시간으로 표시한다',()=>{
 assert.equal(remainingGoldenTime(null,NOW),'미등록');assert.equal(remainingGoldenTime(NOW,NOW),'미등록');
 assert.equal(remainingGoldenTime(NOW+25*3_600_000,NOW),'2일');assert.equal(remainingGoldenTime(NOW+23*3_600_000,NOW),'23시간');
});

test('황금기록자 24-27: 기간 추가는 활성 잔여기간 뒤와 만료 시점부터 순수하게 연장한다',()=>{
 const s=active(),extended=extendGoldenRecorder(s,NOW,3_600_000);assert.equal(extended.goldenRecorder.expiresAt,NOW+90_000_000);assert.equal(s.goldenRecorder.expiresAt,NOW+86_400_000);
 const expired=initialState();expired.goldenRecorder.expiresAt=NOW-1;assert.equal(extendGoldenRecorder(expired,NOW,3_600_000).goldenRecorder.expiresAt,NOW+3_600_000);
});

test('황금기록자 28-32: expiresAt 형식과 유한·비음수 범위를 검증한다',()=>{
 for(const value of [NaN,Infinity,-1,'soon',{}]){const s:any=initialState();s.goldenRecorder.expiresAt=value;assert.equal(validSave(s),false);}
 assert.equal(validSave(initialState()),true);
});

test('황금기록자 33-38: v7→v8은 전체 상태를 보존하고 원본을 한 번 백업한다',()=>{
 const old=v7();old.silver=77;old.expeditionPresets[4]={name:'5번',equipment:{...old.equipped},skills:[...old.skills],potions:{...old.loadout},threshold:old.threshold};old.tickets.ore[0]=1;old.expedition=enter(old,'ore',1).expedition;
 const direct=migrateV7(old);assert.equal(direct.version,8);assert.deepEqual(direct.goldenRecorder,{expiresAt:null});assert.deepEqual(direct.expeditionPresets,old.expeditionPresets);assert.deepEqual(direct.expedition,old.expedition);assert.equal(direct.silver,77);
 const raw=JSON.stringify(old),mem=new Map<string,string>([[SAVE_KEY,raw]]),repo=createRepository({getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)});assert.equal(repo.load().version,20);assert.equal(mem.get(GOLDEN_RECORDER_BACKUP_KEY),raw);repo.load();assert.equal(mem.get(GOLDEN_RECORDER_BACKUP_KEY),raw);
});

test('황금기록자 39: 백업 실패 시 v7 원본 저장값을 덮어쓰지 않는다',()=>{
 const raw=JSON.stringify(v7()),repo=createRepository({getItem:k=>k===SAVE_KEY?raw:null,setItem:(k)=>{if(k===GOLDEN_RECORDER_BACKUP_KEY)throw Error('full');}});assert.throws(()=>repo.load());
});





