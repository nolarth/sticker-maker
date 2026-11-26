import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteKnownHosts, looksLikeMedia, fetchMedia, parseXUrl, resolveXMedia } from '../public/js/links.js';

const gifBytes = new Uint8Array([...'GIF89a', 0, 0, 0, 0, 0, 0].map((c) => (typeof c === 'string' ? c.charCodeAt(0) : c)));
const fakeFetch = (body, { status = 200, type = 'image/gif', url } = {}) => async (u) => ({
  ok: status < 400, status, url: url || u,
  headers: new Headers({ 'content-type': type }),
  arrayBuffer: async () => body.buffer,
});

test('Giphy sayfa linkleri medya linkine çevrilir', () => {
  assert.equal(rewriteKnownHosts('https://giphy.com/gifs/cat-funny-JIX9t2j0ZTN9S'), 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif');
  assert.equal(rewriteKnownHosts('https://www.giphy.com/embed/abc123'), 'https://media.giphy.com/media/abc123/giphy.gif');
  assert.equal(rewriteKnownHosts('https://giphy.com/stickers/hello-XyZ9'), 'https://media.giphy.com/media/XyZ9/giphy.gif');
  assert.equal(rewriteKnownHosts('https://example.com/x.gif'), 'https://example.com/x.gif');
});

test('dosya imzası tanınır', () => {
  assert.ok(looksLikeMedia('', gifBytes));
  assert.ok(!looksLikeMedia('application/json', new TextEncoder().encode('{"a":1}........')));
});

test('GIF indirilir, dosya adı Giphy ID olur', async () => {
  let asked;
  const f = async (u, o) => { asked = u; return fakeFetch(gifBytes)(u, o); };
  const r = await fetchMedia('https://giphy.com/gifs/cat-ABC', f);
  assert.equal(asked, 'https://media.giphy.com/media/ABC/giphy.gif');
  assert.equal(r.name, 'ABC');
  assert.equal(r.bytes.length, gifBytes.length);
});

test('hatalı girişler anlaşılır mesajla reddedilir', async () => {
  await assert.rejects(fetchMedia('çöp'), /Geçersiz/);
  await assert.rejects(fetchMedia('file:///etc/passwd'), /http\/https/);
  await assert.rejects(fetchMedia('https://tenor.com/view/dance-gif-123'), /Tenor/);
  await assert.rejects(fetchMedia('https://x.com/a', fakeFetch(new TextEncoder().encode('<html>.......'), { type: 'text/html' })), /sayfa linki/);
  await assert.rejects(fetchMedia('https://x.com/a.gif', fakeFetch(gifBytes, { status: 404 })), /404/);
  await assert.rejects(fetchMedia('https://x.com/a.gif', async () => { throw new TypeError('CORS'); }), /izin vermiyor/);
});

// ---------- X (Twitter) ----------
const mp4Bytes = new Uint8Array([0, 0, 0, 0x20, ...'ftypisom'].map((c) => (typeof c === 'string' ? c.charCodeAt(0) : c)));
const json = (obj, status = 200) => ({ ok: status < 400, status, url: '', headers: new Headers({ 'content-type': 'application/json' }), json: async () => obj });
const fx = (all) => ({ code: 200, tweet: { media: { all } } });
const router = (routes) => async (u) => {
  for (const [re, handler] of routes) if (re.test(u)) return handler(u);
  throw new TypeError('ağ hatası: ' + u);
};

test('X linkleri tanınır', () => {
  assert.deepEqual(parseXUrl('https://x.com/kedi/status/1234567890123'), { id: '1234567890123', index: null });
  assert.deepEqual(parseXUrl('https://twitter.com/i/status/42'), { id: '42', index: null });
  assert.deepEqual(parseXUrl('https://mobile.twitter.com/a/status/42?s=20&t=abc'), { id: '42', index: null });
  assert.deepEqual(parseXUrl('https://x.com/a/status/42/video/2'), { id: '42', index: 2 });
  assert.deepEqual(parseXUrl('https://fxtwitter.com/a/status/42/photo/1'), { id: '42', index: 1 });
  assert.deepEqual(parseXUrl('https://vxtwitter.com/a/status/42'), { id: '42', index: null });
  assert.equal(parseXUrl('https://x.com/kedi'), null);
  assert.equal(parseXUrl('https://example.com/a/status/42'), null);
});

test('X: FxTwitter ile GIF bulunur ve indirilir', async () => {
  const asked = [];
  const f = router([
    [/api\.fxtwitter\.com\/status\/42$/, () => json(fx([{ type: 'photo', url: 'https://pbs.twimg.com/p.jpg' }, { type: 'gif', url: 'https://video.twimg.com/tweet_video/abc.mp4' }]))],
    [/video\.twimg\.com/, (u) => { asked.push(u); return fakeFetch(mp4Bytes, { type: 'video/mp4' })(u); }],
  ]);
  const r = await fetchMedia('https://x.com/kedi/status/42', f);
  assert.deepEqual(asked, ['https://video.twimg.com/tweet_video/abc.mp4']);
  assert.equal(r.name, 'x_42');
});

test('X: /video/N ile belirli medya seçilir', async () => {
  const list = [{ type: 'gif', url: 'https://v/1.mp4' }, { type: 'video', url: 'https://v/2.mp4' }];
  const f = router([[/fxtwitter/, () => json(fx(list))]]);
  assert.equal((await resolveXMedia({ id: '1', index: 2 }, f)).url, 'https://v/2.mp4');
  assert.equal((await resolveXMedia({ id: '1', index: null }, f)).url, 'https://v/1.mp4');
});

test('X: FxTwitter çalışmazsa VxTwitter denenir', async () => {
  const f = router([
    [/fxtwitter/, () => { throw new TypeError('CORS'); }],
    [/api\.vxtwitter\.com\/Twitter\/status\/7$/, () => json({ media_extended: [{ type: 'gif', url: 'https://video.twimg.com/tweet_video/vx.mp4' }] })],
  ]);
  assert.equal((await resolveXMedia({ id: '7', index: null }, f)).url, 'https://video.twimg.com/tweet_video/vx.mp4');
});

test('X: anlaşılır hata mesajları', async () => {
  await assert.rejects(resolveXMedia({ id: '1' }, router([[/fxtwitter/, () => json(fx([]))]])), /GIF, video veya fotoğraf yok/);
  await assert.rejects(resolveXMedia({ id: '1' }, router([[/fxtwitter/, () => json({ code: 404 }, 404)], [/vxtwitter/, () => json({}, 404)]])), /bulunamadı/);
  await assert.rejects(resolveXMedia({ id: '1' }, router([[/fxtwitter/, () => json({ code: 401 }, 401)], [/vxtwitter/, () => json({}, 500)]])), /gizli/);
  await assert.rejects(resolveXMedia({ id: '1' }, router([])), /okunamadı/);
  const blocked = router([[/fxtwitter/, () => json(fx([{ type: 'gif', url: 'https://video.twimg.com/a.mp4' }]))]]);
  await assert.rejects(fetchMedia('https://x.com/a/status/1', blocked), /X medyası indirilemedi/);
});
