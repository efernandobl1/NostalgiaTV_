const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

// Exercise the production bundle with the exact CSP shipped in nginx.conf.
const root = path.resolve(__dirname, '../dist/WebApp/browser');
const policy = fs.readFileSync(path.resolve(__dirname, '../nginx.conf'), 'utf8')
  .match(/add_header Content-Security-Policy "([^"]+)" always;/)[1];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  response.setHeader('Content-Security-Policy', policy.replaceAll('$host', '127.0.0.1'));
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    response.setHeader('Content-Type', 'application/json');
    if (url.pathname.endsWith('/public/settings')) return response.end(JSON.stringify({ seasonalThemesEnabled: true, seasonalEffectsEnabled: true, timeZoneId: 'America/Guatemala' }));
    if (url.pathname.includes('/auth/') || url.pathname.includes('/viewer/')) response.statusCode = 401;
    return response.end('[]');
  }
  const file = path.resolve(root, '.' + url.pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { response.statusCode = 404; return response.end(); }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  response.setHeader('Content-Type', types[path.extname(target)] ?? 'application/octet-stream');
  fs.createReadStream(target).pipe(response);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.policyViolations = [];
      document.addEventListener('securitypolicyviolation', event => window.policyViolations.push(`${event.violatedDirective}: ${event.blockedURI}`));
    });
    for (const route of ['/', '/dashboard/login', '/unknown-page']) {
      await page.goto(base + route);
      await page.locator('app-root').waitFor();
      await page.waitForTimeout(1000);
      assert.ok((await page.locator('app-root').innerText()).length > 20, `Empty application at ${route}`);
      assert.deepEqual(await page.evaluate(() => window.policyViolations), [], `CSP blocked application code at ${route}`);
      if (route === '/dashboard/login') assert.equal(await page.locator('input[type=password]').count(), 1);
    }
    assert.deepEqual(errors, []);
    console.log('Production browser checks passed: public page, login, 404 and CSP.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
