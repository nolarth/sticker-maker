'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

// WhatsApp çıkartma kuralları
const SIZE = 512;
const MAX_ANIMATED_BYTES = 500 * 1024; // animasyonlu: en fazla 500 KB
const MAX_STATIC_BYTES = 100 * 1024; // sabit: en fazla 100 KB
const MAX_DURATION_SEC = 10; // animasyon süresi en fazla 10 sn

// Boyut sınırına sığana kadar sırayla denenecek ayarlar (en iyi kaliteden en düşüğe)
const ATTEMPTS = [
  { fps: 20, q: 80 },
  { fps: 15, q: 70 },
  { fps: 15, q: 55 },
  { fps: 12, q: 45 },
  { fps: 10, q: 35 },
  { fps: 10, q: 25 },
  { fps: 8, q: 20 },
  { fps: 6, q: 15 },
  { fps: 5, q: 10 },
];

function run(cmd, args, { timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${cmd} zaman aşımına uğradı`));
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => {
      stderr += d;
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} hata kodu ${code}: ${stderr.split('\n').slice(-6).join('\n')}`));
    });
  });
}

async function probe(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-count_packets',
    '-show_entries', 'stream=width,height,nb_read_packets,duration:format=duration,format_name',
    '-of', 'json',
    file,
  ]);
  const data = JSON.parse(stdout);
  const s = (data.streams && data.streams[0]) || null;
  if (!s) throw new Error('Dosyada görüntü bulunamadı. Geçerli bir GIF/video olduğundan emin ol.');
  const duration = parseFloat(s.duration) || parseFloat(data.format && data.format.duration) || 0;
  return {
    width: s.width,
    height: s.height,
    frames: parseInt(s.nb_read_packets, 10) || 1,
    duration,
    format: data.format && data.format.format_name,
  };
}

/**
 * Filtre zinciri: 512x512 kare tuval.
 *  - fit:  oranı koru, kenarları şeffaf doldur
 *  - crop: oranı koru, kareyi dolduracak şekilde ortadan kırp
 *  - stretch: kareye uzat
 */
function buildFilter({ fps, fit }) {
  const parts = [];
  if (fps) parts.push(`fps=${fps}`);
  if (fit === 'crop') {
    parts.push(`scale=${SIZE}:${SIZE}:force_original_aspect_ratio=increase:flags=lanczos`);
    parts.push(`crop=${SIZE}:${SIZE}`);
    parts.push('format=rgba');
  } else if (fit === 'stretch') {
    parts.push(`scale=${SIZE}:${SIZE}:flags=lanczos`);
    parts.push('format=rgba');
  } else {
    parts.push(`scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease:flags=lanczos`);
    parts.push('format=rgba');
    parts.push(`pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`);
  }
  return parts.join(',');
}

async function encode(input, output, { animated, fps, q, fit, start, duration }) {
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  if (start > 0) args.push('-ss', String(start));
  args.push('-i', input);
  if (animated) args.push('-t', String(duration));
  args.push(
    '-vf', buildFilter({ fps: animated ? fps : null, fit }),
    '-an',
    '-c:v', 'libwebp',
    '-lossless', '0',
    '-q:v', String(q),
    '-compression_level', '6',
    '-preset', 'picture',
  );
  if (animated) {
    args.push('-loop', '0');
  } else {
    args.push('-frames:v', '1');
  }
  args.push('-f', 'webp', output);
  await run('ffmpeg', args, { timeoutMs: 90_000 });
  const st = await fs.stat(output);
  return st.size;
}

/**
 * Girdi dosyasını WhatsApp çıkartmasına dönüştürür.
 * @returns {Promise<{buffer: Buffer, animated: boolean, bytes: number, fps: number|null, quality: number, duration: number, source: object}>}
 */
async function convertToSticker(inputPath, opts = {}) {
  const fit = ['fit', 'crop', 'stretch'].includes(opts.fit) ? opts.fit : 'fit';
  const info = await probe(inputPath);

  const animated = info.frames > 1 && opts.forceStatic !== true;
  let start = Math.max(0, Number(opts.start) || 0);
  if (info.duration && start >= info.duration) start = 0;
  const available = info.duration ? info.duration - start : MAX_DURATION_SEC;
  const duration = Math.max(0.1, Math.min(MAX_DURATION_SEC, available));

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sticker-'));
  const out = path.join(workDir, 'out.webp');
  try {
    const limit = animated ? MAX_ANIMATED_BYTES : MAX_STATIC_BYTES;
    const attempts = animated ? ATTEMPTS : ATTEMPTS.map((a) => ({ fps: null, q: a.q }));
    let last = null;
    for (const a of attempts) {
      const bytes = await encode(inputPath, out, { animated, fps: a.fps, q: a.q, fit, start, duration });
      last = { ...a, bytes };
      if (bytes <= limit) {
        const buffer = await fs.readFile(out);
        return { buffer, animated, bytes, fps: a.fps, quality: a.q, duration: animated ? duration : 0, source: info };
      }
    }
    // Hâlâ büyükse: süreyi kısaltarak son deneme
    if (animated) {
      for (const d of [duration * 0.6, duration * 0.35]) {
        const bytes = await encode(inputPath, out, { animated, fps: 6, q: 10, fit, start, duration: d });
        if (bytes <= limit) {
          const buffer = await fs.readFile(out);
          return { buffer, animated, bytes, fps: 6, quality: 10, duration: d, source: info };
        }
      }
    }
    const kb = last ? Math.round(last.bytes / 1024) : '?';
    throw new Error(`Çıkartma WhatsApp sınırına (${limit / 1024} KB) sığdırılamadı (en küçük: ${kb} KB). Daha kısa bir GIF dene.`);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

module.exports = { convertToSticker, probe, buildFilter, SIZE, MAX_ANIMATED_BYTES, MAX_STATIC_BYTES, MAX_DURATION_SEC };
