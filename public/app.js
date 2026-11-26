(function () {
  'use strict';

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
  const downloadBtn = $('#downloadBtn');
  const shareBtn = $('#shareBtn');
  const addPackBtn = $('#addPackBtn');

  let mode = 'upload';
  let selectedFile = null;
  let current = null; // { blob, url, name, animated }
  const pack = []; // { blob, url, name }

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

    const fd = new FormData();
    if (mode === 'upload') {
      if (!selectedFile) return showError('Önce bir GIF seç ya da sürükle.');
      fd.append('file', selectedFile, selectedFile.name || 'paste.gif');
    } else {
      const u = urlInput.value.trim();
      if (!/^https?:\/\/\S+$/i.test(u)) return showError('Geçerli bir link gir (https:// ile başlamalı).');
      fd.append('url', u);
    }
    fd.append('fit', (form.querySelector('input[name="fit"]:checked') || {}).value || 'fit');
    fd.append('start', String(Math.max(0, parseFloat(startInput.value) || 0)));

    setLoading(true);
    try {
      const res = await fetch('/api/convert', { method: 'POST', body: fd });
      if (!res.ok) {
        let msg = 'Bir şeyler ters gitti.';
        try { msg = (await res.json()).error || msg; } catch { /* yoksay */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const h = (k) => res.headers.get(k);
      const name = decodeURIComponent(h('X-Sticker-Name') || 'sticker') || 'sticker';
      showResult(blob, {
        name,
        animated: h('X-Sticker-Animated') === 'true',
        bytes: Number(h('X-Sticker-Bytes')) || blob.size,
        fps: h('X-Sticker-Fps'),
        quality: h('X-Sticker-Quality'),
        duration: Number(h('X-Sticker-Duration')) || 0,
      });
    } catch (err) {
      showError(err.message || 'Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  });

  function showResult(blob, meta) {
    if (current && !pack.some((p) => p.url === current.url)) URL.revokeObjectURL(current.url);
    const url = URL.createObjectURL(blob);
    current = { blob, url, name: meta.name, animated: meta.animated };
    previewImg.src = url;
    chatImg.src = url;
    downloadBtn.href = url;
    downloadBtn.download = `${safeName(meta.name)}.webp`;

    const limit = meta.animated ? 500 : 100;
    const items = [
      `<li class="ok">✓ WhatsApp uyumlu</li>`,
      `<li><b>512×512</b></li>`,
      `<li><b>${formatBytes(meta.bytes)}</b> / ${limit} KB</li>`,
      meta.animated ? `<li>Animasyonlu · <b>${meta.duration.toFixed(1)} sn</b></li>` : `<li>Sabit görsel</li>`,
      meta.animated && meta.fps ? `<li><b>${meta.fps}</b> fps</li>` : '',
      `<li>Kalite <b>${meta.quality}</b></li>`,
    ];
    stats.innerHTML = items.join('');

    const file = new File([blob], `${safeName(meta.name)}.webp`, { type: 'image/webp' });
    shareBtn.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    shareBtn.onclick = () => navigator.share({ files: [file] }).catch(() => {});

    addPackBtn.disabled = false;
    addPackBtn.textContent = '＋ Pakete ekle';
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Paket ----------
  const packSection = $('#pack');
  const packGrid = $('#packGrid');
  const packCount = $('#packCount');
  const packHint = $('#packHint');
  const downloadPackBtn = $('#downloadPack');

  addPackBtn.addEventListener('click', () => {
    if (!current) return;
    if (pack.length >= 30) return showError('Bir paket en fazla 30 çıkartma içerebilir.');
    if (pack.some((p) => p.url === current.url)) return;
    pack.push({ blob: current.blob, url: current.url, name: current.name });
    addPackBtn.disabled = true;
    addPackBtn.textContent = '✓ Pakete eklendi';
    renderPack();
  });

  $('#clearPack').addEventListener('click', () => {
    pack.splice(0).forEach((p) => { if (!current || p.url !== current.url) URL.revokeObjectURL(p.url); });
    if (current) { addPackBtn.disabled = false; addPackBtn.textContent = '＋ Pakete ekle'; }
    renderPack();
  });

  function renderPack() {
    packSection.hidden = pack.length === 0;
    packCount.textContent = String(pack.length);
    packGrid.innerHTML = '';
    pack.forEach((p, i) => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = p.url;
      img.alt = p.name;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '×';
      rm.setAttribute('aria-label', 'Paketten çıkar');
      rm.onclick = () => {
        const [removed] = pack.splice(i, 1);
        if (current && removed.url === current.url) { addPackBtn.disabled = false; addPackBtn.textContent = '＋ Pakete ekle'; }
        else URL.revokeObjectURL(removed.url);
        renderPack();
      };
      li.append(img, rm);
      packGrid.append(li);
    });
    const need = 3 - pack.length;
    downloadPackBtn.disabled = need > 0;
    packHint.textContent = need > 0
      ? `WhatsApp bir pakette en az 3 çıkartma ister — ${need} tane daha ekle.`
      : 'Hazır! .wastickers dosyasını Android\'de bir çıkartma paketi uygulamasıyla açıp WhatsApp\'a ekleyebilirsin.';
  }

  downloadPackBtn.addEventListener('click', async () => {
    if (pack.length < 3) return;
    downloadPackBtn.disabled = true;
    try {
      const files = [];
      const title = $('#packName').value.trim() || 'Çıkartmalarım';
      const author = $('#packAuthor').value.trim() || 'StikerYap';
      const enc = new TextEncoder();
      files.push({ name: 'title.txt', data: enc.encode(title) });
      files.push({ name: 'author.txt', data: enc.encode(author) });
      files.push({ name: 'tray.png', data: await makeTray(pack[0].url) });
      for (let i = 0; i < pack.length; i++) {
        files.push({ name: `${String(i + 1).padStart(2, '0')}.webp`, data: new Uint8Array(await pack[i].blob.arrayBuffer()) });
      }
      const zip = window.makeZip(files);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zip);
      a.download = `${safeName(title)}.wastickers`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (err) {
      showError('Paket oluşturulamadı: ' + err.message);
    } finally {
      downloadPackBtn.disabled = pack.length < 3;
    }
  });

  // Paket simgesi: 96x96 PNG
  function makeTray(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 96;
        c.getContext('2d').drawImage(img, 0, 0, 96, 96);
        c.toBlob(async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error('simge'))), 'image/png');
      };
      img.onerror = () => reject(new Error('simge oluşturulamadı'));
      img.src = src;
    });
  }

  // ---------- Yardımcılar ----------
  function setLoading(on) {
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    btn.querySelector('.btn-label').textContent = on ? 'Dönüştürülüyor…' : 'Çıkartmaya dönüştür';
  }
  function showError(msg) { errorBox.textContent = msg; errorBox.hidden = false; }
  function hideError() { errorBox.hidden = true; }
  function formatBytes(n) { return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`; }
  function safeName(s) { return (s || 'sticker').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'sticker'; }
})();
