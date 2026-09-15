import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState} from '../src/game/engine/state.ts';
import {enter,leave,requestReturn} from '../src/game/engine/expedition.ts';
import {reward} from '../src/game/engine/drops.ts';
import {lootLines} from '../src/game/engine/loot.ts';
import {createRepository,migrateV3,validSave,SAVE_KEY,SILVER_BACKUP_KEY} from '../src/storage/repository.ts';

function memory(raw?:string){const mem=new Map<string,string>();if(raw)mem.set(SAVE_KEY,raw);return {mem,repo:createRepository({getItem:k=>mem.get(k)??null,setItem:(k,v)=>void mem.set(k,v)})};}
function oldV3(active=true){
 const s=initialState();s.silver=100000;
 const value:any=JSON.parse(JSON.stringify(active?requestReturn(enter(s,'ore',1)):s));
 value.gold=value.silver;delete value.silver;value.version=3;
 if(value.expedition){value.expedition.loot.gold=5000;delete value.expedition.loot.silver;value.expedition.hp=99;value.expedition.monster.currentHp=17;value.expedition.time=12;value.expedition.kills=2;}
 return value;
}
test('Silver 01-03: 초기 v13, Silver 0, 루트 gold 필드 없음',()=>{const s:any=initialState();assert.equal(s.version,19);assert.equal(s.silver,0);assert.ok(!('gold' in s));});
test('Silver 04-07: 처치 임시 보관, 귀환 정확한 합산과 중복 방지',()=>{let s=enter(initialState(),'ore',1);reward(s,()=>.99);assert.equal(s.silver,0);assert.equal(s.expedition!.loot.silver,13);s=leave(s);assert.equal(s.silver,13);assert.equal(leave(s).silver,13);});
test('Silver 08-10: 사망 시 기존 재산 보존, 손실 결과만 기록',()=>{const base=initialState();base.silver=100;const s=enter(base,'ore',1);reward(s,()=>.99);const n=leave(s,true);assert.equal(n.silver,100);assert.equal(n.expedition,null);assert.equal(n.lastExpedition!.loot.silver,13);});
test('Silver 11-13: 영구 100000과 원정 5000 분리 이전 및 gold 제거',()=>{const n:any=migrateV3(oldV3());assert.equal(n.silver,100000);assert.equal(n.expedition.loot.silver,5000);assert.ok(!('gold' in n));assert.ok(!('gold' in n.expedition.loot));});
test('Silver 14: 귀환/사망 결과 3000 보존',()=>{for(const dead of [false,true]){const v=oldV3(false),receipt:any=JSON.parse(JSON.stringify(leave(enter(initialState(),'ore',1),dead).lastExpedition));receipt.loot.gold=3000;delete receipt.loot.silver;v.lastExpedition=receipt;const n:any=migrateV3(v);assert.equal(n.lastExpedition.loot.silver,3000);assert.equal(n.lastExpedition.outcome,dead?'dead':'returned');assert.ok(!('gold' in n.lastExpedition.loot));}});
test('Silver 15: 전투 HP, 시간, 포션, 장비 잠금, 귀환 예약과 나머지 상태 보존',()=>{const v=oldV3(),n:any=migrateV3(v),expected=structuredClone(v);expected.version=4;expected.silver=expected.gold;delete expected.gold;expected.expedition.loot.silver=expected.expedition.loot.gold;delete expected.expedition.loot.gold;assert.deepEqual(n,expected);});
test('Silver 18-19,24-25: 백업 1회, 반복 저장과 로드 수량 보존',()=>{const raw=JSON.stringify(oldV3()),{repo,mem}=memory(raw);for(let i=0;i<5;i++){const s=repo.load();assert.equal(s.silver,100000);assert.equal(s.expedition!.loot.silver,5000);repo.save(s);}assert.equal(mem.get(SILVER_BACKUP_KEY),raw);});
test('Silver 20,23: 손상된 과거 화폐 거부 및 원본 유지',()=>{for(const value of [-1,1.5,'100',null,Number.MAX_SAFE_INTEGER+1]){const v=oldV3();v.gold=value;const raw=JSON.stringify(v),{repo,mem}=memory(raw);assert.throws(()=>repo.load());assert.equal(mem.get(SAVE_KEY),raw);assert.equal(mem.get(SILVER_BACKUP_KEY),undefined);}});
test('Silver 21-22: 음수/NaN/Infinity/소수/unsafe 값 세 위치 모두 거부',()=>{for(const value of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])for(const location of ['permanent','active','result']){const s:any=location==='result'?leave(enter(initialState(),'ore',1)):enter(initialState(),'ore',1);if(location==='permanent')s.silver=value;else if(location==='active')s.expedition.loot.silver=value;else s.lastExpedition.loot.silver=value;assert.equal(validSave(s),false);}});
test('v4에 중복 gold 필드가 있으면 세 위치 모두 거부',()=>{for(const location of ['permanent','active','result']){const s:any=location==='result'?leave(enter(initialState(),'ore',1)):enter(initialState(),'ore',1);if(location==='permanent')s.gold=0;else if(location==='active')s.expedition.loot.gold=0;else s.lastExpedition.loot.gold=0;assert.equal(validSave(s),false);}});
test('백업 쓰기 실패 시 원본 메인 저장 유지',()=>{const raw=JSON.stringify(oldV3());let main=raw;const repo=createRepository({getItem:k=>k===SAVE_KEY?main:null,setItem:(k,v)=>{if(k===SILVER_BACKUP_KEY)throw Error('full');main=v;}});assert.throws(()=>repo.load());assert.equal(main,raw);});
test('v3 임시 전리품과 결과의 손상된 gold도 거부',()=>{const v=oldV3();v.expedition.loot.gold=-1;assert.throws(()=>migrateV3(v));const r=oldV3(false),receipt:any=JSON.parse(JSON.stringify(leave(enter(initialState(),'ore',1)).lastExpedition));receipt.loot.gold='bad';delete receipt.loot.silver;r.lastExpedition=receipt;assert.throws(()=>migrateV3(r));});
test('Silver 26-31: 일반 화폐 계약은 silver이고 프리미엄 Gold와 분리된다',()=>{const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8'),panel=readFileSync(new URL('../src/components/ExpeditionLoot.tsx',import.meta.url),'utf8');assert.match(main,/game\.silver\.toLocaleString/);assert.match(main,/silver:stateRef\.current\.silver/);assert.match(main,/silver:next\.silver/);assert.match(main,/game\.market\.gold\.toLocaleString/);assert.match(panel,/e\.loot\.silver\.toLocaleString/);assert.ok(!/game\.gold\b|stateRef\.current\.gold\b|next\.gold\b|e\.loot\.gold\b/.test(main+panel));for(const dead of [false,true]){const s=enter(initialState(),'ore',1);reward(s,()=>.99);assert.match(lootLines(leave(s,dead).lastExpedition!.loot).join('\n'),/Silver 13/);}});









