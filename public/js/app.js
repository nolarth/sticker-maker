// Sürüm etiketi yayın sırasında commit kimliğiyle değiştirilir (önbellek kırma) — bkz. .github/workflows/pages.yml
import { convertToGif, convertToSticker, loadFFmpeg } from './converter.js?v=__V__';
import { fetchMedia, looksLikeMedia } from './links.js?v=__V__';
import { t, getLang, setLang, detectLang, saveLang, LANGS, SITE_URL } from './i18n.js?v=__V__';

const VERSION = '__V__';

{

  const $ = (s) => document.querySelector(s);
  const form = $('#form');
  const fileInput = $('#file');
  const drop = $('#drop');
  const dropFile = $('#dropFile');
  const urlInput = $('#url');
  const startInput = $('#start');
  const btn = $('#convertBtn');
  const errorBox = $('#error');
  const result = $('#result');
  const previewImg = $('#previewImg');
  const chatImg = $('#chatImg');
  const stats = $('#stats');
  const sendBtn = $('#sendBtn');
  const gifDownloadBtn = $('#gifDownloadBtn');
  const webpBtn = $('#webpBtn');
  const stepsEl = $('#steps');

  const verEl = document.getElementById('ver');

  let mode = 'upload';
  let selectedFile = null;
  let current = null; // { gif: File, url, name, source: Uint8Array, opts }
  const ua = navigator.userAgent;
  const platform = /android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'desktop';

  // ---------- Dil ----------
  const langToggle = $('#langToggle');
  function applyI18n() {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.title = t('title');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = t('metaDesc');
    // Adreste ?lang= varsa canonical o dil sürümünü göstersin (hreflang ile uyumlu)
    const hasLangParam = new URLSearchParams(location.search).has('lang');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = hasLangParam ? `${SITE_URL}?lang=${lang}` : SITE_URL;
    const ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.content = lang === 'tr' ? 'tr_TR' : 'en_US';
    document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      for (const pair of el.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split(':');
        el.setAttribute(attr.trim(), t(key.trim()));
      }
    });
    const other = LANGS.find((l) => l !== lang);
    langToggle.textContent = other.toUpperCase();
    langToggle.setAttribute('aria-label', t('langToggle'));
    langToggle.title = t('langToggle');
    if (verEl) verEl.textContent = t('version', VERSION.slice(0, 7));
    if (!btn.disabled) setStatus(t('prepare'));
    if (!webpBtn.disabled) webpBtn.textContent = t('webpDownload');
    renderResultText();
    document.documentElement.classList.remove('i18n-pending');
  }
  langToggle.addEventListener('click', () => {
    setLang(LANGS.find((l) => l !== getLang()));
    saveLang(getLang());
    // Paylaşılan link seçilen dilde açılsın
    try {
      const u = new URL(location.href);
      u.searchParams.set('lang', getLang());
      history.replaceState(null, '', u);
    } catch { /* yoksay */ }
    hideError();
    applyI18n();
  });

  // ---------- Tema ----------
  const themeToggle = $('#themeToggle');
  try {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.dataset.theme = saved;
  } catch { /* yoksay */ }
  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* yoksay */ }
  });

  // ---------- Sekmeler ----------
  function setMode(m) {
    mode = m;
    document.querySelectorAll('.tab').forEach((t) => {
      const on = t.dataset.tab === m;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.dataset.panel !== m));
    hideError();
    if (m === 'link') urlInput.focus();
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.tab)));

  // ---------- Dosya seçimi / sürükle-bırak / yapıştır ----------
  function pickFile(f) {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return showError(t('errTooBig'));
    selectedFile = f;
    dropFile.textContent = `${f.name || t('pastedImage')} · ${formatBytes(f.size)}`;
    dropFile.hidden = false;
    setMode('upload');
  }
  fileInput.addEventListener('change', () => pickFile(fileInput.files[0]));
  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); })
  );
  drop.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.files && dt.files[0]) return pickFile(dt.files[0]);
    const text = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (text && /^https?:\/\//i.test(text.trim())) {
      urlInput.value = text.trim();
      setMode('link');
    }
  });
  // Sayfadan sürüklenen görseller dropzone dışına bırakılırsa tarayıcı açmasın
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  document.addEventListener('paste', (e) => {
    if (e.target === urlInput || (e.target instanceof HTMLInputElement && e.target.type !== 'file')) return;
    const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
    const img = items.find((i) => i.kind === 'file');
    if (img) {
      e.preventDefault();
      return pickFile(img.getAsFile());
    }
    const text = e.clipboardData && e.clipboardData.getData('text');
    if (text && /^https?:\/\//i.test(text.trim())) {
      e.preventDefault();
      urlInput.value = text.trim();
      setMode('link');
    }
  });

  // ---------- Dönüştür ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    setLoading(true);
    try {
      let bytes;
      let name = 'sticker';
      if (mode === 'upload') {
        if (!selectedFile) throw new Error(t('errPickFirst'));
        bytes = new Uint8Array(await selectedFile.arrayBuffer());
        if (!looksLikeMedia(selectedFile.type, bytes)) throw new Error(t('errNotMedia'));
        name = (selectedFile.name || 'sticker').replace(/\.[^.]+$/, '') || 'sticker';
      } else {
        // Paylaşım metni yapıştırıldıysa içindeki ilk linki al
        const found = urlInput.value.match(/https?:\/\/[^\s<>"']+/i);
        if (!found) throw new Error(t('errEnterLink'));
        const u = found[0];
        setStatus(t('stDownloading'));
        ({ bytes, name } = await fetchMedia(u));
      }
      const opts = {
        fit: (form.querySelector('input[name="fit"]:checked') || {}).value || 'fit',
        start: Math.max(0, parseFloat(startInput.value) || 0),
      };
      const r = await convertToGif(bytes, { ...opts, onStatus: setStatus });
      showResult(r, { name, source: bytes, opts });
    } catch (err) {
      console.error(err);
      showError(err.message || t('errGeneric'));
    } finally {
      setLoading(false);
    }
  });

  // Kullanıcı bir şey seçer seçmez dönüştürücüyü arka planda yüklemeye başla
  const warmUp = () => loadFFmpeg().catch(() => {});
  fileInput.addEventListener('change', warmUp, { once: true });
  drop.addEventListener('drop', warmUp, { once: true });
  urlInput.addEventListener('input', warmUp, { once: true });
  document.addEventListener('paste', warmUp, { once: true });

  // WhatsApp'ın kendi özelliği: sohbetteki GIF'ten animasyonlu çıkartma oluşturma (adımlar i18n.js'te)
  const STEP_KEYS = { android: 'stepsAndroid', ios: 'stepsIos', desktop: 'stepsDesktop' };

  function showResult(r, meta) {
    if (current) URL.revokeObjectURL(current.url);
    const blob = new Blob([r.data], { type: 'image/gif' });
    const fileName = `${safeName(meta.name)}.gif`;
    const gif = new File([blob], fileName, { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    current = { gif, url, name: meta.name, source: meta.source, opts: meta.opts };

    previewImg.src = url;
    chatImg.src = url;
    gifDownloadBtn.href = url;
    gifDownloadBtn.download = fileName;
    current.result = r;
    current.canSend = platform !== 'desktop' && !!(navigator.canShare && navigator.canShare({ files: [gif] }));
    sendBtn.hidden = !current.canSend;
    gifDownloadBtn.hidden = current.canSend;
    renderResultText();

    webpBtn.disabled = false;
    webpBtn.textContent = t('webpDownload');
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderResultText() {
    if (!current || !current.result) return;
    const r = current.result;
    stats.innerHTML = [
      r.animated ? `<li class="ok">${t('statAnimated', r.duration.toFixed(1))}</li>` : `<li>${t('statStatic')}</li>`,
      `<li><b>${formatBytes(r.bytes)}</b></li>`,
    ].join('');
    const steps = t(STEP_KEYS[current.canSend ? platform : 'desktop']);
    stepsEl.innerHTML = steps.map((x) => `<li><span>${x}</span></li>`).join('');
  }

  sendBtn.addEventListener('click', async () => {
    if (!current) return;
    try {
      await navigator.share({ files: [current.gif] });
    } catch (err) {
      if (err && err.name === 'AbortError') return; // kullanıcı vazgeçti
      // Paylaşım açılamazsa indirmeye düş
      gifDownloadBtn.hidden = false;
      showError(t('errShareFailed'));
    }
  });

  webpBtn.addEventListener('click', async () => {
    if (!current) return;
    webpBtn.disabled = true;
    try {
      const r = await convertToSticker(current.source, {
        ...current.opts,
        onStatus: (t) => (webpBtn.textContent = t),
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([r.data], { type: 'image/webp' }));
      a.download = `${safeName(current.name)}.webp`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      webpBtn.textContent = t('webpDone');
    } catch (err) {
      showError(err.message || t('errWebp'));
      webpBtn.textContent = t('webpDownload');
      webpBtn.disabled = false;
    }
  });

  // ---------- Yardımcılar ----------
  function setLoading(on) {
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    setStatus(on ? t('preparing') : t('prepare'));
  }
  function setStatus(text) { btn.querySelector('.btn-label').textContent = text; }
  function showError(msg) { errorBox.textContent = msg; errorBox.hidden = false; }
  function hideError() { errorBox.hidden = true; }
  function formatBytes(n) { return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`; }
  function safeName(s) { return (s || 'sticker').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'sticker'; }

  setLang(detectLang());
  applyI18n();
}
