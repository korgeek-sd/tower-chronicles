import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.TOWER_PLAYWRIGHT||'C:/Users/양문지역아동센터2/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url=process.env.TOWER_QA_URL||'http://127.0.0.1:5186/';
const output='qa-v0.1.24/journal-redesign';fs.mkdirSync(output,{recursive:true});
function fixture(){const s=initialState();s.silver=8420;s.materials.ore[0]=27;s.materials.leather[1]=12;s.ownedJobIds=['hunter'];s.skillBooks={execute:2};s.items.push({id:'test-sword',kind:'sword',tier:1,enhancement:0},{id:'test-bow',kind:'bow',tier:3,enhancement:1},{id:'test-armor',kind:'armor',tier:1,enhancement:0},{id:'test-boots',kind:'boots',tier:1,enhancement:0},{id:'test-ring',kind:'vampire',tier:1,enhancement:0});return s;}
const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],cases=[];
page.on('pageerror',e=>errors.push(e.message));
async function saved(){return page.evaluate(()=>JSON.parse(localStorage.getItem('tower-record-v1')));}
async function seed(s=fixture()){await page.goto(url);await page.evaluate(s=>localStorage.setItem('tower-record-v1',JSON.stringify(s)),s);await page.reload();await page.getByRole('button',{name:s.expedition?'전투 메뉴':'탑으로 떠나기',exact:!!s.expedition}).waitFor();}
async function nav(name){await page.locator('nav').getByRole('button',{name,exact:true}).click();}
async function capture(name){await page.waitForFunction(()=>Array.from(document.querySelectorAll('.inventory-icon,.character-paperdoll img,.appearance-hero img')).every(img=>img.complete&&img.naturalWidth>0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/'+name+'.png',fullPage:true});}
try{
 for(const width of [320,390,520]){await page.setViewportSize({width,height:844});await seed();await nav('가방');await capture('inventory-'+width);await nav('캐릭터');await capture('character-'+width);cases.push({case:'responsive',width});}
 await page.setViewportSize({width:390,height:844});await seed();await nav('가방');
 assert.equal(await page.getByRole('button',{name:'스킬북',exact:true}).count(),0);assert.equal((await saved()).skillBooks.execute,2);
 await page.getByRole('button',{name:/^1T 검 \+0/}).click();await page.getByRole('dialog').waitFor();
 assert.match(await page.locator('.equipment-comparison').innerText(),/13.5/);assert.match(await page.locator('.equipment-comparison').innerText(),/18/);
 await capture('comparison-390');await page.getByRole('button',{name:'장비 장착',exact:true}).click();assert.equal((await saved()).equipped.weapon,'test-sword');
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.match(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),/1T 검/);
 await nav('캐릭터');await page.getByRole('button',{name:/^갑옷 선택/}).click();assert.equal(await page.locator('.inventory-slot').count(),1);
 await page.getByRole('button',{name:/^1T 탐험가 갑옷/}).click();await page.getByRole('button',{name:'장비 장착',exact:true}).click();await page.getByRole('button',{name:'캐릭터 보기',exact:false}).click();
 assert.equal((await saved()).equipped.armor,'test-armor');assert.match(await page.locator('.character-stats').innerText(),/235/);cases.push({case:'compare-equip-slot-link-and-focus'});
 await nav('가방');await page.getByRole('button',{name:/^3T 활/}).click();assert.match(await page.getByRole('dialog').innerText(),/숙련/);assert.ok(await page.getByRole('button',{name:'장비 장착',exact:true}).isDisabled());await page.keyboard.press('Escape');
 await page.getByRole('textbox',{name:'아이템 검색'}).fill('없는물건');await page.locator('.inventory-empty').waitFor();await capture('empty-390');await page.getByRole('textbox',{name:'아이템 검색'}).fill('');
 await page.locator('.inventory-tabs').getByRole('button',{name:'포션',exact:true}).click();assert.equal(await page.locator('.inventory-slot').count(),2);cases.push({case:'mastery-lock-search-categories-legacy-preservation'});
 await nav('캐릭터');await page.getByRole('button',{name:'직업 · 스킬',exact:true}).click();await page.getByRole('combobox',{name:'1번 전투 스킬'}).selectOption('');assert.equal((await saved()).skills[0],null);await page.getByRole('combobox',{name:'1번 전투 스킬'}).selectOption('heavy');
 await page.locator('.job-catalog summary').click();await page.locator('.job-catalog-row').filter({hasText:'사냥꾼'}).getByRole('button',{name:'선택',exact:true}).click();assert.equal((await saved()).currentJobId,'hunter');await capture('skills-390');
 await page.reload();await nav('캐릭터');await page.getByRole('button',{name:'직업 · 스킬',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:'1번 전투 스킬'}).inputValue(),'heavy');assert.match(await page.locator('.job-summary').innerText(),/사냥꾼/);cases.push({case:'manual-skills-job-save-reload'});
 await page.getByRole('button',{name:'외형 · 칭호',exact:true}).click();await capture('appearance-390');
 const active=enter(fixture(),'ore',1);await seed(active);await page.getByRole('button',{name:'전투 메뉴',exact:true}).click();await page.getByRole('button',{name:'거점 / 장비 / 스킬 관리',exact:true}).click();await nav('캐릭터');
 await page.getByRole('button',{name:'직업 · 스킬',exact:true}).click();assert.ok(await page.getByRole('combobox',{name:'1번 전투 스킬'}).isDisabled());
 await nav('가방');await page.getByRole('button',{name:/^1T 검 \+0/}).click();assert.ok(await page.getByRole('button',{name:'원정 중 변경 불가',exact:true}).isDisabled());assert.equal((await saved()).equipped.weapon,'starter');cases.push({case:'expedition-locks'});
 assert.deepEqual(errors,[]);fs.writeFileSync(output+'/results.json',JSON.stringify({cases,errors},null,2));console.log(JSON.stringify({passed:cases.length,errors,output}));
}finally{await browser.close();}
