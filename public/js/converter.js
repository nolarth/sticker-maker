// Tarayıcı içinde (ffmpeg.wasm) GIF -> WhatsApp çıkartması (512x512 WebP) dönüştürücü.
import { FFmpeg } from '../vendor/ffmpeg/index.js';
import { t } from './i18n.js?v=__V__';

export const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

export const SIZE = 512;
export const MAX_ANIMATED_BYTES = 500 * 1024; // animasyonlu: en fazla 500 KB
export const MAX_STATIC_BYTES = 100 * 1024; // sabit: en fazla 100 KB
export const MAX_DURATION_SEC = 10; // animasyon: en fazla 10 sn

// Boyut sınırına sığana kadar sırayla denenecek ayarlar (en iyi kaliteden en düşüğe)
const ATTEMPTS = [
  { fps: 20, q: 80 },
  { fps: 15, q: 70 },
  { fps: 15, q: 55 },
  { fps: 12, q: 45 },
  { fps: 10, q: 35 },
  { fps: 10, q: 25 },
  { fps: 8, q: 18 },
  { fps: 6, q: 12 },
];

let ffmpeg = null;
let loading = null;
let logs = [];

/** ffmpeg.wasm'ı bir kez yükle (~30 MB, tarayıcı önbelleğe alır). */
export function loadFFmpeg() {
  if (loading) return loading;
  loading = (async () => {
    const ff = new FFmpeg();
    ff.on('log', ({ message }) => {
      logs.push(message);
      if (logs.length > 400) logs = logs.slice(-200);
    });
    await ff.load({
      coreURL: `${CORE_BASE}/ffmpeg-core.js`,
      wasmURL: `${CORE_BASE}/ffmpeg-core.wasm`,
    });
    ffmpeg = ff;
    return ff;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

// ffmpeg.wasm günlük satırları exec() bittikten kısa süre sonra gelebilir; bitiş satırını bekle.
async function waitForLog(re, ms = 1500) {
  const until = Date.now() + ms;
  while (!logs.some((l) => re.test(l)) && Date.now() < until) await new Promise((r) => setTimeout(r, 25));
}

async function exec(args, timeoutMs = 120_000) {
  logs = [];
  const code = await ffmpeg.exec(args, timeoutMs);
  if (code !== 0) await waitForLog(/Aborted|Error|error/i, 300);
  if (code !== 0) {
    const tail = logs.slice(-6).join('\n');
    throw new Error(code === 1 && /timeout|Timeout/.test(tail) ? t('errTimeout') : `ffmpeg hata kodu ${code}\n${tail}`);
  }
  return logs.slice();
}

const parseTime = (h, m, s) => Number(h) * 3600 + Number(m) * 60 + Number(s);

/** Kare sayısı ve süreyi bul: girdiyi bir kez çözüp ffmpeg günlüğünü okur. */
async function probe(input) {
  await exec(['-hide_banner', '-loglevel', 'info', '-stats', '-i', input, '-map', '0:v:0', '-f', 'null', '-'], 60_000);
  await waitForLog(/muxing overhead|Aborted\(\)/);
  const text = logs.join('\n');
  if (!/Stream #\d+:\d+.*Video:/.test(text)) throw new Error(t('errNoVideo'));

  let duration = 0;
  const d = text.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (d) duration = parseTime(d[1], d[2], d[3]);
  let frames = 1;
  const fr = [...text.matchAll(/frame=\s*(\d+)/g)];
  if (fr.length) frames = Number(fr[fr.length - 1][1]) || 1;
  const t = [...text.matchAll(/time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  if (t.length) duration = Math.max(duration, parseTime(...t[t.length - 1].slice(1, 4)));
  return { frames, duration };
}

/**
 * Filtre zinciri: 512x512 kare tuval.
 *  fit: oranı koru, kenarları şeffaf doldur · crop: ortadan kırp · stretch: kareye uzat
 */
export function buildFilter({ fps, fit }) {
  const p = [];
  if (fps) p.push(`fps=${fps}`);
  if (fit === 'crop') {
    p.push(`scale=${SIZE}:${SIZE}:force_original_aspect_ratio=increase:flags=lanczos`, `crop=${SIZE}:${SIZE}`, 'format=rgba');
  } else if (fit === 'stretch') {
    p.push(`scale=${SIZE}:${SIZE}:flags=lanczos`, 'format=rgba');
  } else {
    p.push(
      `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease:flags=lanczos`,
      'format=rgba',
      `pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
    );
  }
  return p.join(',');
}

async function encode(input, { animated, fps, q, fit, start, duration }) {
  const out = 'out.webp';
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (start > 0) args.push('-ss', String(start));
  args.push('-i', input);
  if (animated) args.push('-t', duration.toFixed(2));
  args.push(
    '-vf', buildFilter({ fps: animated ? fps : null, fit }),
    '-an', '-c:v', 'libwebp', '-lossless', '0', '-q:v', String(q),
    '-compression_level', '4', '-preset', 'picture',
  );
  if (animated) args.push('-loop', '0');
  else args.push('-frames:v', '1');
  args.push('-f', 'webp', out);
  await exec(args);
  const data = await ffmpeg.readFile(out);
  await ffmpeg.deleteFile(out).catch(() => {});
  return data;
}

async function prepare(bytes, opts) {
  const status = opts.onStatus || (() => {});
  if (!ffmpeg) {
    status(t('stLoading'));
    await loadFFmpeg();
  }
  // writeFile baytları worker'a taşır (orijinal dizi boşalır); kaynak tekrar kullanılabilsin diye kopya gönder
  await ffmpeg.writeFile('input', bytes.slice());
  status(t('stInspecting'));
  const info = await probe('input');
  const animated = info.frames > 1;
  let start = Math.max(0, Number(opts.start) || 0);
  if (!info.duration || start >= info.duration) start = 0;
  const available = info.duration ? info.duration - start : MAX_DURATION_SEC;
  const duration = Math.max(0.1, Math.min(MAX_DURATION_SEC, available));
  const fit = ['fit', 'crop', 'stretch'].includes(opts.fit) ? opts.fit : 'fit';
  return { status, animated, start, duration, fit };
}

export const MAX_GIF_BYTES = 8 * 1024 * 1024;
const GIF_ATTEMPTS = [
  { side: 480, fps: 15, colors: 160 },
  { side: 400, fps: 12, colors: 128 },
  { side: 320, fps: 10, colors: 96 },
  { side: 256, fps: 8, colors: 64 },
];

/**
 * WhatsApp'a GIF olarak gönderilecek dosyayı üretir. WhatsApp sohbetindeki GIF'ten
 * kendi "Çıkartma oluştur" özelliğiyle animasyonlu çıkartma yapılabiliyor.
 * fit: oranı koru (dolgu yok) · crop: kare kırp · stretch: kareye uzat
 */
export async function convertToGif(bytes, opts = {}) {
  const { status, animated, start, duration, fit } = await prepare(bytes, opts);
  try {
    let last = null;
    for (let i = 0; i < GIF_ATTEMPTS.length; i++) {
      const { side, fps, colors } = GIF_ATTEMPTS[i];
      status(i === 0 ? t('stGif') : t('stGifShrink', i + 1));
      const size = fit === 'crop'
        ? `scale=${side}:${side}:force_original_aspect_ratio=increase:flags=lanczos,crop=${side}:${side}`
        : fit === 'stretch'
          ? `scale=${side}:${side}:flags=lanczos`
          : `scale=${side}:${side}:force_original_aspect_ratio=decrease:flags=lanczos`;
      const vf = `${animated ? `fps=${fps},` : ''}${size},split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
      const args = ['-hide_banner', '-loglevel', 'error', '-y'];
      if (start > 0) args.push('-ss', String(start));
      args.push('-i', 'input');
      if (animated) args.push('-t', duration.toFixed(2));
      else args.push('-frames:v', '1');
      args.push('-vf', vf, '-an', '-loop', '0', '-f', 'gif', 'out.gif');
      await exec(args);
      const data = await ffmpeg.readFile('out.gif');
      await ffmpeg.deleteFile('out.gif').catch(() => {});
      last = { data, animated, bytes: data.length, duration: animated ? duration : 0 };
      if (data.length <= MAX_GIF_BYTES) return last;
    }
    return last;
  } finally {
    await ffmpeg.deleteFile('input').catch(() => {});
  }
}

/**
 * @param {Uint8Array} bytes  girdi dosyası
 * @param {{fit?: string, start?: number, onStatus?: (s: string) => void}} opts
 */
export async function convertToSticker(bytes, opts = {}) {
  const { status, animated, start, duration, fit } = await prepare(bytes, opts);
  const input = 'input';
  try {
    const limit = animated ? MAX_ANIMATED_BYTES : MAX_STATIC_BYTES;
    let smallest = Infinity;
    for (let i = 0; i < ATTEMPTS.length; i++) {
      const a = ATTEMPTS[i];
      status(animated ? t('stConvertingTry', i + 1, a.fps, a.q) : t('stConverting'));
      const data = await encode(input, { animated, fps: a.fps, q: a.q, fit, start, duration });
      smallest = Math.min(smallest, data.length);
      if (data.length <= limit) {
        return { data, animated, bytes: data.length, fps: animated ? a.fps : null, quality: a.q, duration: animated ? duration : 0 };
      }
      // Çok büyükse ara adımları atla (wasm'da her deneme zaman alır)
      if (data.length > limit * 2.5 && i < ATTEMPTS.length - 3) i += 2;
      else if (data.length > limit * 1.6 && i < ATTEMPTS.length - 2) i += 1;
    }
    if (animated) {
      for (const d of [duration * 0.6, duration * 0.35]) {
        status(t('stShorten', d.toFixed(1)));
        const data = await encode(input, { animated, fps: 6, q: 10, fit, start, duration: d });
        smallest = Math.min(smallest, data.length);
        if (data.length <= limit) return { data, animated, bytes: data.length, fps: 6, quality: 10, duration: d };
      }
    }
    throw new Error(t('errTooLarge', limit / 1024, Math.round(smallest / 1024)));
  } finally {
    await ffmpeg.deleteFile(input).catch(() => {});
  }
}
