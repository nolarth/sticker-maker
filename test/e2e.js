// Uçtan uca test: siteyi yerelde açar, gerçek dosyaları tarayıcıda (ffmpeg.wasm) dönüştürür.
// CDN ve X istekleri yerel dosyalara yönlendirilir. Gereksinim: playwright + ffmpeg (test dosyaları için).
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const coreDir = new URL('../node_modules/@ffmpeg/core/dist/esm/', import.meta.url).pathname;
const PORT = 8765;
const dir = mkdtempSync(join(tmpdir(), 'e2e-'));
const gen = (name, args) => {
  const out = join(dir, name);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, out]);
  return out;
};
const frames = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0',
  '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]).toString().trim());
const dims = (file) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file]).toString().trim();
const vp8x = (b) => ({ webp: b.subarray(8, 12).toString() === 'WEBP', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), anim: !!(b[20] & 2) });

async function setup(context) {
  await context.route(/cdn\.jsdelivr\.net\/npm\/@ffmpeg\/core@[^/]+\/dist\/esm\//, (route) => {
    const file = route.request().url().split('/').pop();
    route.fulfill({ body: readFileSync(coreDir + file), contentType: file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  const xMp4 = readFileSync(gen('xgif.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=400x300:rate=20:duration=2', '-pix_fmt', 'yuv420p', '-c:v', 'libx264']));
  const cors = { 'Access-Control-Allow-Origin': '*' };
  await context.route('https://api.fxtwitter.com/**', (route) => route.fulfill({
    contentType: 'application/json', headers: cors,
    body: JSON.stringify({ code: 200, tweet: { media: { all: [{ type: 'gif', url: 'https://video.twimg.com/tweet_video/test.mp4' }] } } }),
  }));
  await context.route('https://video.twimg.com/**', (route) => route.fulfill({ body: xMp4, contentType: 'video/mp4', headers: cors }));
}

async function convert(page, input) {
  if (typeof input === 'string') {
    await page.click('#tab-upload');
    await page.setInputFiles('#file', input);
  } else {
    await page.click('#tab-link');
    await page.fill('#url', input.url);
  }
  await page.click('#convertBtn');
  await page.waitForFunction(() => !document.querySelector('#convertBtn').disabled, null, { timeout: 180_000 });
  const err = await page.$eval('#error', (e) => (e.hidden ? '' : e.textContent));
  assert.equal(err, '', err);
}

const server = spawn(process.execPath, ['scripts/serve.mjs', String(PORT)], { stdio: 'ignore' });
const browser = await chromium.launch();
try {
  await new Promise((r) => setTimeout(r, 500));

  // ---- Masaüstü: GIF indir + WebP ----
  const desk = await browser.newContext({ acceptDownloads: true });
  await setup(desk);
  const page = await desk.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/`);

  const cases = [
    ['animasyonlu GIF', gen('a.gif', ['-f', 'lavfi', '-i', 'testsrc2=size=480x270:rate=20:duration=3']), { anim: true, dims: '480x270' }],
    ['14 sn GIF (10 sn kırpma)', gen('long.gif', ['-f', 'lavfi', '-i', 'testsrc=size=200x150:rate=10:duration=14']), { anim: true, maxDur: 10 }],
    ['X linki (paylaşım metni içinde)', { url: 'Şuna bak https://x.com/poorpela/status/2124676619461931160/photo/1' }, { anim: true, name: 'x_2124676619461931160.gif' }],
  ];
  for (const [label, input, exp] of cases) {
    const t0 = Date.now();
    await convert(page, input);
    assert.ok(await page.isVisible('#gifDownloadBtn'), `${label}: masaüstünde GIF indir butonu görünmeli`);
    assert.ok(!(await page.isVisible('#sendBtn')), `${label}: masaüstünde gönder butonu gizli olmalı`);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#gifDownloadBtn')]);
    const out = join(dir, 'out.gif');
    await dl.saveAs(out);
    const buf = readFileSync(out);
    assert.equal(buf.subarray(0, 4).toString(), 'GIF8', `${label}: GIF değil`);
    if (exp.name) assert.equal(dl.suggestedFilename(), exp.name);
    if (exp.dims) assert.equal(dims(out), exp.dims);
    const n = frames(out);
    assert.ok(exp.anim ? n > 1 : n === 1, `${label}: kare sayısı ${n}`);
    const stats = await page.$eval('#stats', (e) => e.textContent);
    if (exp.maxDur) assert.ok(parseFloat(stats.match(/([\d.]+) sn/)[1]) <= exp.maxDur, stats);
    console.log(`✓ ${label}: GIF ${Math.round(buf.length / 1024)} KB, ${n} kare, ${dims(out)}, ${((Date.now() - t0) / 1000).toFixed(1)} sn`);
  }

  // WebP çıkartma dosyası (Diğer seçenekler)
  await page.click('.more summary');
  const [wdl] = await Promise.all([page.waitForEvent('download', { timeout: 180_000 }), page.click('#webpBtn')]);
  const wbuf = readFileSync(await wdl.path());
  const h = vp8x(wbuf);
  assert.ok(h.webp && h.w === 512 && h.h === 512 && h.anim && wbuf.length <= 500 * 1024, JSON.stringify(h));
  console.log(`✓ WebP çıkartma dosyası: ${Math.round(wbuf.length / 1024)} KB, 512×512, animasyonlu`);
  assert.deepEqual(errors, []);

  // ---- Android telefon: "WhatsApp'a gönder" paylaşım ekranına GIF dosyası verir ----
  const phone = await browser.newContext({ ...devices['Pixel 7'] });
  await setup(phone);
  await phone.addInitScript(() => {
    window.__shared = null;
    navigator.canShare = (d) => !!(d && d.files && d.files.length);
    navigator.share = async (d) => { window.__shared = d.files.map((f) => ({ name: f.name, type: f.type, size: f.size })); };
  });
  const mp = await phone.newPage();
  await mp.goto(`http://localhost:${PORT}/`);
  await convert(mp, cases[0][1]);
  assert.ok(await mp.isVisible('#sendBtn'), 'telefonda gönder butonu görünmeli');
  await mp.click('#sendBtn');
  const shared = await mp.evaluate(() => window.__shared);
  assert.equal(shared.length, 1);
  assert.equal(shared[0].type, 'image/gif');
  assert.match(shared[0].name, /\.gif$/);
  const steps = await mp.$eval('#steps', (e) => e.textContent);
  assert.match(steps, /Çıkartma oluştur/);
  console.log(`✓ Android: paylaşım ekranına ${shared[0].name} (${shared[0].type}) verildi; adımlar: "${steps.slice(0, 60)}…"`);

  console.log('Tüm uçtan uca testler geçti.');
} finally {
  await browser.close();
  server.kill();
  rmSync(dir, { recursive: true, force: true });
}
