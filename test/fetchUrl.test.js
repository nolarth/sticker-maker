'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isPrivateAddress, extractMediaFromHtml, rewriteKnownHosts, looksLikeMedia, fetchMedia } = require('../lib/fetchUrl');

test('özel IP adresleri engellenir', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.20.0.1', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.0.1']) {
    assert.ok(isPrivateAddress(ip), ip);
  }
  for (const ip of ['8.8.8.8', '151.101.1.1', '2606:4700::1111']) assert.ok(!isPrivateAddress(ip), ip);
});

test('localhost ve file:// linkleri reddedilir', async () => {
  await assert.rejects(fetchMedia('http://127.0.0.1/a.gif'), /engellendi/);
  await assert.rejects(fetchMedia('http://[::1]/a.gif'), /engellendi/);
  await assert.rejects(fetchMedia('file:///etc/passwd'), /http\/https/);
  await assert.rejects(fetchMedia('çöp'), /Geçersiz/);
});

test('Giphy sayfa linkleri medya linkine çevrilir', () => {
  assert.strictEqual(rewriteKnownHosts('https://giphy.com/gifs/cat-funny-JIX9t2j0ZTN9S'), 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif');
  assert.strictEqual(rewriteKnownHosts('https://www.giphy.com/embed/abc123'), 'https://media.giphy.com/media/abc123/giphy.gif');
  assert.strictEqual(rewriteKnownHosts('https://example.com/x.gif'), 'https://example.com/x.gif');
});

test('HTML içinden og:image GIF bulunur (Tenor tarzı)', () => {
  const html = `<html><head>
    <meta property="og:video" content="https://media.tenor.com/abc/x.mp4">
    <meta property="og:image" content="https://media.tenor.com/abc/AAAAC/dance.gif">
  </head></html>`;
  const list = extractMediaFromHtml(html, 'https://tenor.com/view/dance-123');
  assert.strictEqual(list[0], 'https://media.tenor.com/abc/AAAAC/dance.gif');
  assert.ok(list.includes('https://media.tenor.com/abc/x.mp4'));
});

test('dosya imzası tanınır', () => {
  assert.ok(looksLikeMedia('', Buffer.from('GIF89a......')));
  assert.ok(!looksLikeMedia('application/json', Buffer.from('{"a":1}')));
});
