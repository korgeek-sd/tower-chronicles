import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {APP_VERSION,IMPORT_BACKUP_KEY,SAVE_EXPORT_FORMAT,SAVE_KEY,createRepository,parseSaveImport,serializeSaveExport} from '../src/storage/repository.ts';

function memory(raw?:string){const map=new Map<string,string>();if(raw)map.set(SAVE_KEY,raw);return {map,repo:createRepository({getItem:key=>map.get(key)??null,setItem:(key,value)=>void map.set(key,value)})};}

test('SAVE EXPORT 01: v19 상태를 버전이 명시된 이식 가능한 봉투로 내보낸다',()=>{const state=initialState();state.silver=4321;const raw=serializeSaveExport(state,0),data=JSON.parse(raw);assert.equal(data.format,SAVE_EXPORT_FORMAT);assert.equal(data.formatVersion,1);assert.equal(data.appVersion,APP_VERSION);assert.equal(data.exportedAt,'1970-01-01T00:00:00.000Z');assert.deepEqual(parseSaveImport(raw),state);});

test('SAVE EXPORT 02: 이전 v18 원본 저장도 가져오기 과정에서 현재 형식으로 이전한다',()=>{const legacy:any=structuredClone(initialState());legacy.version=18;const imported=parseSaveImport(JSON.stringify(legacy));assert.equal(imported.version,21);assert.deepEqual(imported.silver,legacy.silver);});

test('SAVE EXPORT 03: 손상 파일과 미래 봉투 형식을 거부한다',()=>{assert.throws(()=>parseSaveImport('{broken'),/JSON/);assert.throws(()=>parseSaveImport(JSON.stringify({format:SAVE_EXPORT_FORMAT,formatVersion:2,state:initialState()})),/지원하지 않는/);assert.throws(()=>parseSaveImport(JSON.stringify({version:999})),/가져올 수 없습니다/);});

test('SAVE EXPORT 04: 가져오기는 검증 후 현재 저장을 백업하고 새 상태를 원자적으로 기록한다',()=>{const before=initialState(),after=initialState();before.silver=111;after.silver=999;const {map,repo}=memory(JSON.stringify(before)),loaded=repo.importSave(repo.exportSave(after,0));assert.equal(loaded.silver,999);assert.equal(JSON.parse(map.get(IMPORT_BACKUP_KEY)!).silver,111);assert.equal(JSON.parse(map.get(SAVE_KEY)!).silver,999);});

test('SAVE EXPORT 05: 가져오기 백업 쓰기가 실패하면 현재 저장을 덮어쓰지 않는다',()=>{const before=JSON.stringify(initialState()),after=initialState();after.silver=999;let main=before;const repo=createRepository({getItem:key=>key===SAVE_KEY?main:null,setItem:(key,value)=>{if(key===IMPORT_BACKUP_KEY)throw Error('storage full');if(key===SAVE_KEY)main=value;}});assert.throws(()=>repo.importSave(serializeSaveExport(after)));assert.equal(main,before);});
