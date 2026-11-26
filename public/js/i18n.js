// Basit çeviri sistemi (Türkçe / English).
// Dil seçimi: kullanıcının daha önce seçtiği dil > sistem dili Türkçe ise 'tr' > diğer her durumda 'en'.

export const SITE_NAME = 'Sticker Maker';
export const SITE_URL = 'https://nolarth.github.io/sticker-maker/';
export const LANGS = ['tr', 'en'];
const STORAGE_KEY = 'lang';

const dict = {
  tr: {
    title: `${SITE_NAME} — GIF'i WhatsApp Çıkartmasına Çevir (X, Giphy) · Ücretsiz`,
    metaDesc: "X (Twitter), Giphy veya kendi GIF'ini saniyeler içinde animasyonlu WhatsApp çıkartmasına dönüştür. Ücretsiz, uygulama ve kayıt yok; dosyaların tarayıcında kalır.",
    themeToggle: 'Temayı değiştir',
    langToggle: 'Switch to English',
    heroTitle: "GIF'ini <span class=\"hl\">WhatsApp çıkartmasına</span> çevir",
    heroText: "X/Giphy linkini yapıştır ya da dosyanı seç → <b>WhatsApp'a gönder</b> → WhatsApp'ta GIF'e dokun → <b>⋮</b> → <b>Çıkartma oluştur</b>. Uygulama kurmak yok.",
    converterLabel: 'Dönüştürücü',
    tabUpload: '📁 Dosya yükle',
    tabLink: '🔗 Link gir',
    dropTitle: "GIF'i buraya sürükle ya da <u>seç</u>",
    dropSub: 'GIF, MP4, WebM, PNG, JPG · en fazla 25 MB · Ctrl+V ile yapıştırabilirsin',
    linkLabel: 'GIF linki',
    linkPlaceholder: 'https://x.com/…/status/…  ya da  https://giphy.com/gifs/…',
    linkHint: "<b>X (Twitter)</b> gönderi linkleri, Giphy linkleri ve doğrudan <code>.gif</code> linkleri çalışır. Tenor ve diğer sitelerde GIF'e sağ tıklayıp <i>Resim adresini kopyala</i> ile alınan linki yapıştır.",
    settings: 'Ayarlar',
    layout: 'Yerleşim',
    fitFit: 'Sığdır',
    fitCrop: 'Kırp',
    fitStretch: 'Uzat',
    startSec: 'Başlangıç (sn)',
    settingsHint: "Çıkartmalar en fazla 10 saniye olabilir; uzun GIF'ler başlangıçtan itibaren 10 sn'ye kırpılır.",
    prepare: 'Hazırla',
    preparing: 'Hazırlanıyor…',
    previewAlt: 'Çıkartma önizlemesi',
    chatNow: 'şimdi ✓✓',
    ready: 'Hazır 🎉',
    send: "WhatsApp'a gönder",
    downloadGif: "⬇ GIF'i indir",
    more: 'Diğer seçenekler',
    moreHint: 'Çıkartma dosyasını (512×512 WebP, şeffaf arka plan) doğrudan istersen — örneğin bir çıkartma uygulamasında kullanmak için:',
    webpDownload: '⬇ WebP çıkartma dosyası indir',
    webpDone: '✓ WebP indirildi',
    spec1: 'Link yapıştır ya da GIF seç',
    spec2: "WhatsApp'a gönder",
    spec3: "GIF'e dokun → ⋮ → Çıkartma oluştur",
    footer: 'Dönüştürme tamamen tarayıcında yapılır — dosyaların hiçbir sunucuya yüklenmez.<br />İlk kullanımda dönüştürücü (~30 MB) bir kez indirilir.',
    version: (v) => `sürüm ${v}`,
    stepsAndroid: [
      "<b>WhatsApp'a gönder</b>'e bas, bir sohbet seç <span class=\"sub\">Kendine de gönderebilirsin (en üstteki \"Siz\" sohbeti).</span>",
      "Sohbette GIF'e <b>dokun</b> → sağ üstte <b>⋮</b> → <b>Çıkartma oluştur</b> ✓ <span class=\"sub\">Çıkartma gönderilir ve çıkartma panelinde kalır; bir daha yapman gerekmez.</span>",
    ],
    stepsIos: [
      "<b>WhatsApp'a gönder</b>'e bas, bir sohbet seç <span class=\"sub\">Kendine de gönderebilirsin.</span>",
      "Sohbette GIF'e <b>basılı tut</b> → <b>Kopyala</b> → mesaj kutusuna <b>yapıştır</b> → <b>Gönder</b> ✓ <span class=\"sub\">Çıkartma olarak gider; çıkartmaya basılı tutup <b>Favorilere ekle</b>.</span>",
    ],
    stepsDesktop: [
      "<b>GIF'i indir</b> ve <a href=\"https://web.whatsapp.com\" target=\"_blank\" rel=\"noopener\">WhatsApp Web</a>'de kendine gönder <span class=\"sub\">Ya da bu siteyi telefonunda aç — tek dokunuşla gönderilir.</span>",
      "Telefonda GIF'e <b>dokun</b> → <b>⋮</b> → <b>Çıkartma oluştur</b> ✓ <span class=\"sub\">iPhone'da: GIF'e basılı tut → Kopyala → mesaj kutusuna yapıştır → Gönder.</span>",
    ],
    statAnimated: (d) => `✓ Animasyonlu · <b>${d} sn</b>`,
    statStatic: 'Sabit görsel',
    pastedImage: 'yapıştırılan görsel',
    // app
    errTooBig: 'Dosya çok büyük (en fazla 25 MB).',
    errPickFirst: 'Önce bir GIF seç ya da sürükle.',
    errNotMedia: 'Bu dosya bir GIF/görsel/video değil.',
    errEnterLink: 'Geçerli bir link gir (https:// ile başlamalı).',
    errGeneric: 'Bir şeyler ters gitti.',
    errShareFailed: "Paylaşım ekranı açılamadı. GIF'i indirip WhatsApp'tan gönderebilirsin.",
    errWebp: 'WebP oluşturulamadı.',
    stDownloading: 'GIF indiriliyor…',
    // converter
    stLoading: 'Dönüştürücü yükleniyor (ilk seferde ~30 MB)…',
    stInspecting: 'GIF inceleniyor…',
    stGif: 'GIF hazırlanıyor…',
    stGifShrink: (n) => `GIF küçültülüyor (deneme ${n})…`,
    stConverting: 'Dönüştürülüyor…',
    stConvertingTry: (n, fps, q) => `Dönüştürülüyor… (deneme ${n}: ${fps} fps, kalite ${q})`,
    stShorten: (d) => `Sığdırmak için süre kısaltılıyor (${d} sn)…`,
    errTimeout: 'Dönüştürme zaman aşımına uğradı.',
    errNoVideo: 'Dosyada görüntü bulunamadı.',
    errTooLarge: (limit, smallest) => `Çıkartma WhatsApp sınırına (${limit} KB) sığdırılamadı (en küçük: ${smallest} KB). Daha kısa bir GIF dene.`,
    // links
    errBadUrl: 'Geçersiz link.',
    errProtocol: 'Yalnızca http/https linkleri desteklenir.',
    errNoMediaInTweet: 'Bu gönderide GIF, video veya fotoğraf yok.',
    errPrivate: 'Bu gönderi gizli veya yaş kısıtlamalı; medyasına erişilemiyor.',
    errNotFound: 'Gönderi bulunamadı (silinmiş olabilir).',
    errXRead: "X gönderisi okunamadı (adım 1/2: gönderi bilgisi). Biraz sonra tekrar dene ya da GIF'i indirip dosya olarak yükle.",
    errBlocked: 'Bu site doğrudan indirmeye izin vermiyor. GIF\'i bilgisayarına indirip "Dosya yükle" sekmesinden yükle.',
    errHttp: (s) => `Link açılamadı (HTTP ${s}).`,
    errShortLink: 'Bu bir X kısa linki. Gönderiyi açıp "Paylaş → Bağlantıyı kopyala" ile x.com/…/status/… linkini yapıştır.',
    errXMedia: 'X medyası indirilemedi (adım 2/2: video dosyası). GIF\'i X\'ten indirip "Dosya yükle" sekmesinden yükle.',
    errXNotMedia: "X'ten gelen dosya bir GIF/video değil.",
    errTenor: 'Tenor sayfa linkleri doğrudan açılamıyor. GIF\'e sağ tıklayıp "Resim adresini kopyala" ile media.tenor.com linkini yapıştır.',
    errPageLink: 'Bu bir sayfa linki, GIF değil. GIF\'e sağ tıklayıp "Resim adresini kopyala" ile doğrudan linki yapıştır.',
    errNotGif: 'Link bir GIF/görsel değil.',
    detail: 'Ayrıntı',
    faqTitle: 'Sık sorulan sorular',
    faq1q: "GIF'ten WhatsApp çıkartması nasıl yapılır?",
    faq1a: "Linki yapıştır ya da dosyanı seç ve <b>Hazırla</b>'ya bas. <b>WhatsApp'a gönder</b> ile bir sohbete (kendine de olur) gönder. Android'de GIF'e dokun → <b>⋮</b> → <b>Çıkartma oluştur</b>; iPhone'da GIF'e basılı tut → <b>Kopyala</b> → mesaj kutusuna yapıştır → <b>Gönder</b>.",
    faq2q: 'X (Twitter) GIF\'leri çalışıyor mu?',
    faq2a: "Evet. Gönderinin linkini (<code>x.com/…/status/…</code>) yapıştırman yeterli; GIF otomatik bulunur. Giphy linkleri ve doğrudan <code>.gif</code> linkleri de çalışır.",
    faq3q: 'Dosyalarım bir sunucuya yükleniyor mu?',
    faq3a: 'Hayır. Dönüştürme tamamen tarayıcında yapılır; dosyaların cihazından çıkmaz.',
    faq4q: 'Neden doğrudan çıkartma olarak gönderilmiyor?',
    faq4a: "Web siteleri WhatsApp'a doğrudan çıkartma ekleyemez; tarayıcıdan paylaşılan dosyalar resim ya da GIF olarak gider. GIF olarak gönderip WhatsApp'ın kendi <b>Çıkartma oluştur</b> özelliğini kullanmak en kısa yol. Çıkartma bir kez oluşunca çıkartma panelinde kalır.",
    faq5q: 'Ücretli mi, uygulama kurmam gerekiyor mu?',
    faq5a: 'Tamamen ücretsiz; kayıt ya da uygulama gerekmez. Telefonda ve bilgisayarda çalışır.',
    faq6q: 'Hangi dosyalar destekleniyor?',
    faq6a: 'GIF, MP4, WebM, PNG ve JPG (en fazla 25 MB). Çıkartmalar en fazla 10 saniye olabilir; uzun GIF\'ler kırpılır. İstersen 512×512 şeffaf WebP çıkartma dosyası da indirebilirsin.',
    noscript: 'Bu site JavaScript gerektirir.',
  },

  en: {
    title: `${SITE_NAME} — GIF to WhatsApp Sticker Converter (X, Giphy) · Free`,
    metaDesc: 'Turn X (Twitter), Giphy or your own GIFs into animated WhatsApp stickers in seconds. Free, no app or sign-up — your files stay in your browser.',
    themeToggle: 'Toggle theme',
    langToggle: "Türkçe'ye geç",
    heroTitle: 'Turn your GIF into a <span class="hl">WhatsApp sticker</span>',
    heroText: 'Paste an X/Giphy link or pick a file → <b>Send to WhatsApp</b> → in WhatsApp tap the GIF → <b>⋮</b> → <b>Create sticker</b>. No app to install.',
    converterLabel: 'Converter',
    tabUpload: '📁 Upload file',
    tabLink: '🔗 Paste link',
    dropTitle: 'Drag your GIF here or <u>browse</u>',
    dropSub: 'GIF, MP4, WebM, PNG, JPG · up to 25 MB · you can also paste with Ctrl+V',
    linkLabel: 'GIF link',
    linkPlaceholder: 'https://x.com/…/status/…  or  https://giphy.com/gifs/…',
    linkHint: '<b>X (Twitter)</b> post links, Giphy links and direct <code>.gif</code> links work. For Tenor and other sites, right-click the GIF and use <i>Copy image address</i>.',
    settings: 'Settings',
    layout: 'Layout',
    fitFit: 'Fit',
    fitCrop: 'Crop',
    fitStretch: 'Stretch',
    startSec: 'Start (sec)',
    settingsHint: 'Stickers can be at most 10 seconds long; longer GIFs are trimmed to 10 s from the start time.',
    prepare: 'Make sticker',
    preparing: 'Preparing…',
    previewAlt: 'Sticker preview',
    chatNow: 'now ✓✓',
    ready: 'Ready 🎉',
    send: 'Send to WhatsApp',
    downloadGif: '⬇ Download GIF',
    more: 'More options',
    moreHint: 'Want the sticker file itself (512×512 WebP, transparent background) — e.g. for a sticker app?',
    webpDownload: '⬇ Download WebP sticker file',
    webpDone: '✓ WebP downloaded',
    spec1: 'Paste a link or pick a GIF',
    spec2: 'Send to WhatsApp',
    spec3: 'Tap the GIF → ⋮ → Create sticker',
    footer: 'Everything runs in your browser — your files are never uploaded to a server.<br />The converter (~30 MB) is downloaded once on first use.',
    version: (v) => `version ${v}`,
    stepsAndroid: [
      'Tap <b>Send to WhatsApp</b> and pick a chat <span class="sub">You can send it to yourself (the "You" chat at the top).</span>',
      'In the chat, <b>tap</b> the GIF → <b>⋮</b> (top right) → <b>Create sticker</b> ✓ <span class="sub">The sticker is sent and stays in your sticker panel — you only do this once.</span>',
    ],
    stepsIos: [
      'Tap <b>Send to WhatsApp</b> and pick a chat <span class="sub">You can send it to yourself.</span>',
      'In the chat, <b>long-press</b> the GIF → <b>Copy</b> → <b>paste</b> into the message box → <b>Send</b> ✓ <span class="sub">It goes out as a sticker; long-press it and tap <b>Add to Favorites</b>.</span>',
    ],
    stepsDesktop: [
      '<b>Download the GIF</b> and send it to yourself on <a href="https://web.whatsapp.com" target="_blank" rel="noopener">WhatsApp Web</a> <span class="sub">Or open this site on your phone — it sends with one tap.</span>',
      'On your phone, <b>tap</b> the GIF → <b>⋮</b> → <b>Create sticker</b> ✓ <span class="sub">On iPhone: long-press the GIF → Copy → paste into the message box → Send.</span>',
    ],
    statAnimated: (d) => `✓ Animated · <b>${d} s</b>`,
    statStatic: 'Still image',
    pastedImage: 'pasted image',
    errTooBig: 'File is too large (max 25 MB).',
    errPickFirst: 'Pick or drop a GIF first.',
    errNotMedia: 'This file is not a GIF/image/video.',
    errEnterLink: 'Enter a valid link (starting with https://).',
    errGeneric: 'Something went wrong.',
    errShareFailed: "Couldn't open the share sheet. Download the GIF and send it from WhatsApp.",
    errWebp: "Couldn't create the WebP.",
    stDownloading: 'Downloading GIF…',
    stLoading: 'Loading converter (~30 MB, first time only)…',
    stInspecting: 'Analyzing GIF…',
    stGif: 'Preparing GIF…',
    stGifShrink: (n) => `Shrinking GIF (attempt ${n})…`,
    stConverting: 'Converting…',
    stConvertingTry: (n, fps, q) => `Converting… (attempt ${n}: ${fps} fps, quality ${q})`,
    stShorten: (d) => `Shortening to fit (${d} s)…`,
    errTimeout: 'Conversion timed out.',
    errNoVideo: 'No image found in the file.',
    errTooLarge: (limit, smallest) => `Couldn't fit the sticker within WhatsApp's limit (${limit} KB; smallest: ${smallest} KB). Try a shorter GIF.`,
    errBadUrl: 'Invalid link.',
    errProtocol: 'Only http/https links are supported.',
    errNoMediaInTweet: 'This post has no GIF, video or photo.',
    errPrivate: 'This post is private or age-restricted; its media is not accessible.',
    errNotFound: 'Post not found (it may have been deleted).',
    errXRead: "Couldn't read the X post (step 1/2: post info). Try again in a moment, or download the GIF and upload it as a file.",
    errBlocked: "This site doesn't allow direct downloads. Download the GIF to your device and upload it in the \"Upload file\" tab.",
    errHttp: (s) => `Couldn't open the link (HTTP ${s}).`,
    errShortLink: 'This is an X short link. Open the post and use "Share → Copy link" to get the x.com/…/status/… link.',
    errXMedia: "Couldn't download the X media (step 2/2: video file). Download the GIF from X and upload it in the \"Upload file\" tab.",
    errXNotMedia: 'The file from X is not a GIF/video.',
    errTenor: "Tenor page links can't be opened directly. Right-click the GIF and use \"Copy image address\" to get the media.tenor.com link.",
    errPageLink: 'This is a page link, not a GIF. Right-click the GIF and use "Copy image address" to paste the direct link.',
    errNotGif: 'The link is not a GIF/image.',
    detail: 'Details',
    faqTitle: 'Frequently asked questions',
    faq1q: 'How do I make a WhatsApp sticker from a GIF?',
    faq1a: 'Paste a link or pick a file and tap <b>Make sticker</b>. Use <b>Send to WhatsApp</b> to send it to any chat (yourself works too). On Android, tap the GIF → <b>⋮</b> → <b>Create sticker</b>; on iPhone, long-press the GIF → <b>Copy</b> → paste into the message box → <b>Send</b>.',
    faq2q: 'Does it work with X (Twitter) GIFs?',
    faq2a: 'Yes. Just paste the post link (<code>x.com/…/status/…</code>) and the GIF is found automatically. Giphy links and direct <code>.gif</code> links work too.',
    faq3q: 'Are my files uploaded to a server?',
    faq3a: 'No. Everything is converted in your browser; your files never leave your device.',
    faq4q: "Why isn't it sent directly as a sticker?",
    faq4a: "Websites can't add stickers to WhatsApp directly; files shared from a browser arrive as images or GIFs. Sending it as a GIF and using WhatsApp's own <b>Create sticker</b> option is the shortest path. Once created, the sticker stays in your sticker panel.",
    faq5q: 'Is it free? Do I need to install an app?',
    faq5a: 'Completely free — no sign-up and no app. Works on phones and computers.',
    faq6q: 'Which files are supported?',
    faq6a: "GIF, MP4, WebM, PNG and JPG (up to 25 MB). Stickers can be at most 10 seconds; longer GIFs are trimmed. You can also download a 512×512 transparent WebP sticker file.",
    noscript: 'This site requires JavaScript.',
  },
};

let lang = 'tr';

export function getLang() {
  return lang;
}

export function setLang(l) {
  lang = LANGS.includes(l) ? l : 'en';
}

/** Adresteki ?lang= > kayıtlı tercih > sistem dili Türkçe ise 'tr' > 'en' */
export function detectLang(nav = globalThis.navigator, storage = safeStorage(), search = globalThis.location ? globalThis.location.search : '') {
  const fromUrl = new URLSearchParams(search || '').get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;
  const saved = storage && storage.get();
  if (LANGS.includes(saved)) return saved;
  const prefs = (nav && (nav.languages && nav.languages.length ? nav.languages : [nav.language])) || [];
  const primary = String(prefs[0] || '').toLowerCase();
  return primary === 'tr' || primary.startsWith('tr-') ? 'tr' : 'en';
}

export function saveLang(l) {
  const s = safeStorage();
  if (s) s.set(l);
}

function safeStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    return { get: () => ls.getItem(STORAGE_KEY), set: (v) => ls.setItem(STORAGE_KEY, v) };
  } catch {
    return null;
  }
}

/** Çeviri: t('key') ya da t('key', ...args) (parametreli metinler için) */
export function t(key, ...args) {
  const v = (dict[lang] && dict[lang][key]) ?? dict.tr[key];
  if (v === undefined) return key;
  return typeof v === 'function' ? v(...args) : v;
}

export { dict };
