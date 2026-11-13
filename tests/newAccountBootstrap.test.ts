import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {entrySyncOwner,isEntryCloudSyncReady} from '../src/online/entrySyncGate';
import {connectionErrorMessage} from '../src/components/intro/EntryConnectionScreen';

test('first server bootstrap owns cloud synchronization until its record is fully restored',()=>{
 const first={leaseId:'first',generation:1};
 const next={leaseId:'next',generation:2};
 assert.equal(isEntryCloudSyncReady(first,null),false,'before first boot there must be no automatic push');
 assert.equal(isEntryCloudSyncReady(first,entrySyncOwner(next)),false,'stale sessions must not unlock a new account');
 assert.equal(isEntryCloudSyncReady(first,entrySyncOwner(first)),true,'after first boot normal sync resumes');
 assert.equal(isEntryCloudSyncReady(null,entrySyncOwner(first)),false);
});

test('new account initial restore is single writer and unlocks automatic sync only afterwards',()=>{
 const app=readFileSync('src/main.tsx','utf8');
 assert.match(app,/const \[entryReadyOwner,setEntryReadyOwner\]=useState<string\|null>\(null\)/);
 assert.match(app,/setEntryReadyOwner\(null\);setGameplayLease\(result\.lease\)/);
 assert.match(app,/setEntryReadyOwner\(null\);setEntryLoadStatus\('loading'\)/);
 assert.match(app,/setEntryReadyOwner\(restored\?owner:null\)/);
 assert.match(app,/if\(!isEntryCloudSyncReady\(lease,entryReadyOwner\)\)return/,'runCloudSync must not run before first save finishes');
 assert.match(app,/isEntryCloudSyncReady\(gameplayLease,entryReadyOwner\)/,'only the active lease can auto-sync');
 assert.match(app,/\[onlineSession\?\.userId,gameSessionPhase,gameplayLease\?\.generation,entryReadyOwner\]/,'sync resubscribes after first restore');
 assert.match(app,/const synced=await reconcileCloudState\(initialState\(\),lease\)/,'first account bootstrap retains authoritative server startup');
 assert.match(app,/const restored=await restoreServerRun\(lease\)/,'entry load owns server initialization');
});

test('first-save conflict gives a retryable message instead of a misleading network outage',()=>{
 assert.match(connectionErrorMessage(new Error('SAVE_CONFLICT')),/저장|충돌/);
 assert.doesNotMatch(connectionErrorMessage(new Error('SAVE_CONFLICT')),/네트워크 연결을 확인/);
});
