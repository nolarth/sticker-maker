// Linkten GIF indirme (tarayıcıda). Yalnızca CORS'a izin veren adresler indirilebilir
// (Giphy, Tenor medya sunucuları, Discord/Imgur gibi CDN'lerin çoğu izin verir).

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
    throw new Error('Geçersiz link.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Yalnızca http/https linkleri desteklenir.');
  return u;
}

/** @returns {Promise<{bytes: Uint8Array, name: string}>} */
export async function fetchMedia(raw, fetchImpl = fetch) {
  validateUrl(raw);
  const url = rewriteKnownHosts(raw);
  if (/^https?:\/\/(www\.)?tenor\.com\/view\//i.test(url)) {
    throw new Error('Tenor sayfa linkleri doğrudan açılamıyor. GIF\'e sağ tıklayıp "Resim adresini kopyala" ile media.tenor.com linkini yapıştır.');
  }
  let res;
  try {
    res = await fetchImpl(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch {
    throw new Error('Bu site doğrudan indirmeye izin vermiyor. GIF\'i bilgisayarına indirip "Dosya yükle" sekmesinden yükle.');
  }
  if (!res.ok) throw new Error(`Link açılamadı (HTTP ${res.status}).`);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw new Error('Dosya çok büyük (en fazla 25 MB).');
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error('Dosya çok büyük (en fazla 25 MB).');
  const type = res.headers.get('content-type') || '';
  if (!looksLikeMedia(type, bytes)) {
    throw new Error(type.includes('html')
      ? 'Bu bir sayfa linki, GIF değil. GIF\'e sağ tıklayıp "Resim adresini kopyala" ile doğrudan linki yapıştır.'
      : 'Link bir GIF/görsel değil.');
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
