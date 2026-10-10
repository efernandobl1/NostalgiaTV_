const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../dist/WebApp/browser');
const screenshots =
  process.env.SCREENSHOT_DIRECTORY || path.join(os.tmpdir(), 'NostalgiaTV-interlude-review');
const types = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
};
const channels = ['Los Simpson TV', 'Jetix', 'Los Expedientes Secretos X'].map((name, index) => ({
  id: index + 1,
  name,
  logoPath: `/fixtures/logo-${index}.svg`,
  startDate: '2004-01-01',
  eras: [{ id: 4 }],
}));
const series = [{ id: 7, name: 'Dexter', seasons: 1, seasonNumbers: [1] }];
const clips = [
  { id: 8, title: 'Ya viene Dexter · City', kind: 0, season: 0, approvedForBroadcast: true },
];
const assignments = [
  { channelEraId: 4, interludeId: 8, role: 3, seriesId: 7, weight: 1, minimumGapSeconds: 0 },
];
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    response.setHeader('Content-Type', 'application/json');
    let body = [];
    if (url.pathname.endsWith('/public/settings'))
      body = { seasonalThemesEnabled: false, seasonalEffectsEnabled: false };
    else if (url.pathname.endsWith('/auth/refresh')) body = {};
    else if (url.pathname.endsWith('/users/me'))
      body = { id: 1, username: 'Admin de prueba', rol: { id: 1, name: 'Admin' } };
    else if (url.pathname.endsWith('/menus'))
      body = ['channels', 'channel-eras'].map((name, index) => ({
        id: index + 1,
        name,
        url: `/dashboard/${name}`,
        children: [],
      }));
    else if (url.pathname.endsWith('/channels')) body = channels;
    else if (url.pathname.endsWith('/series')) body = series;
    else if (url.pathname.endsWith('/channels/2/eras'))
      body = [
        {
          id: 4,
          channelId: 2,
          name: 'City',
          isActive: true,
          startDate: '2004-01-01',
          seriesIds: [7],
          seasonSelections: {},
          bumpers: [],
        },
      ];
    else if (url.pathname.endsWith('/state'))
      body = {
        episodeTitle:
          'Un peligro del espacio · Los extraños padres de Timmy · Un título muy largo que no debe ensanchar la tarjeta',
      };
    else if (url.pathname.endsWith('/retro/interludes')) body = clips;
    else if (url.pathname.endsWith('/eras/4/interludes')) body = assignments;
    else if (url.pathname.endsWith('/break-rules'))
      body = { minimumAds: 1, maximumAds: 3, maximumBreakSeconds: 180 };
    else if (request.method === 'PUT' && url.pathname.endsWith('/8/3')) {
      let data = '';
      request.on('data', (chunk) => (data += chunk));
      request.on('end', () =>
        response.end(JSON.stringify({ ...assignments[0], ...JSON.parse(data) })),
      );
      return;
    }
    return response.end(JSON.stringify(body));
  }
  if (url.pathname.startsWith('/fixtures/')) {
    const index = Number(url.pathname.match(/logo-(\d)/)[1]);
    const dimensions = index === 0 ? [300, 900] : [2400, 700];
    response.setHeader('Content-Type', 'image/svg+xml');
    return response.end(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions[0]}" height="${dimensions[1]}" viewBox="0 0 600 200"><text x="300" y="130" font-size="100" text-anchor="middle" fill="${index === 1 ? '#ff382f' : '#d2e9a1'}">${['TV', 'JETIX', 'X'][index]}</text></svg>`,
    );
  }
  const file = path.resolve(root, '.' + url.pathname);
  if (!file.startsWith(root + path.sep)) {
    response.statusCode = 404;
    return response.end();
  }
  const target =
    fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  response.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(response);
});

(async () => {
  fs.mkdirSync(screenshots, { recursive: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL,
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('rememberMe', 'true'));
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/dashboard/channels');
      await page.locator('.station').nth(2).waitFor();
      await page.locator('.station img').evaluateAll(async (images) => {
        await Promise.all(images.map((image) => image.decode()));
      });
      const overflow = await page.locator('.station').evaluateAll((cards) =>
        cards.flatMap((card) => {
          const bounds = card.getBoundingClientRect();
          return [...card.querySelectorAll('.station-screen, .screen-glass, img, .station-air')]
            .filter((element) => {
              const box = element.getBoundingClientRect();
              return box.left < bounds.left || box.right > bounds.right + 1;
            })
            .map((element) => element.className || element.tagName);
        }),
      );
      assert.deepEqual(overflow, [], `Channel content overflows at ${width}px`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({
        path: path.join(screenshots, `channels-${width}.png`),
        fullPage: true,
      });

      await page.goto(base + '/dashboard/channel-eras?channelId=2&eraId=4&section=advertising');
      await page.getByRole('heading', { name: 'Ya viene · Próximo programa' }).waitFor();
      assert.equal(await page.locator('select').first().inputValue(), '2');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page
        .getByRole('button', { name: 'Editar frecuencia de Ya viene Dexter · City' })
        .click();
      await page
        .locator('select[name=editSeries]')
        .selectOption({ label: 'Genérico del canal · cualquier serie' });
      const update = page.waitForRequest(
        (request) => request.method() === 'PUT' && request.url().endsWith('/8/3'),
      );
      await page.getByRole('button', { name: 'Guardar frecuencia' }).click();
      assert.equal((await update).postDataJSON().seriesId, null);
      await page.locator('.pool-edit').waitFor({ state: 'hidden' });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: path.join(screenshots, `interludes-${width}.png`),
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    console.log(
      `Channel containment and series assignment passed at four widths. Screenshots: ${screenshots}`,
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
