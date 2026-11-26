import test from 'node:test';
import assert from 'node:assert/strict';
import { dict, detectLang, setLang, t, SITE_NAME } from '../public/js/i18n.js?v=__V__';
import { fetchMedia } from '../public/js/links.js';

const mem = (v) => ({ get: () => v, set: () => {} });

test('ilk açılışta dil: sistem Türkçe ise tr, değilse en', () => {
  assert.equal(detectLang({ languages: ['tr-TR', 'en-US'] }, mem(null)), 'tr');
  assert.equal(detectLang({ languages: ['tr'] }, mem(null)), 'tr');
  assert.equal(detectLang({ language: 'tr-TR' }, mem(null)), 'tr');
  assert.equal(detectLang({ languages: ['en-US', 'tr-TR'] }, mem(null)), 'en');
  assert.equal(detectLang({ languages: ['de-DE'] }, mem(null)), 'en');
  assert.equal(detectLang({ languages: [] , language: '' }, mem(null)), 'en');
  assert.equal(detectLang(undefined, mem(null)), 'en');
});

test('kullanıcının seçtiği dil sistem dilinden önce gelir', () => {
  assert.equal(detectLang({ languages: ['de-DE'] }, mem('tr')), 'tr');
  assert.equal(detectLang({ languages: ['tr-TR'] }, mem('en')), 'en');
  assert.equal(detectLang({ languages: ['tr-TR'] }, mem('xx')), 'tr');
});

test('iki dilde de aynı anahtarlar ve aynı türde değerler var', () => {
  const tr = dict.tr;
  const en = dict.en;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(tr).sort());
  for (const k of Object.keys(tr)) {
    assert.equal(typeof en[k], typeof tr[k], k);
    if (Array.isArray(tr[k])) assert.equal(en[k].length, tr[k].length, k);
    if (typeof tr[k] === 'function') assert.equal(en[k].length, tr[k].length, k);
  }
});

test('site adı iki dilde de "Sticker Maker"', () => {
  assert.equal(SITE_NAME, 'Sticker Maker');
  for (const l of ['tr', 'en']) { setLang(l); assert.match(t('title'), /^Sticker Maker/); }
  setLang('tr');
});

test('hata mesajları seçili dilde gelir', async () => {
  setLang('en');
  try {
    await assert.rejects(fetchMedia('garbage'), /Invalid link/);
    await assert.rejects(fetchMedia('https://t.co/abc'), /short link/);
    assert.equal(t('errHttp', 404), "Couldn't open the link (HTTP 404).");
  } finally {
    setLang('tr');
  }
  await assert.rejects(fetchMedia('garbage'), /Geçersiz link/);
});
