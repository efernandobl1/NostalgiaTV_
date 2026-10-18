const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

// Exercise the production bundle with the exact CSP shipped in nginx.conf.
const root = path.resolve(__dirname, '../dist/WebApp/browser');
const policy = fs.readFileSync(path.resolve(__dirname, '../nginx.conf'), 'utf8')
  .match(/add_header Content-Security-Policy "([^"]+)" always;/)[1];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((request, response) => {
  response.setHeader('Content-Security-Policy', policy.replaceAll('$host', '127.0.0.1'));
  const url = new URL(request.url, 'http://localhost');
  const file = path.resolve(root, '.' + url.pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { response.statusCode = 404; return response.end(); }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  response.setHeader('Content-Type', types[path.extname(target)] ?? 'application/octet-stream');
  fs.createReadStream(target).pipe(response);
});

// Desktop and phone layouts render different markup; check both.
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
const routes = [
  ['/', 'Canales'],
  ['/series/1', 'Dragon Ball Z'],
  ['/login', 'Iniciar sesión'],
  ['/admin', 'Resumen'],
  ['/tv', 'NOSTALGIA TV'],
  ['/unknown-page', 'Esta página salió del aire'],
];

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.policyViolations = [];
        document.addEventListener('securitypolicyviolation', event => window.policyViolations.push(`${event.violatedDirective}: ${event.blockedURI}`));
      });
      for (const [route, text] of routes) {
        await page.goto(base + route);
        await page.locator('app-root').waitFor({ state: 'attached' });
        await page.getByText(text).filter({ visible: true }).first().waitFor({ timeout: 10000 });
        assert.deepEqual(await page.evaluate(() => window.policyViolations), [], `CSP blocked application code at ${route} (${viewport.width}px)`);
        if (route === '/login') assert.ok(await page.locator('input[type=password]:visible').count() >= 1, 'Login has no visible password field');
      }
      assert.deepEqual(errors, [], `Runtime errors at ${viewport.width}px`);
      await page.close();
    }
    console.log('Production browser checks passed: public, login, admin, TV and 404 on desktop and phone under the shipped CSP.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
