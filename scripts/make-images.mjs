// SEO/paylaşım görsellerini üretir: og-image.png (1200x630) ve uygulama simgeleri.
// Kullanım: node scripts/make-images.mjs   (playwright gerekir)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const pub = fileURLToPath(new URL('../public/', import.meta.url));
const svg = readFileSync(join(pub, 'favicon.svg'), 'utf8');
const svgData = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage();

async function shot(html, w, h, file) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
  </style></head><body>${html}</body></html>`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(pub, file), omitBackground: true });
  console.log('✓', file);
}

// Simgeler
for (const [size, file] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  await shot(`<img src="${svgData}" width="${size}" height="${size}" style="display:block">`, size, size, file);
}
// Maskelenebilir simge: tam dolu zemin, logo güvenli alanda (%60)
await shot(`<div style="width:512px;height:512px;background:#00a884;display:grid;place-items:center">
  <img src="${svgData}" width="320" height="320" style="display:block"></div>`, 512, 512, 'icon-512-maskable.png');

// Paylaşım görseli (Open Graph / Twitter)
await shot(`
<div style="width:1200px;height:630px;background:#f4f1ea;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
  display:flex;align-items:center;gap:64px;padding:0 88px;color:#14201b;position:relative">
  <div style="flex:1">
    <div style="display:flex;align-items:center;gap:16px;font-size:34px;font-weight:600">
      <img src="${svgData}" width="64" height="64"> Sticker <span style="color:#00a884">Maker</span>
    </div>
    <div style="font-size:68px;line-height:1.05;font-weight:800;letter-spacing:-.03em;margin:34px 0 24px">
      Any GIF →<br><span style="color:#00a884">WhatsApp sticker</span>
    </div>
    <div style="font-size:28px;color:#5d6b65;line-height:1.4">X · Giphy · GIF · MP4 &nbsp;—&nbsp; free, no app,<br>runs in your browser</div>
  </div>
  <div style="width:330px;height:420px;background:#efe7dc;border-radius:36px;padding:28px;display:flex;flex-direction:column;
    justify-content:flex-end;align-items:flex-end;gap:14px;box-shadow:0 20px 50px rgba(20,32,27,.12)">
    <div style="background:#d9fdd3;border-radius:16px;padding:10px 16px;font-size:20px;color:#14201b">Create sticker ✓</div>
    <div style="width:200px;height:200px;border-radius:24px;background:conic-gradient(#fff 25%,#e9e5dc 0 50%,#fff 0 75%,#e9e5dc 0) 0 0/24px 24px;
      display:grid;place-items:center;font-size:120px">😹</div>
    <div style="font-size:16px;color:#5d6b65">now ✓✓</div>
  </div>
</div>`, 1200, 630, 'og-image.png');

await browser.close();
