import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prerender } from '../scripts/prerender.mjs';
import { dict, setLang, t } from '../public/js/i18n.js?v=__V__';

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), 'utf8');
const html = read('index.html');

test('prerender: tüm çeviri alanları İngilizce dolar', () => {
  setLang('en');
  try {
    const out = prerender(html, t);
    assert.doesNotMatch(out, /data-i18n(?:-html)?="[\w-]+"[^>]*>\s*<\//, 'boş çeviri alanı kalmamalı');
    assert.match(out, /<h1 data-i18n-html="heroTitle">Turn your GIF into a <span class="hl">WhatsApp sticker<\/span><\/h1>/);
    assert.match(out, /placeholder="https:\/\/x\.com\/…\/status\/…  or  https:\/\/giphy\.com\/gifs\/…"/);
    assert.match(out, /id="langToggle"[^>]*>TR<\/button>/);
    for (let n = 1; n <= 6; n++) assert.ok(out.includes(dict.en[`faq${n}q`].replace(/'/g, "'")), `faq${n}`);
    assert.equal(prerender(out, t), out, 'iki kez çalıştırmak bir şey değiştirmemeli');
  } finally {
    setLang('tr');
  }
});

test('temel SEO etiketleri yerinde', () => {
  const base = 'https://nolarth.github.io/sticker-maker/';
  assert.match(html, /<title>Sticker Maker — [^<]{20,60}<\/title>/);
  const desc = html.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.ok(desc.length >= 80 && desc.length <= 170, `açıklama uzunluğu ${desc.length}`);
  assert.ok(html.includes(`<link rel="canonical" href="${base}" />`));
  for (const l of ['en', 'tr']) assert.ok(html.includes(`hreflang="${l}" href="${base}?lang=${l}"`), l);
  assert.ok(html.includes(`hreflang="x-default" href="${base}"`));
  for (const p of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) assert.match(html, new RegExp(`property="${p}" content="[^"]+"`), p);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'WebApplication');
  assert.equal(ld.name, 'Sticker Maker');
  assert.equal(ld.url, base);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, 'tek h1');
});

test('robots, sitemap, manifest ve görseller tutarlı', () => {
  assert.match(read('robots.txt'), /Sitemap: https:\/\/nolarth\.github\.io\/sticker-maker\/sitemap\.xml/);
  const sm = read('sitemap.xml');
  assert.match(sm, /<loc>https:\/\/nolarth\.github\.io\/sticker-maker\/<\/loc>/);
  assert.equal((sm.match(/hreflang="tr"/g) || []).length, 3);
  const mf = JSON.parse(read('manifest.webmanifest'));
  assert.equal(mf.short_name, 'Sticker Maker');
  for (const icon of mf.icons) readFileSync(new URL(`../public/${icon.src}`, import.meta.url));
  for (const f of ['og-image.png', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', '404.html']) readFileSync(new URL(`../public/${f}`, import.meta.url));
  const og = readFileSync(new URL('../public/og-image.png', import.meta.url));
  assert.equal(og.readUInt32BE(16), 1200);
  assert.equal(og.readUInt32BE(20), 630);
});
