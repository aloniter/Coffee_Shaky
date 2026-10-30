const assert=require('node:assert/strict');
const fs=require('node:fs');
const {launch,isolateDatabase}=require('./browser-support.cjs');
const base='http://127.0.0.1:4174';
const report={date:'2026-10-28',environment:'Local only; Firebase files intercepted; external app traffic blocked',checks:[],screenshots:[]};
const check=(name,value=true)=>{assert.ok(value,name);report.checks.push(name);console.log('PASS',name);};
async function home(browser,width,height=844,options={}){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:2,isMobile:width<700,hasTouch:width<700,...options});
 await isolateDatabase(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.__errors=errors;
 await page.goto(base);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>window.CoffeeDB&&document.getElementById('connectionStatus').classList.contains('is-open'));
 return page;
}
async function screenshot(page,name,fullPage=false){await page.screenshot({path:`artifacts/${name}.png`,fullPage});report.screenshots.push(name);}
(async()=>{
 for(const engine of ['chromium','webkit']){
  const browser=await launch(engine);
  for(const width of [390,430]){
   const page=await home(browser,width,width===390?844:932);
   check(`${engine} ${width}: sheet initially closed and inert`,await page.locator('#orderForm').evaluate(el=>el.inert&&!el.classList.contains('is-up')));
   check(`${engine} ${width}: no canvas or 3D scripts`,await page.evaluate(()=>!document.querySelector('canvas')&&!performance.getEntriesByType('resource').some(e=>/three|coffee-scene/.test(e.name))));
   check(`${engine} ${width}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   check(`${engine} ${width}: four products fully visible above dock`,await page.evaluate(()=>[...document.querySelectorAll('.drink')].slice(0,4).every(el=>el.getBoundingClientRect().bottom<=document.querySelector('.app-dock').getBoundingClientRect().top)));
   await screenshot(page,`final-${engine}-home-${width}`);
   await page.locator('[data-kind="house"]').click();await page.waitForTimeout(400);
   check(`${engine} ${width}: selected drink in sheet`,await page.locator('#sheetName').textContent()==='הפוך הבית');
   check(`${engine} ${width}: no blank selected icon`,await page.locator('#sheetIcon').evaluate(el=>el.complete&&el.naturalWidth>0));
   await screenshot(page,`final-${engine}-sheet-${width}`);
   await page.locator('#submitBtn').click();check(`${engine} ${width}: name required`,await page.locator('#nameError').isVisible());
   await page.locator('#customerName').fill('בדיקה מקומית');await page.locator('#specialRequest').fill('חלב שיבולת שועל');
   // Simulate visualViewport shrink independently from layout viewport, as iOS's keyboard does.
   await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{value:500,configurable:true});visualViewport.dispatchEvent(new Event('resize'));});
   await page.waitForTimeout(400);
   check(`${engine} ${width}: keyboard action stays visible`,await page.locator('#submitBtn').evaluate(el=>{const b=el.getBoundingClientRect();return b.top>=0&&b.bottom<=500;}));
   await screenshot(page,`final-${engine}-keyboard-${width}`);
   await page.locator('#submitBtn').click();await page.waitForFunction(()=>!document.querySelector('#orderForm').classList.contains('is-up'));
   check(`${engine} ${width}: correct order payload`,await page.evaluate(()=>{const d=__testDB.calls.at(-1);return d.productName==='הפוך הבית'&&d.customerName==='בדיקה מקומית'&&d.specialRequest==='חלב שיבולת שועל';}));
   await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});
   check(`${engine} ${width}: background restored after submit`,await page.locator('.shell').evaluate(el=>!el.inert));
   await page.locator('.act--go').click();check(`${engine} ${width}: ready status`,await page.locator('.ticket--ready').count()===1);
   await page.locator('.ticket--ready .act').first().click();check(`${engine} ${width}: collection removes ticket`,await page.locator('.ticket').count()===0);
   await page.locator('[data-kind="other"]').click();await page.locator('#customerName').fill('שם');await page.locator('#submitBtn').click();check(`${engine} ${width}: Other requires details`,await page.locator('#noteError').isVisible());
   await page.keyboard.press('Escape');check(`${engine} ${width}: Escape closes form`,await page.locator('#orderForm').evaluate(el=>el.inert));
   for(const kind of ['espresso','americano','flatwhite','latte','macchiato','tea']){
    await page.locator(`[data-kind="${kind}"]`).click();await page.locator('#customerName').fill('בדיקה '+kind);await page.locator('#submitBtn').click();await page.waitForFunction(()=>!document.querySelector('#orderForm').classList.contains('is-up'));
   }
   check(`${engine} ${width}: all coffee and tea orders preserved`,await page.locator('.ticket').count()===6);
   await page.locator('.act--kill').first().click();await page.locator('#confirmNo').click();check(`${engine} ${width}: cancel confirmation keeps ticket`,await page.locator('.ticket').count()===6);
   await page.locator('.act--kill').first().click();await page.locator('#confirmYes').click();check(`${engine} ${width}: confirmed cancellation removes ticket`,await page.locator('.ticket').count()===5);
   await page.locator('.wipe').click();await page.locator('#confirmNo').click();check(`${engine} ${width}: clear confirmation preserves queue`,await page.locator('.ticket').count()===5);
   await page.locator('.wipe').click();await page.locator('#confirmYes').click();check(`${engine} ${width}: confirmed clear removes queue`,await page.locator('.ticket').count()===0);
   await page.locator('[data-kind="espresso"]').click();await page.locator('#customerName').fill('שגיאה');await page.evaluate(()=>__testDB.fail=true);await page.locator('#submitBtn').click();
   check(`${engine} ${width}: failure retains input and enables retry`,await page.locator('#customerName').inputValue()==='שגיאה'&&await page.locator('#submitBtn').isEnabled());
   await page.evaluate(()=>__testDB.fail=false);await page.locator('#sheetClose').click();
   await page.evaluate(()=>window.scrollTo(0,0));await page.locator('#employeeBanner').click();await page.waitForFunction(()=>!document.querySelector('#catVisit').hidden);await page.waitForTimeout(1050);
   if(width===390)await screenshot(page,`final-${engine}-cat`);
   check(`${engine} ${width}: cat visit shown`,await page.locator('#catVisit').isVisible());
   await page.keyboard.press('Escape');check(`${engine} ${width}: cat dismisses`,await page.locator('#catVisit').isHidden());
   await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#employeeBanner').click();await page.waitForFunction(()=>!document.querySelector('#catVisit').hidden);
   check(`${engine} ${width}: gentle cat for reduced motion`,await page.locator('#catVisit').evaluate(el=>el.classList.contains('is-gentle')));
   await page.waitForTimeout(1900);check(`${engine} ${width}: reduced motion effect cleans up`,await page.locator('#catVisit').isHidden());
   await page.evaluate(()=>{document.querySelectorAll('img[loading="lazy"]').forEach(el=>el.loading='eager');});await page.waitForTimeout(300);
   check(`${engine} ${width}: all product images load`,await page.evaluate(()=>[...document.querySelectorAll('.drink img')].every(i=>i.complete&&i.naturalWidth>0)));
   check(`${engine} ${width}: no JS errors`,page.__errors.length===0);
   await page.close();
  }
  for(const [width,height] of [[375,667],[844,390]]){
   const page=await home(browser,width,height);
   check(`${engine} ${width}x${height}: responsive bounds`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await screenshot(page,`final-${engine}-${width}x${height}`);
   if(width===1440)await screenshot(page,`final-${engine}-desktop-full`,true);
   await page.close();
  }
  await browser.close();
 }
 fs.writeFileSync('artifacts/verification.json',JSON.stringify(report,null,2));
 console.log(`Completed ${report.checks.length} checks.`);
})().catch(error=>{fs.writeFileSync('artifacts/verification.json',JSON.stringify({...report,error:error.stack},null,2));console.error(error);process.exit(1);});
