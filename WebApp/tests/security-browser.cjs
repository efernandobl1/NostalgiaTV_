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

// Minimal API v2 stand-in (same origin, like nginx): a guest viewer, one series, no channels.
const viewer = { profileId: '00000000-0000-0000-0000-000000000001', accountLinked: false, username: null, devices: [], progress: [] };
const api = {
  'GET /api/v1/account/me': [401, { title: 'No autenticado.' }],
  'POST /api/v1/auth/refresh': [401, { title: 'No autenticado.' }],
  'GET /api/v1/server': [200, { product: 'NostalgiaTV', apiVersion: 2, deviceAuthorizationVersion: 1, registrationEnabled: true, googleEnabled: false }],
  'GET /api/v1/public/settings': [200, { timeZoneId: 'America/Guatemala', season: 'AllYear', seasonalThemesEnabled: false, seasonalEffectsEnabled: false, registrationEnabled: true }],
  'POST /api/v1/viewer/session': [200, viewer],
  'GET /api/v1/viewer/session': [200, viewer],
  'GET /api/v1/public/channels': [200, []],
  'GET /api/v1/public/categories': [200, []],
  'GET /api/v1/public/series': [200, { items: [], totalCount: 0, page: 1, pageSize: 24 }],
  'GET /api/v1/public/series/1': [200, { id: 1, name: 'Dragon Ball Z', description: null, history: null, logoPath: null, rating: 8.8, startDate: '1989-04-26', endDate: '1996-01-31', categories: ['Anime'], seasons: [1], onAir: [] }],
  'GET /api/v1/public/series/1/episodes': [200, []],
  'GET /api/v1/series/1/comments': [200, { items: [], totalCount: 0, page: 1, pageSize: 25 }],
};

const server = http.createServer((request, response) => {
  response.setHeader('Content-Security-Policy', policy.replaceAll('$host', '127.0.0.1'));
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const [status, body] = api[`${request.method} ${url.pathname}`] ?? [404, { title: 'No encontrado.' }];
    response.writeHead(status, { 'Content-Type': 'application/json' });
    return response.end(JSON.stringify(body));
  }
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
  // Guests are sent to the login page.
  ['/admin', 'Iniciar sesión'],
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
    console.log('Production browser checks passed: public, series, login, admin guard, TV and 404 on desktop and phone under the shipped CSP.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
