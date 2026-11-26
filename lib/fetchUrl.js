'use strict';

const dns = require('node:dns/promises');
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');

const MAX_BYTES = 25 * 1024 * 1024; // indirilecek en fazla 25 MB
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;

class FetchError extends Error {}

/** Özel/yerel ağ adreslerini engelle (SSRF koruması). */
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return (
    v === '::' || v === '::1' ||
    v.startsWith('fc') || v.startsWith('fd') ||
    v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') ||
    v.startsWith('ff')
  );
}

async function resolvePublic(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new FetchError('Bu adrese erişim engellendi.');
    return { address: hostname, family: net.isIP(hostname) };
  }
  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new FetchError('Alan adı bulunamadı.');
  }
  if (!records.length || records.some((r) => isPrivateAddress(r.address))) {
    throw new FetchError('Bu adrese erişim engellendi.');
  }
  return records[0];
}

function parseUrl(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    throw new FetchError('Geçersiz link.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new FetchError('Yalnızca http/https linkleri desteklenir.');
  if (u.username || u.password) throw new FetchError('Kimlik bilgisi içeren linkler desteklenmez.');
  return u;
}

/** Tek bir isteği, DNS sonucu sabitlenmiş şekilde yapar (DNS rebinding'e karşı). */
async function requestOnce(u, maxBytes) {
  const { address, family } = await resolvePublic(u.hostname.replace(/^\[|\]$/g, ''));
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.get(
      u,
      {
        lookup: (_host, _opts, cb) => cb(null, address, family),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StickerMaker/1.0)',
          Accept: 'image/gif,image/webp,image/*,video/mp4,video/*,text/html;q=0.8,*/*;q=0.5',
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          resolve({ redirect: new URL(res.headers.location, u).toString() });
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new FetchError(`Link açılamadı (HTTP ${status}).`));
          return;
        }
        const len = parseInt(res.headers['content-length'] || '0', 10);
        if (len > maxBytes) {
          res.destroy();
          reject(new FetchError(`Dosya çok büyük (en fazla ${Math.round(maxBytes / 1048576)} MB).`));
          return;
        }
        const chunks = [];
        let total = 0;
        res.on('data', (c) => {
          total += c.length;
          if (total > maxBytes) {
            res.destroy();
            reject(new FetchError(`Dosya çok büyük (en fazla ${Math.round(maxBytes / 1048576)} MB).`));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () =>
          resolve({ buffer: Buffer.concat(chunks), contentType: String(res.headers['content-type'] || '').toLowerCase(), url: u.toString() })
        );
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new FetchError('Link zaman aşımına uğradı.')));
    req.on('error', (e) => reject(e instanceof FetchError ? e : new FetchError('Linke bağlanılamadı.')));
  });
}

async function fetchFollow(rawUrl, maxBytes = MAX_BYTES) {
  let current = parseUrl(rawUrl);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const r = await requestOnce(current, maxBytes);
    if (r.redirect) {
      current = parseUrl(r.redirect);
      continue;
    }
    return r;
  }
  throw new FetchError('Çok fazla yönlendirme.');
}

/** Giphy / Tenor gibi sayfa linklerini doğrudan medya linkine çevir. */
function rewriteKnownHosts(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return raw;
  }
  const host = u.hostname.replace(/^www\./, '');
  // giphy.com/gifs/isim-ABC123  veya  giphy.com/embed/ABC123
  if (host === 'giphy.com') {
    const m = u.pathname.match(/^\/(?:gifs|stickers|embed)\/(?:[^/]*-)?([A-Za-z0-9]+)\/?$/);
    if (m) return `https://media.giphy.com/media/${m[1]}/giphy.gif`;
  }
  return raw;
}

function looksLikeMedia(contentType, buf) {
  if (/^(image|video)\//.test(contentType)) return true;
  if (buf.length >= 6) {
    const head = buf.subarray(0, 12).toString('latin1');
    if (head.startsWith('GIF8')) return true;
    if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return true;
    if (head.slice(4, 8) === 'ftyp') return true; // mp4
    if (buf[0] === 0x89 && head.slice(1, 4) === 'PNG') return true;
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true; // webm
  }
  return false;
}

/** HTML sayfasından og:video / og:image / twitter:image çıkar. */
function extractMediaFromHtml(html, baseUrl) {
  const candidates = [];
  const metaRe = /<meta\s+[^>]*>/gi;
  let m;
  while ((m = metaRe.exec(html))) {
    const tag = m[0];
    const prop = (tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const content = (tag.match(/content\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!prop || !content) continue;
    const p = prop.toLowerCase();
    const rank = {
      'og:image:secure_url': 3, 'og:image': 3, 'twitter:image': 4,
      'og:video:secure_url': 1, 'og:video:url': 1, 'og:video': 2,
    }[p];
    if (rank === undefined) continue;
    let score = rank;
    if (/\.gif(\?|$)/i.test(content)) score -= 2; // GIF'i tercih et
    candidates.push({ url: content.replace(/&amp;/g, '&'), score });
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates.map((c) => {
    try {
      return new URL(c.url, baseUrl).toString();
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Linkten GIF/video indir. Sayfa linki verilirse içindeki medyayı bulmaya çalışır.
 * @returns {Promise<{buffer: Buffer, contentType: string, url: string}>}
 */
async function fetchMedia(rawUrl) {
  const first = await fetchFollow(rewriteKnownHosts(rawUrl));
  if (looksLikeMedia(first.contentType, first.buffer)) return first;

  if (first.contentType.includes('html')) {
    const html = first.buffer.toString('utf8', 0, Math.min(first.buffer.length, 2_000_000));
    const found = extractMediaFromHtml(html, first.url);
    for (const candidate of found.slice(0, 3)) {
      try {
        const r = await fetchFollow(candidate);
        if (looksLikeMedia(r.contentType, r.buffer)) return r;
      } catch {
        /* sonraki adayı dene */
      }
    }
    throw new FetchError('Sayfada GIF bulunamadı. GIF\'in doğrudan linkini (…/dosya.gif) dene.');
  }
  throw new FetchError('Link bir GIF/görsel değil.');
}

module.exports = { fetchMedia, FetchError, isPrivateAddress, extractMediaFromHtml, rewriteKnownHosts, looksLikeMedia };
