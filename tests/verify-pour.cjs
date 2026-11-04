const assert = require('node:assert/strict');
const fs = require('node:fs');
const { launch, isolateDatabase } = require('./browser-support.cjs');
const origin = 'http://127.0.0.1:4175';
const results = [];
const drinks = ['הפוך הבית', 'אספרסו', 'שקדיאטו', 'אמריקנו', 'פלאט וויט', 'לאטה'];

async function open(browser, viewport, options = {}) {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, ...options });
  const page = await context.newPage();
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/firebase|firestore/.test(request.url()) && !request.url().startsWith(origin)) external.push(request.url());
  });
  await isolateDatabase(page);
  await page.goto(origin);
  await page.waitForSelector('#pourOrder');
  await page.waitForFunction(() => !!window.__testDB && document.querySelector('#connectionStatus').classList.contains('is-open'));
  return { context, page, errors, external };
}

(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  for (const engine of ['chromium', 'webkit']) {
    const browser = await launch(engine);
    try {
      for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1440, height: 900 }, { width: 844, height: 390 }]) {
        const { context, page, errors, external } = await open(browser, viewport);
        try {
          assert.equal(await page.getByRole('radio').count(), 6);
          assert.equal(await page.locator('.drink:visible').count(), 2);
          assert.equal(await page.getByRole('radio', { checked: true }).count(), 1);
          const choices = await page.getByRole('radio').evaluateAll(nodes => nodes.map(node => ({ w: node.getBoundingClientRect().width, h: node.getBoundingClientRect().height })));
          assert(choices.every(box => box.w >= 44 && box.h >= 44));
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

          // Selecting changes the actual SVG vessel and liquid, before any order exists.
          await page.getByRole('radio', { name: 'לאטה', exact: true }).click();
          await page.waitForFunction(() => {
            const cup = document.querySelector('[data-coffee="latte"]');
            return cup?.dataset.vessel === 'tall-glass' && cup.querySelector('[data-k="liq"]').getAttribute('d')?.length > 10;
          });
          assert.equal(await page.evaluate(() => __testDB.calls.length), 0);
          await page.locator('#pourOrder').click();
          assert.equal(await page.locator('#sheetName').textContent(), 'לאטה');
          await page.locator('#customerName').fill('אלון');
          await page.locator('#specialRequest').fill('בלי סוכר');
          await page.locator('#changeDrink').click();
          await page.getByRole('radio', { name: 'אמריקנו', exact: true }).click();
          await page.locator('#pourOrder').click();
          assert.equal(await page.locator('#customerName').inputValue(), 'אלון');
          assert.equal(await page.locator('#specialRequest').inputValue(), 'בלי סוכר');
          await page.locator('#submitBtn').click();
          await page.waitForFunction(() => !document.querySelector('#orderForm').classList.contains('is-up'));
          assert.deepEqual(await page.evaluate(() => __testDB.calls.map(({ productName, customerName, specialRequest }) => ({ productName, customerName, specialRequest }))), [{ productName: 'אמריקנו', customerName: 'אלון', specialRequest: 'בלי סוכר' }]);
          assert.equal(await page.locator('#pourOrder').evaluate(node => node === document.activeElement), true);

          // Keyboard navigation follows RTL and has one tab stop.
          await page.getByRole('radio', { checked: true }).focus();
          await page.keyboard.press('Home');
          await page.keyboard.press('ArrowLeft');
          assert.match(await page.getByRole('radio', { checked: true }).textContent(), /אספרסו/);
          await page.keyboard.press('End');
          await page.keyboard.press('ArrowRight');
          assert.match(await page.getByRole('radio', { checked: true }).textContent(), /פלאט וויט/);
          assert.equal(await page.locator('[role="radio"][tabindex="0"]').count(), 1);

          // Rapid input keeps the latest choice, then classic mode unmounts the loop.
          for (const name of [...drinks, ...drinks]) await page.getByRole('radio', { name, exact: true }).click();
          assert.match(await page.locator('#pourOrder').textContent(), /לאטה/);
          assert(await page.locator('[data-coffee]').count() <= 5);
          await page.getByRole('button', { name: 'התפריט הקלאסי', exact: true }).click();
          assert.equal(await page.locator('.drink:visible').count(), 8);
          assert.equal(await page.locator('.pour-stage').count(), 0);
          await page.locator('[data-kind="espresso"]').click();
          await page.locator('#sheetClose').click();
          assert.equal(await page.locator('[data-kind="espresso"]').evaluate(node => node === document.activeElement), true);
          await page.getByRole('button', { name: 'תפריט במזיגה', exact: true }).click();
          assert.match(await page.locator('#pourOrder').textContent(), /לאטה/);
          await page.locator('[data-kind="other"]').click();
          await page.locator('#customerName').fill('נועה');
          await page.locator('#submitBtn').click();
          assert(await page.locator('#noteError').isVisible());
          await page.keyboard.press('Escape');
          await page.getByRole('radio', { name: 'הפוך הבית', exact: true }).click();
          await page.evaluate(() => scrollTo(0, 0));
          if (viewport.width === 390 || viewport.width === 1440) {
            await page.waitForTimeout(10000);
            await page.screenshot({ path: `artifacts/pour-${engine}-${viewport.width}.png`, fullPage: true });
          }
          assert.deepEqual(errors, []);
          assert.deepEqual(external, []);
          results.push({ engine, ...viewport, status: 'passed', checks: 'selection, rendered liquid, ordering, preserved draft, focus, RTL keys, rapid input, classic mode, other validation, bounds, zero Firebase' });
        } finally { await context.close(); }
      }

      const reduced = await open(browser, { width: 375, height: 667 }, { reducedMotion: 'reduce' });
      try {
        for (const name of drinks) {
          await reduced.page.getByRole('radio', { name, exact: true }).click();
          await reduced.page.waitForTimeout(350);
          assert(await reduced.page.locator('[data-k="liquid"]').last().evaluate(node => Number(node.getAttribute('opacity')) > 0));
          assert(await reduced.page.locator('[data-k="stream0"],[data-k="stream1"]').evaluateAll(nodes => nodes.every(node => !node.getAttribute('d'))));
        }
        assert.deepEqual(reduced.errors, []);
        results.push({ engine, mode: 'reduced-motion', status: 'passed' });
      } finally { await reduced.context.close(); }

      // If JS fails to arrive, the original ordering UI remains available.
      const fallback = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        await isolateDatabase(fallback);
        await fallback.route('**/assets/coffee-pour.js', route => route.abort());
        await fallback.goto(origin);
        assert.equal(await fallback.locator('.drink:visible').count(), 8);
        await fallback.locator('[data-kind="espresso"]').click();
        assert.equal(await fallback.locator('#sheetName').textContent(), 'אספרסו');
        results.push({ engine, mode: 'missing-bundle fallback', status: 'passed' });
      } finally { await fallback.close(); }
    } finally { await browser.close(); }
  }
  fs.writeFileSync('artifacts/pour-results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exit(1); });
