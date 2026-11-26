# StikerYap — GIF → WhatsApp Çıkartma

GIF'leri **link girerek** ya da **dosya yükleyerek** WhatsApp çıkartmasına dönüştüren web sitesi.
Dönüştürme tamamen **tarayıcıda** ([ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)) yapılır; sunucu gerekmez, site **GitHub Pages**'te çalışır ve dosyalar hiçbir yere yüklenmez.

## Özellikler

- **Dosya yükleme:** sürükle-bırak, dosya seçici veya **Ctrl+V** ile yapıştırma (GIF, MP4, WebM, PNG, JPG — en fazla 25 MB)
- **Link ile:** **X (Twitter)** gönderi linkleri (`x.com/.../status/...`, `/video/2` gibi sıra seçimi dahil), Giphy sayfa/medya linkleri ve doğrudan `.gif` linkleri (Tenor dahil, sitenin indirmeye izin vermesi gerekir — aşağıya bak)
- **WhatsApp kurallarına otomatik uyum:**
  - 512×512 kare tuval (Sığdır = şeffaf dolgu / Kırp / Uzat)
  - Animasyonlu WebP, sonsuz döngü, en fazla 10 sn (başlangıç saniyesi seçilebilir)
  - Animasyonlu ≤ 500 KB, sabit ≤ 100 KB — sığana kadar FPS ve kalite kademeli düşürülür
- **Önizleme:** şeffaflık ızgarası + WhatsApp sohbet balonu görünümü
- **Paylaş:** mobilde Web Share API ile doğrudan WhatsApp'a gönderme
- **Paket:** 3–30 çıkartmayı toplayıp `.wastickers` dosyası olarak indirme (96×96 paket simgesi otomatik)
- Açık/koyu tema, mobil uyumlu, Türkçe arayüz

## GitHub Pages'te yayınlama

1. Depoda **Settings → Pages → Build and deployment → Source** ayarını **GitHub Actions** yap.
2. Varsayılan dala push et (veya **Actions → GitHub Pages'e yayınla → Run workflow**).
3. Site `https://<kullanıcı-adı>.github.io/sticker-maker/` adresinde yayına girer.

İş akışı (`.github/workflows/pages.yml`) önce testleri çalıştırır, sonra `public/` klasörünü yayınlar. Derleme adımı yoktur.

## Yerelde çalıştırma

```bash
npm start          # http://localhost:8080 (bağımlılıksız statik sunucu)
npm test           # birim testleri
npm install && npm run test:e2e   # uçtan uca: gerçek GIF'leri tarayıcıda dönüştürür (playwright + ffmpeg gerekir)
```

## Bilinen sınırlar

- **İlk kullanımda ~30 MB** dönüştürücü indirilir (jsDelivr CDN'den, sonra tarayıcı önbelleğinde kalır).
- Tarayıcıda dönüştürme sunucuya göre yavaştır: kısa bir GIF birkaç saniye, 10 sn'lik büyük bir GIF 15–30 sn sürebilir.
- **Link ile indirme** yalnızca CORS'a izin veren sitelerde çalışır (Giphy, Tenor medya linkleri vb.). İzin vermeyen sitelerde GIF'i indirip dosya olarak yükle. Tenor **sayfa** linkleri (`tenor.com/view/...`) çalışmaz; GIF'e sağ tıklayıp *Resim adresini kopyala* ile `media.tenor.com/...gif` linkini kullan.
- **X linkleri** herkese açık [FxTwitter](https://github.com/FxEmbed/FxEmbed) API'si (yedek: VxTwitter) üzerinden çözülür; bu servisler kapalıysa X linkleri çalışmaz. Gizli/yaş kısıtlamalı gönderiler desteklenmez. X'teki GIF'ler aslında MP4'tür ve doğrudan `video.twimg.com`'dan indirilir.
- Animasyonlu **WebP** girdi desteklenmez (ffmpeg okuyamıyor).

## Yapı

| Dosya | Görev |
|---|---|
| `public/index.html`, `style.css` | Arayüz |
| `public/js/app.js` | Arayüz mantığı, paket, paylaşma |
| `public/js/converter.js` | ffmpeg.wasm ile WebP üretimi ve boyut sınırına sığdırma |
| `public/js/links.js` | Linkten indirme, Giphy ve X (Twitter) link çözümleme |
| `public/js/zip.js` | `.wastickers` için küçük ZIP yazıcı |
| `public/vendor/ffmpeg/` | `@ffmpeg/ffmpeg` ESM dosyaları (Worker aynı alan adından yüklenmeli) |

## Çıkartmayı WhatsApp'a ekleme

- **WhatsApp Web/Masaüstü:** `.webp` dosyasını sohbete sürükle → çıkartma olarak gönderilir → favorilere ekle.
- **Android:** "WhatsApp'ta paylaş" butonu veya `.wastickers` paketini bir çıkartma paketi uygulamasıyla aç.
- **iPhone:** Çıkartmayı kendine gönder, gelen çıkartmaya basılı tutup favorilere ekle.
