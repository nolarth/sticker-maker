import { t } from './i18n.js?v=__V__';

// Linkten GIF indirme (tarayıcıda). Yalnızca CORS'a izin veren adresler indirilebilir
// (Giphy, Tenor medya sunucuları, Discord/Imgur gibi CDN'lerin çoğu izin verir).
// X (Twitter) linkleri, herkese açık FxTwitter / VxTwitter API'leri üzerinden çözülür.

export const MAX_BYTES = 25 * 1024 * 1024;

/** Giphy sayfa linklerini doğrudan medya linkine çevirir. */
export function rewriteKnownHosts(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return raw;
  }
  const host = u.hostname.replace(/^www\./, '');
  // giphy.com/gifs/isim-ABC123 · giphy.com/stickers/... · giphy.com/embed/ABC123
  if (host === 'giphy.com') {
    const m = u.pathname.match(/^\/(?:gifs|stickers|embed)\/(?:[^/]*-)?([A-Za-z0-9]+)\/?$/);
    if (m) return `https://media.giphy.com/media/${m[1]}/giphy.gif`;
  }
  return u.toString();
}

/** Dosya imzasından görsel/video olup olmadığını anlar. */
export function looksLikeMedia(contentType, buf) {
  if (/^(image|video)\//.test(contentType || '')) return true;
  if (buf && buf.length >= 12) {
    const s = String.fromCharCode(...buf.subarray(0, 12));
    if (s.startsWith('GIF8')) return true;
    if (s.slice(4, 8) === 'ftyp') return true; // mp4
    if (buf[0] === 0x89 && s.slice(1, 4) === 'PNG') return true;
    if (buf[0] === 0xff && buf[1] === 0xd8) return true; // jpeg
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true; // webm
  }
  return false;
}

export function validateUrl(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    throw new Error(t('errBadUrl'));
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(t('errProtocol'));
  return u;
}

// ---------- X (Twitter) ----------

const X_HOSTS = /^(?:[a-z0-9-]+\.)?(?:x\.com|twitter\.com|fxtwitter\.com|fixupx\.com|vxtwitter\.com|fixvx\.com|twittpr\.com|nitter\.net)$/i;

/**
 * X/Twitter tweet linkini çözümler.
 * x.com/kullanici/status/123 · twitter.com/i/status/123 · .../status/123/video/2 · fxtwitter/vxtwitter linkleri
 * @returns {{id: string, index: number|null} | null}  index: 1'den başlayan medya sırası (/photo/N, /video/N)
 */
export function parseXUrl(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (!X_HOSTS.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/(?:[^/]+|i(?:\/web)?)\/status(?:es)?\/(\d{1,25})(?:\/(?:photo|video)\/(\d+))?/i);
  if (!m) return null;
  return { id: m[1], index: m[2] ? Number(m[2]) : null };
}

/** Medya listesinden çıkartmaya en uygun olanı seç: istenen sıra > GIF > video > fotoğraf */
function pickMedia(list, index) {
  if (!list.length) return null;
  if (index && list[index - 1]) return list[index - 1];
  return list.find((m) => m.type === 'gif') || list.find((m) => m.type === 'video') || list[0];
}

// FxTwitter: { code, message, tweet: { media: { all: [{ type: 'gif'|'video'|'photo', url }] } } }
async function fromFxTwitter(id, fetchImpl) {
  const res = await fetchImpl(`https://api.fxtwitter.com/status/${id}`, { credentials: 'omit' });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`HTTP ${res.status}`);
  if (json.code === 404 || res.status === 404) return { notFound: true };
  if (json.code === 401 || res.status === 401) return { private: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const media = (json.tweet && json.tweet.media) || {};
  const all = media.all || [...(media.videos || []), ...(media.photos || [])];
  return { list: all.filter((m) => m && m.url).map((m) => ({ type: m.type === 'image' ? 'photo' : m.type, url: m.url })) };
}

// VxTwitter: { media_extended: [{ type: 'gif'|'video'|'image', url }], mediaURLs: [...] }
async function fromVxTwitter(id, fetchImpl) {
  const res = await fetchImpl(`https://api.vxtwitter.com/Twitter/status/${id}`, { credentials: 'omit' });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json().catch(() => null);
  if (!json) throw new Error('invalid response');
  const ext = json.media_extended || (json.mediaURLs || []).map((url) => ({ type: /\.mp4/i.test(url) ? 'video' : 'image', url }));
  return { list: ext.filter((m) => m && m.url).map((m) => ({ type: m.type === 'image' ? 'photo' : m.type, url: m.url })) };
}

/** Tweet'teki GIF/video/fotoğrafın doğrudan linkini bulur. */
export async function resolveXMedia({ id, index }, fetchImpl = fetch) {
  let sawNotFound = false;
  let sawPrivate = false;
  const details = [];
  for (const source of [fromFxTwitter, fromVxTwitter]) {
    const label = source === fromFxTwitter ? 'FxTwitter' : 'VxTwitter';
    try {
      const r = await source(id, fetchImpl);
      if (r.notFound) { sawNotFound = true; continue; }
      if (r.private) { sawPrivate = true; continue; }
      const picked = pickMedia(r.list, index);
      if (picked) return picked;
      throw Object.assign(new Error(t('errNoMediaInTweet')), { final: true });
    } catch (e) {
      if (e.final) throw e;
      details.push(`${label}: ${e && e.message ? e.message : e}`);
      /* sonraki kaynağı dene */
    }
  }
  if (sawPrivate) throw new Error(t('errPrivate'));
  if (sawNotFound) throw new Error(t('errNotFound'));
  throw new Error(`${t('errXRead')}\n[${t('detail')} — ${details.join(' · ')}]`);
}

// ---------- İndirme ----------

async function download(url, fetchImpl, { blockedMsg } = {}) {
  let res;
  try {
    res = await fetchImpl(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch (e) {
    throw new Error(blockedMsg ? `${blockedMsg}\n[${t('detail')} — ${url} · ${e && e.message}]` : t('errBlocked'));
  }
  if (!res.ok) throw new Error(t('errHttp', res.status));
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw new Error(t('errTooBig'));
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error(t('errTooBig'));
  return { res, bytes, type: res.headers.get('content-type') || '' };
}

/** @returns {Promise<{bytes: Uint8Array, name: string}>} */
export async function fetchMedia(raw, fetchImpl = fetch) {
  validateUrl(raw);

  const host = new URL(String(raw).trim()).hostname.toLowerCase();
  if (host === 't.co' || /^pic\.(x|twitter)\.com$/.test(host)) {
    throw new Error(t('errShortLink'));
  }
  const x = parseXUrl(raw);
  if (x) {
    const media = await resolveXMedia(x, fetchImpl);
    const { bytes, type } = await download(media.url, fetchImpl, {
      blockedMsg: t('errXMedia'),
    });
    if (!looksLikeMedia(type, bytes)) throw new Error(t('errXNotMedia'));
    return { bytes, name: `x_${x.id}` };
  }

  const url = rewriteKnownHosts(raw);
  if (/^https?:\/\/(www\.)?tenor\.com\/view\//i.test(url)) {
    throw new Error(t('errTenor'));
  }
  const { res, bytes, type } = await download(url, fetchImpl);
  if (!looksLikeMedia(type, bytes)) {
    throw new Error(type.includes('html')
      ? t('errPageLink')
      : t('errNotGif'));
  }
  let name = 'sticker';
  try {
    const p = new URL(res.url || url).pathname.split('/').filter(Boolean);
    const last = (p[p.length - 1] || '').replace(/\.[a-z0-9]+$/i, '');
    // giphy.gif gibi genel adlarda bir üst klasörü (ID) kullan
    name = (/^(giphy|tenor|image|download)$/i.test(last) && p.length > 1 ? p[p.length - 2] : last) || 'sticker';
  } catch { /* yoksay */ }
  return { bytes, name };
}
