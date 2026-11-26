import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteKnownHosts, looksLikeMedia, fetchMedia } from '../public/js/links.js';

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
