// Uçtan uca test: siteyi yerelde açar, gerçek GIF'leri tarayıcıda (ffmpeg.wasm) dönüştürür.
// CDN istekleri node_modules/@ffmpeg/core'a yönlendirilir. Gereksinim: playwright + ffmpeg (test GIF'leri için).
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const coreDir = new URL('../node_modules/@ffmpeg/core/dist/esm/', import.meta.url).pathname;
const PORT = 8765;
const dir = mkdtempSync(join(tmpdir(), 'e2e-'));
const gen = (name, args) => {
  const out = join(dir, name);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, out]);
  return out;
};
const vp8x = (b) => ({ webp: b.subarray(8, 12).toString() === 'WEBP', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), anim: !!(b[20] & 2) });

const server = spawn(process.execPath, ['scripts/serve.mjs', String(PORT)], { stdio: 'ignore' });
const browser = await chromium.launch();
try {
  await new Promise((r) => setTimeout(r, 500));
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.context().route(/cdn\.jsdelivr\.net\/npm\/@ffmpeg\/core@[^/]+\/dist\/esm\//, (route) => {
    const file = route.request().url().split('/').pop();
    route.fulfill({
      body: readFileSync(coreDir + file),
      contentType: file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  await page.goto(`http://localhost:${PORT}/`);

  const cases = [
    ['animasyonlu GIF', gen('a.gif', ['-f', 'lavfi', '-i', 'testsrc2=size=480x270:rate=20:duration=3']), { anim: true, max: 500 }],
    ['14 sn GIF (10 sn kırpma)', gen('long.gif', ['-f', 'lavfi', '-i', 'testsrc=size=200x150:rate=10:duration=14']), { anim: true, max: 500, maxDur: 10 }],
    ['PNG (sabit)', gen('s.png', ['-f', 'lavfi', '-i', 'color=blue:size=200x300', '-frames:v', '1']), { anim: false, max: 100 }],
  ];
  for (const [label, file, exp] of cases) {
    const t0 = Date.now();
    await page.setInputFiles('#file', file);
    await page.click('#convertBtn');
    await page.waitForFunction(() => !document.querySelector('#convertBtn').disabled, null, { timeout: 180_000 });
    const err = await page.$eval('#error', (e) => (e.hidden ? '' : e.textContent));
    assert.equal(err, '', `${label}: ${err}`);
    const b64 = await page.$eval('#downloadBtn', async (a) => {
      const buf = new Uint8Array(await (await fetch(a.href)).arrayBuffer());
      let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s);
    });
    const buf = Buffer.from(b64, 'base64');
    const h = vp8x(buf);
    assert.ok(h.webp && h.w === 512 && h.h === 512, `${label}: boyut ${h.w}x${h.h}`);
    assert.equal(h.anim, exp.anim, `${label}: animasyon`);
    assert.ok(buf.length <= exp.max * 1024, `${label}: ${buf.length} bayt`);
    const stats = await page.$eval('#stats', (e) => e.textContent);
    if (exp.maxDur) {
      const d = parseFloat(stats.match(/([\d.]+) sn/)[1]);
      assert.ok(d <= exp.maxDur, `${label}: süre ${d}`);
    }
    console.log(`✓ ${label}: ${Math.round(buf.length / 1024)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} sn — ${stats}`);
  }
  assert.deepEqual(errors, []);
  console.log('Tüm uçtan uca testler geçti.');
} finally {
  await browser.close();
  server.kill();
  rmSync(dir, { recursive: true, force: true });
}
