import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {beginEncounter} from '../src/game/events/service.ts';
import {IRON_BOSS_SLOTS} from '../src/game/data/ironSpire.ts';
import {applyEffect} from '../src/game/engine/effects.ts';
import {definitionForRuntime} from '../src/game/engine/monsterAi.ts';
import {prepareReactive} from '../src/game/engine/reactions.ts';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TOWER_PLAYWRIGHT||'C:/Users/양문지역아동센터2/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url=process.env.TOWER_QA_URL||'http://127.0.0.1:5186/';
const output='qa-v0.1.24/battle-redesign';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],cases=[];
page.on('pageerror',error=>errors.push(error.message));
async function saved(){return page.evaluate(()=>JSON.parse(localStorage.getItem('tower-record-v1')));}
async function seed(state){await page.goto(url);await page.evaluate(s=>localStorage.setItem('tower-record-v1',JSON.stringify(s)),state);await page.reload();await page.getByRole('button',{name:'기본 공격',exact:true}).waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('.encounter-art img')).length>=3&&Array.from(document.querySelectorAll('.encounter-art img')).every(img=>img.complete&&img.naturalWidth>0));}
async function turnComplete(){await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tower-record-v1')).expedition?.phase==='PLAYER_TURN');}
async function geometry(){const result=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scene:document.querySelector('.encounter-art').getBoundingClientRect().toJSON(),console:document.querySelector('.combat-console').getBoundingClientRect().toJSON(),actions:Array.from(document.querySelectorAll('.combat-action')).map(b=>b.getBoundingClientRect().toJSON())}));assert.ok(result.scrollWidth<=result.width,JSON.stringify(result));assert.ok(result.scene.bottom<=result.console.top+1,JSON.stringify(result));assert.equal(result.actions.length,4);assert.ok(result.actions.every(rect=>rect.width>=44&&rect.height>=44));return result;}
try{
  for(const [width,height] of [[320,640],[390,844],[520,900]]){
    await page.setViewportSize({width,height});await seed(enter(initialState(),'ore',1));
    cases.push({case:'layout',width,height,...await geometry()});
    await page.screenshot({path:output+'/battle-'+width+'.png',fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});await seed(enter(initialState(),'ore',1));
  const start=await saved();await page.getByRole('button',{name:'원정 전리품',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),1);assert.equal((await saved()).expedition.time,start.expedition.time);
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'원정 전리품');
  await page.getByRole('button',{name:'기본 공격',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'기본 공격',exact:true}).isDisabled(),true);
  await turnComplete();let after=await saved();assert.equal(after.expedition.playerTurn,start.expedition.playerTurn+1);assert.ok(after.expedition.monster.currentHp<start.expedition.monster.currentHp);
  const potions=after.expedition.bag.healing_lesser;await page.getByRole('button',{name:'전투 아이템',exact:true}).click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.combat-potion-choice img')).every(img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:output+'/potions-390.png',fullPage:true});
  await page.getByRole('button',{name:/하급 회복 포션/}).click();await turnComplete();
  after=await saved();assert.equal(after.expedition.bag.healing_lesser,potions-1);
  await page.getByRole('button',{name:/^강공,/}).click();await turnComplete();after=await saved();
  assert.ok(after.expedition.cooldowns['turn:heavy']>0);await page.reload();await page.getByRole('button',{name:'기본 공격',exact:true}).waitFor();assert.equal((await saved()).expedition.cooldowns['turn:heavy'],after.expedition.cooldowns['turn:heavy']);
  cases.push({case:'attack-potion-cooldown-reload-and-modal-focus',passed:true});

  for(const [floorText,slot] of Object.entries(IRON_BOSS_SLOTS)){
    const floor=Number(floorText),state=initialState();state.tickets.ore[floor-1]=1;
    const battle=enter(state,'ore',floor);beginEncounter(battle,()=>0,slot.bossId);
    const e=battle.expedition,definition=definitionForRuntime(e.monster,e.monsterRuntime);
    const charge=definition.skills?.find(skill=>skill.kind==='charge');if(charge)e.monsterRuntime.preparedActionId=charge.id;
    const reaction=definition.skills?.find(skill=>skill.kind==='reactive_prepare');if(reaction)prepareReactive(e,'monster',definition.id,reaction);
    if(floor===10){applyEffect(e,'monster','iron_core_shield','monster',e.monsterTurn);applyEffect(e,'player','guard','player',e.playerTurn);applyEffect(e,'player','crushing_pressure','monster',e.playerTurn);}
    await seed(battle);await geometry();assert.equal(await page.getByRole('heading',{name:slot.name,exact:true}).count(),1);
    await page.screenshot({path:output+'/boss-'+floor+'-390.png',fullPage:true});
    if(floor===10){assert.match(await page.locator('.vitals-shield').innerText(),/70/);await page.getByRole('button',{name:/방어 약화|압착 저주/}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');}
    cases.push({case:'boss-art-and-status',floor,passed:true});
  }
  const fleeState=enter(initialState(),'ore',1);fleeState.expedition.loot.silver=100;await seed(fleeState);
  await page.getByRole('button',{name:'도망가기',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tower-record-v1')).expedition===null);
  assert.equal((await saved()).silver,100);assert.equal((await saved()).lastExpedition.outcome,'returned');cases.push({case:'flee-settlement',passed:true});

  const revival=enter(initialState(),'ore',1);revival.expedition.bag.revival=1;revival.expedition.monster.attack=9999;revival.expedition.monster.hp=999;revival.expedition.monster.currentHp=999;
  await seed(revival);await page.getByRole('button',{name:'기본 공격',exact:true}).click();await page.getByRole('button',{name:'회생 포션 사용',exact:true}).waitFor();
  await page.screenshot({path:output+'/revival-390.png',fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);
  await page.getByRole('button',{name:'회생 포션 사용',exact:true}).click();await turnComplete();assert.equal((await saved()).expedition.bag.revival,0);assert.ok((await saved()).expedition.hp>0);cases.push({case:'revival',passed:true});

  assert.deepEqual(errors,[]);fs.writeFileSync(output+'/results.json',JSON.stringify({cases,errors},null,2));console.log(JSON.stringify({passed:cases.length,errors,output}));
}finally{await browser.close();}
