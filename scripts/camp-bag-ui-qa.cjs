const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const {mkdirSync}=require('node:fs');
(async()=>{
 const output=process.env.QA_OUTPUT||'qa-output';mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[320,640],[360,740],[390,844],[430,932]]){
  await page.setViewportSize({width,height});await page.goto(process.env.QA_URL||'http://127.0.0.1:5173/');await page.locator('.camp-primary').waitFor();
  for(const mode of ['home','inventory']){
   if(mode==='inventory'){await page.getByRole('navigation').getByRole('button',{name:'가방',exact:true}).click();await page.locator('.inventory-screen').waitFor();}
   await page.screenshot({path:`${output}/${mode}-${width}.png`});
   const metrics=await page.evaluate(()=>({viewport:innerHeight,height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll('.camp-bag-mode button')].filter(e=>{const r=e.getBoundingClientRect();return r.height&& (r.bottom>innerHeight+1||r.right>innerWidth+1||r.top<0)}).map(e=>e.textContent)}));
   console.log(width,height,mode,metrics);assert.ok(metrics.height<=height+1);assert.ok(metrics.width<=width+1);assert.deepEqual(metrics.clipped,[]);
  }
  await page.locator('.inventory-slot').first().click();await page.locator('dialog[open]').waitFor();
  const detail=await page.locator('.camp-dialog-panel').boundingBox();assert.ok(detail.y>=0&&detail.y+detail.height<=height+1);
  await page.screenshot({path:`${output}/detail-${width}.png`});await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});
  await page.getByRole('button',{name:/더보기/}).click();await page.getByRole('dialog').getByRole('button',{name:'포션',exact:true}).click();
  await page.getByRole('button',{name:/검색/}).click();await page.getByRole('textbox').fill('존재하지않는아이템');await page.getByRole('dialog').getByRole('button',{name:'적용',exact:true}).click();await page.getByText('조건에 맞는 아이템이 없습니다.').waitFor();
 }
 await page.getByRole('navigation').getByRole('button',{name:'거점',exact:true}).click();await page.getByRole('button',{name:'탐사 준비'}).click();await page.getByRole('heading',{name:'어떤 탑에 도전할까요?'}).waitFor();await page.getByRole('button',{name:'다음 →',exact:true}).click();await page.locator('.tower-card').first().waitFor();
 console.log('errors',errors);assert.deepEqual(errors,[]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
