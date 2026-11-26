// Sürüm etiketi yayın sırasında commit kimliğiyle değiştirilir (önbellek kırma) — bkz. .github/workflows/pages.yml
import { convertToGif, convertToSticker, loadFFmpeg } from './converter.js?v=__V__';
import { fetchMedia, looksLikeMedia } from './links.js?v=__V__';

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
  if (verEl) verEl.textContent = `sürüm ${VERSION.slice(0, 7)}`;

  let mode = 'upload';
  let selectedFile = null;
  let current = null; // { gif: File, url, name, source: Uint8Array, opts }
  const ua = navigator.userAgent;
  const platform = /android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'desktop';

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
    if (f.size > 25 * 1024 * 1024) return showError('Dosya çok büyük (en fazla 25 MB).');
    selectedFile = f;
    dropFile.textContent = `${f.name || 'yapıştırılan görsel'} · ${formatBytes(f.size)}`;
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
        if (!selectedFile) throw new Error('Önce bir GIF seç ya da sürükle.');
        bytes = new Uint8Array(await selectedFile.arrayBuffer());
        if (!looksLikeMedia(selectedFile.type, bytes)) throw new Error('Bu dosya bir GIF/görsel/video değil.');
        name = (selectedFile.name || 'sticker').replace(/\.[^.]+$/, '') || 'sticker';
      } else {
        // Paylaşım metni yapıştırıldıysa içindeki ilk linki al
        const found = urlInput.value.match(/https?:\/\/[^\s<>"']+/i);
        if (!found) throw new Error('Geçerli bir link gir (https:// ile başlamalı).');
        const u = found[0];
        setStatus('GIF indiriliyor…');
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
      showError(err.message || 'Bir şeyler ters gitti.');
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

  // WhatsApp'ın kendi özelliği: sohbetteki GIF'ten animasyonlu çıkartma oluşturma
  const STEPS = {
    android: [
      `<b>WhatsApp'a gönder</b>'e bas, bir sohbet seç <span class="sub">Kendine de gönderebilirsin (en üstteki "Siz" sohbeti).</span>`,
      `Sohbette GIF'e <b>dokun</b> → sağ üstte <b>⋮</b> → <b>Çıkartma oluştur</b> ✓ <span class="sub">Çıkartma gönderilir ve çıkartma panelinde kalır; bir daha yapman gerekmez.</span>`,
    ],
    ios: [
      `<b>WhatsApp'a gönder</b>'e bas, bir sohbet seç <span class="sub">Kendine de gönderebilirsin.</span>`,
      `Sohbette GIF'e <b>basılı tut</b> → <b>Kopyala</b> → mesaj kutusuna <b>yapıştır</b> → <b>Gönder</b> ✓ <span class="sub">Çıkartma olarak gider; çıkartmaya basılı tutup <b>Favorilere ekle</b>.</span>`,
    ],
    desktop: [
      `<b>GIF'i indir</b> ve <a href="https://web.whatsapp.com" target="_blank" rel="noopener">WhatsApp Web</a>'de kendine gönder <span class="sub">Ya da bu siteyi telefonunda aç — tek dokunuşla gönderilir.</span>`,
      `Telefonda GIF'e <b>dokun</b> → <b>⋮</b> → <b>Çıkartma oluştur</b> ✓ <span class="sub">iPhone'da: GIF'e basılı tut → Kopyala → mesaj kutusuna yapıştır → Gönder.</span>`,
    ],
  };

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
    stats.innerHTML = [
      r.animated ? `<li class="ok">✓ Animasyonlu · <b>${r.duration.toFixed(1)} sn</b></li>` : '<li>Sabit görsel</li>',
      `<li><b>${formatBytes(r.bytes)}</b></li>`,
    ].join('');

    const canSend = platform !== 'desktop' && !!(navigator.canShare && navigator.canShare({ files: [gif] }));
    sendBtn.hidden = !canSend;
    gifDownloadBtn.hidden = canSend;
    stepsEl.innerHTML = STEPS[canSend ? platform : 'desktop'].map((t) => `<li><span>${t}</span></li>`).join('');

    webpBtn.disabled = false;
    webpBtn.textContent = '⬇ WebP çıkartma dosyası indir';
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  sendBtn.addEventListener('click', async () => {
    if (!current) return;
    try {
      await navigator.share({ files: [current.gif] });
    } catch (err) {
      if (err && err.name === 'AbortError') return; // kullanıcı vazgeçti
      // Paylaşım açılamazsa indirmeye düş
      gifDownloadBtn.hidden = false;
      showError('Paylaşım ekranı açılamadı. GIF\'i indirip WhatsApp\'tan gönderebilirsin.');
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
      webpBtn.textContent = '✓ WebP indirildi';
    } catch (err) {
      showError(err.message || 'WebP oluşturulamadı.');
      webpBtn.textContent = '⬇ WebP çıkartma dosyası indir';
      webpBtn.disabled = false;
    }
  });

  // ---------- Yardımcılar ----------
  function setLoading(on) {
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    setStatus(on ? 'Hazırlanıyor…' : 'Hazırla');
  }
  function setStatus(text) { btn.querySelector('.btn-label').textContent = text; }
  function showError(msg) { errorBox.textContent = msg; errorBox.hidden = false; }
  function hideError() { errorBox.hidden = true; }
  function formatBytes(n) { return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`; }
  function safeName(s) { return (s || 'sticker').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'sticker'; }
}
