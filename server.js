'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const express = require('express');
const multer = require('multer');
const { convertToSticker } = require('./lib/convert');
const { fetchMedia, FetchError, looksLikeMedia } = require('./lib/fetchUrl');

const PORT = process.env.PORT || 3000;
const MAX_UPLOAD = 25 * 1024 * 1024;
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT) || 2;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD, files: 1 },
});

// Basit eşzamanlılık sınırı: ffmpeg CPU'yu yorar
let active = 0;
const queue = [];
function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
}
function release() {
  const next = queue.shift();
  if (next) next();
  else active--;
}

// Basit IP başına hız sınırı (dakikada 20 dönüştürme)
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const list = (hits.get(key) || []).filter((t) => now - t < 60_000);
  if (list.length >= 20) return res.status(429).json({ error: 'Çok fazla istek. Bir dakika sonra tekrar dene.' });
  list.push(now);
  hits.set(key, list);
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
}, 60_000).unref();

app.post('/api/convert', rateLimit, upload.single('file'), async (req, res) => {
  let buffer;
  let sourceName = 'sticker';
  try {
    if (req.file) {
      buffer = req.file.buffer;
      sourceName = path.parse(req.file.originalname || 'sticker').name;
      if (!looksLikeMedia(req.file.mimetype || '', buffer)) {
        return res.status(400).json({ error: 'Bu dosya bir GIF/görsel/video değil.' });
      }
    } else if (req.body && req.body.url) {
      const media = await fetchMedia(req.body.url);
      buffer = media.buffer;
      try {
        sourceName = path.parse(new URL(media.url).pathname).name || 'sticker';
      } catch { /* yoksay */ }
    } else {
      return res.status(400).json({ error: 'Bir dosya yükle veya link gir.' });
    }
  } catch (err) {
    const msg = err instanceof FetchError ? err.message : 'Link indirilemedi.';
    return res.status(400).json({ error: msg });
  }

  await acquire();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-'));
  try {
    const input = path.join(workDir, 'input');
    await fs.writeFile(input, buffer);
    const result = await convertToSticker(input, {
      fit: req.body && req.body.fit,
      start: req.body && req.body.start,
    });
    res.set({
      'Content-Type': 'image/webp',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(sourceName.slice(0, 60) || 'sticker')}.webp"`,
      'X-Sticker-Animated': String(result.animated),
      'X-Sticker-Bytes': String(result.bytes),
      'X-Sticker-Fps': String(result.fps ?? ''),
      'X-Sticker-Quality': String(result.quality),
      'X-Sticker-Duration': result.duration.toFixed(2),
      'X-Sticker-Name': encodeURIComponent(sourceName.slice(0, 60)),
      'Access-Control-Expose-Headers': 'X-Sticker-Animated, X-Sticker-Bytes, X-Sticker-Fps, X-Sticker-Quality, X-Sticker-Duration, X-Sticker-Name',
    });
    res.send(result.buffer);
  } catch (err) {
    console.error('[convert]', err.message);
    const userMsg = /sığdırılamadı|bulunamadı/.test(err.message)
      ? err.message
      : 'Dönüştürme başarısız. Dosyanın geçerli bir GIF olduğundan emin ol.';
    res.status(422).json({ error: userMsg });
  } finally {
    release();
    await fs.rm(workDir, { recursive: true, force: true });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Multer hataları (ör. dosya çok büyük)
app.use((err, _req, res, _next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `Dosya çok büyük (en fazla ${MAX_UPLOAD / 1048576} MB).` });
  }
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Sticker Maker çalışıyor: http://localhost:${PORT}`));
}

module.exports = app;
