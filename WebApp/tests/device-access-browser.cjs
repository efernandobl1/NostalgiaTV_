const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../dist/WebApp/browser');
const captures = path.resolve(__dirname, '../../.impeccable/review');
let approvals = 0;
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    response.setHeader('Content-Type', 'application/json');
    let body = [];
    if (url.pathname.endsWith('/auth/refresh')) {
      if (request.headers['x-visitor'] === 'new') response.statusCode = 401;
      body = {};
    }
    else if (url.pathname.endsWith('/server')) body = { product: 'NostalgiaTV', deviceAuthorizationVersion: 1, registrationEnabled: true, googleEnabled: true };
    else if (url.pathname.endsWith('/auth/register')) { response.statusCode = 201; body = {}; }
    else if (url.pathname.endsWith('/users/me')) body = { id: 1, username: 'Mi perfil', rol: { id: 1, name: 'Admin' } };
    else if (url.pathname.endsWith('/public/settings')) body = { seasonalThemesEnabled: false, seasonalEffectsEnabled: false };
    else if (url.pathname.endsWith('/authorization/inspect')) body = { name: 'Android TV · Xiaomi', expiresAtUtc: new Date(Date.now() + 600000).toISOString() };
    else if (url.pathname.endsWith('/authorization/approve')) { approvals++; response.statusCode = 204; return response.end(); }
    else if (url.pathname.endsWith('/authorization/qr')) body = { deviceCode: 'A'.repeat(64), userCode: 'ABC-DEF-GHJ-KLM', interval: 5, expiresAtUtc: new Date(Date.now() + 120000).toISOString() };
    else if (url.pathname.endsWith('/viewer/session')) body = { profileId: 'test-profile', devices: [], progress: [] };
    return response.end(JSON.stringify(body));
  }
  const file = path.resolve(root, '.' + url.pathname);
  if (!file.startsWith(root + path.sep)) { response.statusCode = 404; return response.end(); }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
  response.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(response);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  fs.mkdirSync(captures, { recursive: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const errors = [];
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: width > 1000 ? 1000 : 844 } });
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { sessionStorage.setItem('sessionActive', 'true'); window.addEventListener('DOMContentLoaded', () => document.body.classList.add('dark-theme')); });
      const previous = approvals;
      await page.goto(base + '/dashboard/devices?code=ABC-DEF-GHJ-KLM');
      await page.getByRole('heading', { name: '¿Es tu pantalla?' }).waitFor();
      assert.equal(approvals, previous);
      await page.getByRole('button', { name: 'Generar QR para mi celular' }).click();
      const qr = page.locator('.device-qr');
      await qr.waitFor();
      assert.ok((await qr.getAttribute('src')).startsWith('data:image/png;base64,'));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(captures, width > 1000 ? 'desktop.png' : 'mobile.png'), fullPage: true });
      await page.getByRole('button', { name: 'Autorizar esta pantalla' }).click();
      await page.getByRole('status').waitFor();
      assert.equal(approvals, previous + 1);
      await page.close();

      const account = await browser.newPage({ viewport: { width, height: width > 1000 ? 1000 : 844 }, extraHTTPHeaders: { 'x-visitor': 'new' } });
      account.on('pageerror', error => errors.push(error.message));
      await account.goto(base + '/login?returnUrl=' + encodeURIComponent('/tv?code=ABC-DEF-GHJ-KLM'));
      await account.getByRole('heading', { name: 'Entrar a mi cuenta' }).waitFor();
      await account.getByRole('link', { name: 'Continuar con Google' }).waitFor();
      await account.getByRole('button', { name: 'Crear una cuenta', exact: true }).click();
      await account.getByLabel('Usuario', { exact: true }).fill('viewer');
      await account.getByLabel('Contraseña', { exact: true }).fill('Private-test-passphrase');
      await account.evaluate(() => document.fonts.ready);
      await account.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await account.screenshot({ path: path.join(captures, width > 1000 ? 'account-desktop.png' : 'account-mobile.png'), fullPage: true });
      assert.ok(await account.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify(await account.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, scrollX, overflow: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right + scrollX > innerWidth + 1).map(element => element.tagName + '.' + element.className).slice(0, 8) }))));
      await account.evaluate(() => document.fonts.ready);
      await account.screenshot({ path: path.join(captures, width > 1000 ? 'account-desktop.png' : 'account-mobile.png'), fullPage: true });
      await account.getByRole('button', { name: 'Crear cuenta y entrar' }).click();
      await account.getByRole('heading', { name: 'Conecta tu TV', exact: true }).waitFor();
      await account.getByRole('heading', { name: '¿Es tu pantalla?' }).waitFor();
      assert.equal(await account.getByRole('button', { name: 'Generar QR para mi celular' }).count(), 0);
      await account.evaluate(() => document.fonts.ready);
      await account.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.ok(await account.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify(await account.evaluate(() => [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).map(element => element.tagName + '.' + element.className).slice(0, 8))));
      await account.evaluate(() => document.fonts.ready);
      await account.screenshot({ path: path.join(captures, width > 1000 ? 'tv-activation-desktop.png' : 'tv-activation-mobile.png'), fullPage: true });
      await account.getByRole('button', { name: 'Autorizar esta pantalla' }).click();
      await account.getByRole('status').waitFor();
      await account.close();
    }
    assert.deepEqual(errors, []);
    console.log('Device confirmation, local QR and responsive layout passed at desktop and mobile sizes.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
