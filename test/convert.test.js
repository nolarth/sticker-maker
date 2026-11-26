'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { convertToSticker, MAX_ANIMATED_BYTES, MAX_STATIC_BYTES } = require('../lib/convert');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-test-'));
const gen = (name, args) => {
  const out = path.join(dir, name);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, out]);
  return out;
};
const isWebp = (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
// VP8X başlığından tuval boyutu ve animasyon bayrağı
const canvas = (b) => ({ w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), anim: !!(b[20] & 0x02) });

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('animasyonlu GIF -> 512x512 animasyonlu WebP, < 500 KB', async () => {
  const gif = gen('a.gif', ['-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=15:duration=3']);
  const r = await convertToSticker(gif, { fit: 'fit' });
  assert.ok(isWebp(r.buffer));
  assert.ok(r.animated);
  assert.ok(r.bytes <= MAX_ANIMATED_BYTES);
  assert.deepStrictEqual(canvas(r.buffer), { w: 512, h: 512, anim: true });
});

test('uzun GIF 10 saniyeye kırpılır', async () => {
  const gif = gen('long.gif', ['-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=10:duration=14']);
  const r = await convertToSticker(gif, { fit: 'crop' });
  assert.ok(r.duration <= 10);
});

test('sabit görsel -> sabit WebP, < 100 KB', async () => {
  const png = gen('s.png', ['-f', 'lavfi', '-i', 'color=blue:size=200x300', '-frames:v', '1']);
  const r = await convertToSticker(png, {});
  assert.ok(!r.animated);
  assert.ok(r.bytes <= MAX_STATIC_BYTES);
  assert.ok(isWebp(r.buffer));
});
