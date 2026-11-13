import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {hasClaimableQuestRewards,hasUnclaimedAttendance} from '../src/game/actionAlerts';

const quest=(completed:boolean,claimed:boolean)=>({id:'hunt',target:30,progress:completed?30:3,completed,claimed,reward:null});

test('claimable quest dot appears only when a completed reward is not claimed',()=>{
 assert.equal(hasClaimableQuestRewards(null),false);
 assert.equal(hasClaimableQuestRewards({daily:[quest(false,false)],weekly:[]}),false);
 assert.equal(hasClaimableQuestRewards({daily:[quest(true,true)],weekly:[]}),false);
 assert.equal(hasClaimableQuestRewards({daily:[quest(true,false)],weekly:[]}),true);
 assert.equal(hasClaimableQuestRewards({daily:[],weekly:[quest(true,false)]}),true);
 assert.equal(hasClaimableQuestRewards({daily:[quest(true,true)],weekly:[quest(true,true)]}),false);
});

test('attendance dot requires authoritative unclaimed server state',()=>{
 assert.equal(hasUnclaimedAttendance(null),false);
 assert.equal(hasUnclaimedAttendance({todayClaimed:true}),false);
 assert.equal(hasUnclaimedAttendance({todayClaimed:false}),true);
});

test('red-dot markers are only shown for real actions and refresh after successful claims',()=>{
 const app=readFileSync('src/main.tsx','utf8');
 const home=readFileSync('src/components/mobile/CoreScreens.tsx','utf8');
 const shop=readFileSync('src/components/mobile/NovarShopScreen.tsx','utf8');
 const quests=readFileSync('src/components/quests/QuestPage.tsx','utf8');
 const hook=readFileSync('src/online/useActionAlerts.ts','utf8');
 const css=readFileSync('src/mobile-game.css','utf8');
 assert.match(app,/useActionAlerts\(/);
 assert.match(app,/p==='shop'&&actionAlerts\.attendance/);
 assert.match(app,/p==='home'&&actionAlerts\.quests/);
 assert.match(home,/item\.id==='quests'&&actionAlerts\?\.quests/);
 assert.match(shop,/id==='attendance'&&attendance&&!attendance\.todayClaimed/);
 assert.match(shop,/window\.dispatchEvent\(new Event\('tc-action-alert-refresh'\)\)/);
 assert.match(quests,/window\.dispatchEvent\(new Event\('tc-action-alert-refresh'\)\)/);
 assert.match(hook,/getQuests\(lease,userId\)/);
 assert.match(hook,/getFreeAttendanceStatus\(lease,userId\)/);
 assert.match(hook,/document\.addEventListener\('visibilitychange'/);
 assert.match(hook,/window\.addEventListener\('tc-action-alert-refresh'/);
 assert.match(css,/\.tc-action-alert-dot\{/);
 assert.doesNotMatch(app,/actionAlerts\.quests\s*=\s*true/);
});


test('claimable red indicators use compact square geometry, not circles',()=>{
 const css=readFileSync('src/mobile-game.css','utf8');
 const block=css.match(/\.tc-action-alert-dot\{([^}]*)\}/)?.[1];
 assert.ok(block,'shared action marker rule must exist');
 assert.match(block,/width:10px;height:10px/);
 assert.match(block,/border-radius:0(?:;|\\s)/,'show sharp square corners');
 assert.doesNotMatch(block,/border-radius:50%/);
});
