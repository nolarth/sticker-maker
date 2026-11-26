// Yayın öncesi: index.html içindeki data-i18n alanlarını İngilizce metinle doldurur (arama motorları ve
// JavaScript çalıştırmayan botlar boş sayfa görmesin) ve sitemap.xml'e tarih yazar.
// Kullanım: node scripts/prerender.mjs [klasör]   (varsayılan: public)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

/** @param {string} html @param {(key: string) => any} t */
export function prerender(html, t) {
  // <tag data-i18n="key"></tag>  → düz metin
  html = html.replace(/(<([a-z0-9]+)\b[^>]*\sdata-i18n="([\w-]+)"[^>]*>)\s*(<\/\2>)/gi, (_, open, _tag, key, close) => `${open}${esc(t(key))}${close}`);
  // <tag data-i18n-html="key"></tag>  → HTML
  html = html.replace(/(<([a-z0-9]+)\b[^>]*\sdata-i18n-html="([\w-]+)"[^>]*>)\s*(<\/\2>)/gi, (_, open, _tag, key, close) => `${open}${t(key)}${close}`);
  // data-i18n-attr="aria-label:key;placeholder:key2"  → özellikleri ekle
  html = html.replace(/<[a-z0-9]+\b[^>]*\sdata-i18n-attr="([^"]+)"[^>]*>/gi, (tag, spec) => {
    let out = tag;
    for (const pair of spec.split(';')) {
      const [attr, key] = pair.split(':').map((x) => x.trim());
      const re = new RegExp(`\\s${attr}="[^"]*"`);
      const value = `${attr}="${escAttr(t(key))}"`;
      out = re.test(out) ? out.replace(re, ` ${value}`) : out.replace(/\s*\/?>$/, (end) => ` ${value}${end}`);
    }
    return out;
  });
  // Dil butonu: İngilizce sayfada "TR"
  html = html.replace(/(<button[^>]*id="langToggle"[^>]*>)\s*(<\/button>)/, (_, o, c) => `${o.replace('>', ` aria-label="${escAttr(t('langToggle'))}" title="${escAttr(t('langToggle'))}">`)}TR${c}`);
  return html;
}

async function main() {
  const dir = resolve(process.argv[2] || 'public');
  const { setLang, t } = await import(pathToFileURL(join(dir, 'js', 'i18n.js')).href);
  setLang('en');
  const indexPath = join(dir, 'index.html');
  const before = readFileSync(indexPath, 'utf8');
  const after = prerender(before, t);
  writeFileSync(indexPath, after);
  const left = (after.match(/data-i18n(?:-html)?="[\w-]+"[^>]*>\s*<\//g) || []).length;
  console.log(`index.html önceden dolduruldu (boş kalan alan: ${left})`);
  if (left) process.exitCode = 1;

  const sitemapPath = join(dir, 'sitemap.xml');
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(sitemapPath, readFileSync(sitemapPath, 'utf8').replaceAll('__LASTMOD__', today));
  console.log(`sitemap.xml tarihi: ${today}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
