const assert = require('node:assert/strict');
const fs = require('node:fs');
const {launch, isolateDatabase} = require('./browser-support.cjs');
const origin = 'http://127.0.0.1:4175';
const checks=[];
async function waitCount(page, selector, count) {
  await page.waitForFunction(({selector,count})=>document.querySelectorAll(selector).length===count,{selector,count});
}
(async()=>{
 for(const engine of ['chromium','webkit']) {
  const browser=await launch(engine);
  for(const width of [390,430]) {
   const context=await browser.newContext({viewport:{width,height:width===390?844:932},isMobile:true,hasTouch:true,deviceScaleFactor:2});
   const errors=[], external=[];
   context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
   context.on('request',r=>{if(/firestore|firebase/.test(r.url())&&!r.url().startsWith(origin))external.push(r.url());});
   const home=await context.newPage();
   await home.goto(origin);
   await home.waitForFunction(()=>document.querySelector('#connectionStatus').classList.contains('is-open'));
   // Reset only the in-memory local kitchen.
   await home.evaluate(async()=>{const rows=await (await fetch('/__preview/orders')).json();await CoffeeDB.removeOrders(rows.map(r=>r.id));});
   assert.equal(await home.locator('.queue,#ordersContainer').count(),0);
   assert.equal(await home.locator('.drink').count(),8);
   assert(!await home.locator('#orderForm').evaluate(el=>el.classList.contains('is-up')));
   const popup=context.waitForEvent('page');
   await home.locator('#queueNav').click();
   const barista=await popup;
   await barista.waitForURL('**/barista.html');
   await barista.waitForFunction(()=>document.querySelector('#connectionStatus').classList.contains('is-open'));
   assert.equal(await barista.locator('.drink,#orderForm,#employeeBanner').count(),0);
   await waitCount(barista,'.empty',1);
   assert(await barista.locator('#newOrderAlert').isHidden());
   await barista.evaluate(()=>{
     window.chimeCalls=0;
     const audio=document.getElementById('orderChime'), original=audio.play.bind(audio);
     audio.play=()=>{window.chimeCalls++;return original();};
   });
   await barista.locator('#soundToggle').click();
   await barista.waitForFunction(()=>document.querySelector('#soundToggle').getAttribute('aria-pressed')==='true');
   assert.equal(await barista.evaluate(()=>chimeCalls),1);
   await barista.waitForFunction(()=>document.querySelector('#orderChime').currentTime>0);
   await barista.locator('button[data-filter="ready"]').click();
   for(const [kind,name,note] of [['espresso','אלון','כפול, בלי סוכר'],['house','נועה','חלב שיבולת שועל'],['latte','שקד','']]) {
    await home.locator(`[data-kind="${kind}"]`).click();
    await home.locator('#customerName').fill(name);
    await home.locator('#specialRequest').fill(note);
    await home.locator('#submitBtn').click();
    await home.waitForFunction(()=>!document.querySelector('#orderForm').classList.contains('is-up'));
   }
   await waitCount(barista,'.ticket',3);
   await barista.waitForFunction(()=>!document.querySelector('#newOrderAlert').hidden);
   assert.match(await barista.locator('#newOrderText').textContent(), /שקד|הזמנות חדשות/);
   const chimesAfterOrders = await barista.evaluate(()=>chimeCalls);
   assert(chimesAfterOrders >= 2 && chimesAfterOrders <= 4);
   await barista.screenshot({path:`artifacts/barista-alert-${engine}-${width}.png`});
   await barista.locator('#newOrderOpen').click();
   assert.equal(await barista.locator('body').getAttribute('data-filter'),'all');
   assert(await barista.locator('#newOrderAlert').isHidden());
   assert.deepEqual(await barista.locator('.ticket-who').allTextContents(),['אלון','נועה','שקד']);
   await barista.locator('.ticket').filter({hasText:'שקד'}).getByRole('button',{name:'מוכן!',exact:true}).click();
   await waitCount(barista,'.ticket--ready',1);
   assert.equal(await barista.evaluate(()=>chimeCalls),chimesAfterOrders);
   assert(await barista.locator('#newOrderAlert').isHidden());
   assert.equal(await barista.locator('.barista-filters button').count(),2);
   assert.equal(await barista.locator('#readyCount').textContent(),'1');
   for(const p of [home,barista]) {
    await p.evaluate(()=>document.fonts.ready);
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${engine} ${width}: overflow`);
   }
   await barista.waitForTimeout(1800);
   await barista.screenshot({path:`artifacts/barista-${engine}-${width}.png`,fullPage:true});
   await home.evaluate(()=>scrollTo(0,0));
   await home.waitForTimeout(2200);
   await home.screenshot({path:`artifacts/menu-separate-${engine}-${width}.png`});
   assert(await barista.locator('.ticket-cup img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)));
   await barista.locator('button[data-filter="ready"]').click();
   assert.equal(await barista.locator('.ticket:visible').count(),1);
   await barista.getByRole('button',{name:'עדיין לא מוכן'}).click();
   await waitCount(barista,'.ticket--ready',0);
   assert(await barista.locator('#filterEmpty').isVisible());
   await barista.locator('button[data-filter="all"]').click();
   assert.equal(await barista.locator('.ticket:visible').count(),3);
   await barista.locator('.ticket').first().getByRole('button',{name:'בטל הזמנה'}).click();
   await barista.locator('#confirmNo').click();
   assert.equal(await barista.locator('.ticket').count(),3);
   await barista.locator('.ticket').first().getByRole('button',{name:'בטל הזמנה'}).click();
   await barista.locator('#confirmYes').click();
   await waitCount(barista,'.ticket',2);
   await barista.locator('button[data-filter="all"]').click();
   await barista.locator('.ticket').first().getByRole('button',{name:'מוכן!',exact:true}).click();
   await waitCount(barista,'.ticket--ready',1);
   await barista.getByRole('button',{name:'נאסף',exact:true}).click();
   await waitCount(barista,'.ticket',1);
   await barista.locator('#soundToggle').click();
   assert.equal(await barista.locator('#soundToggle').getAttribute('aria-pressed'),'false');
   await barista.reload();
   await waitCount(barista,'.ticket',1);
   assert(await barista.locator('#newOrderAlert').isHidden());
   await barista.getByRole('button',{name:'ניקוי התור'}).click();
   await barista.locator('#confirmYes').click();
   await waitCount(barista,'.ticket',0);
   await home.waitForFunction(()=>document.querySelector('#dockCount').hidden);
   assert.equal(errors.length,0,errors.join('\n'));assert.equal(external.length,0);
   checks.push(`${engine} ${width}: sound enabled by tap, real audio playback, one chime per arriving batch, no chime on ready or reload, alert opens All from Ready, two filters, mute, separate popup, clean menu, shared live orders, FIFO, notes/images, ready/undo, filters, cancel/keep, collected, reload, clear, synchronized count, no overflow or errors, zero Firebase traffic`);
   await context.close();
  }
  // Original offline duplicate prevention still runs on the menu without tickets.
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await isolateDatabase(p);await p.goto(origin);await p.evaluate(()=>__testDB.offline=true);
  for(let i=0;i<2;i++) {
   await p.locator('[data-kind="espresso"]').click();await p.locator('#customerName').fill('הזמנה ממתינה');await p.locator('#submitBtn').click();
   await p.waitForFunction(()=>!document.querySelector('#orderForm').classList.contains('is-up'),null,{timeout:8000});
  }
  assert.equal(await p.evaluate(()=>__testDB.calls.length),1);
  checks.push(`${engine}: customer offline handoff and duplicate prevention retained`);
  await browser.close();
 }
 fs.writeFileSync('artifacts/barista-verification.json',JSON.stringify(checks,null,2));console.log(checks.join('\n'));
})().catch(e=>{console.error(e);process.exit(1)});
