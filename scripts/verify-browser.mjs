import assert from 'node:assert/strict';
import { createServer, preview } from 'vite';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || 'C:/Users/mihir/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
const errors = [];
try {
  for (const production of [false, true]) {
    const port = production ? 4188 : 3018;
    const server = production
      ? await preview({ preview: { host: '127.0.0.1', port, strictPort: true } })
      : await createServer({ server: { host: '127.0.0.1', port, strictPort: true } });
    if (!production) await server.listen();
    const context = await browser.newContext();
    const page = await context.newPage();
    const origin = `http://127.0.0.1:${port}`;
    // Verification uses isolated local storage and never contacts the Google app.
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    page.on('pageerror', error => errors.push(error.message));
    const badScripts = [];
    page.on('response', response => {
      if (response.request().resourceType() === 'script' && (response.status() !== 200 || /text\/html/.test(response.headers()['content-type'] || ''))) badScripts.push(response.url());
    });
    try {
      await page.goto(origin);
      await page.getByRole('button', { name: 'YES', exact: true }).first().waitFor();
      assert.equal(await page.locator('#check-premarket').isDisabled(), true);
      for (const button of await page.getByRole('button', { name: 'YES', exact: true }).all()) await button.click();
      await page.waitForFunction(() => !document.querySelector('#check-premarket').matches(':disabled'));
      assert.equal(await page.locator('#check-m5m15-gap').isDisabled(), true);
      for (const id of ['gate-check-session', 'check-premarket', 'check-htf-fvg', 'check-m5m15-gap', 'check-manipulation', 'check-inversion-found', 'check-highest-gap', 'gate-check-planned', 'check-rr-ratio', 'check-clear-liquidity', 'check-inversion-speed']) await page.locator(`#${id}`).check();
      await page.locator('#bottom-flow').waitFor();
      assert.equal(await page.locator('#gate-panel').count(), 0);
      await page.locator('#check-htf-fvg').uncheck();
      assert.equal(await page.locator('#bottom-flow').count(), 0);
      assert.equal(await page.locator('#check-inversion-found').isDisabled(), true);
      await page.locator('#check-htf-fvg').check();
      await page.locator('#bottom-flow').waitFor();
      await page.locator('#btn-commit').click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('fexec_trades_v2') || '[]').some(t => t.checklistSummary?.gatePassed), { timeout: 30000 });
      const record = await page.evaluate(() => JSON.parse(localStorage.getItem('fexec_trades_v2')).find(t => t.checklistSummary.gatePassed));
      assert.deepEqual(record.checklistSummary, { s1Done: true, s2Done: true, s3Done: true, s4Done: true, gatePassed: true });
      assert.ok(record.accountId);
      await page.getByRole('button', { name: 'NO', exact: true }).first().click();
      await page.waitForFunction(() => document.querySelector('#check-premarket').matches(':disabled'));
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('fexec_operator_clearance_v1') || '{}').reason);
      await page.reload();
      await page.locator('#check-premarket').waitFor();
      assert.equal(await page.locator('#check-premarket').isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: /RESTART TODAY/ }).count(), 0);
      const missing = await context.request.get(`${origin}/assets/missing-build.js`);
      assert.equal(missing.status(), 404);
      assert.doesNotMatch(missing.headers()['content-type'], /html/);
      if (production) {
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.reload();
        await context.setOffline(true);
        await page.reload();
        await page.locator('#check-premarket').waitFor();
        assert.equal(await page.locator('#check-premarket').isDisabled(), true);
        await context.setOffline(false);
      } else {
        assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
      }
      assert.deepEqual(badScripts, []);
      console.log(`PASS ${production ? 'production + offline PWA' : 'development without PWA'}: ordered checks, automatic execution, upstream revocation, journal schema, persistent operator lock, JS content types, missing-asset 404.`);
    } finally {
      await context.close();
      if (production) await new Promise(resolve => server.httpServer.close(resolve));
      else await server.close();
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
