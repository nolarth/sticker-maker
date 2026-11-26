# StikerYap — GIF → WhatsApp Çıkartma

GIF'leri **link girerek** ya da **dosya yükleyerek** WhatsApp çıkartmasına dönüştüren web sitesi.
Dönüştürme tamamen **tarayıcıda** ([ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)) yapılır; sunucu gerekmez, site **GitHub Pages**'te çalışır ve dosyalar hiçbir yere yüklenmez.

## Nasıl çalışır?

1. X/Giphy linkini yapıştır ya da GIF/video dosyasını seç → **Hazırla**
2. **WhatsApp'a gönder** (telefonda paylaşım ekranı açılır; bilgisayarda GIF indirilir)
3. WhatsApp'ta:
   - **Android:** GIF'e dokun → **⋮** → **Çıkartma oluştur**
   - **iPhone:** GIF'e basılı tut → **Kopyala** → mesaj kutusuna yapıştır → Gönder

WhatsApp'ın kendi "GIF'ten çıkartma oluşturma" özelliği kullanıldığı için ek uygulama gerekmez.
Neden doğrudan çıkartma olarak gönderilmiyor? Web siteleri bunu yapamaz: tarayıcının paylaş özelliği yalnızca
standart dosya türlerini (`image/webp`, `image/gif` …) iletir ve WhatsApp bunları sıradan resim/GIF olarak alır;
çıkartma gönderme (`image/webp.wasticker`, `SEND_STICKER`) yalnızca telefona kurulu uygulamalara açıktır.
GIF olarak gönderince WhatsApp onu tanır ve kendi menüsünden çıkartmaya çevirmeye izin verir.

## Özellikler

- **Link ile:** **X (Twitter)** gönderi linkleri (`/photo/1`, `/video/2` dahil; paylaşım metni yapıştırılsa da link ayıklanır), Giphy linkleri, doğrudan `.gif` linkleri
- **Dosya:** sürükle-bırak, dosya seçici veya Ctrl+V (GIF, MP4, WebM, PNG, JPG — en fazla 25 MB)
- **Ayarlar:** Sığdır (oranı koru) / Kare kırp / Uzat, başlangıç saniyesi; en fazla 10 sn
- GIF en fazla 8 MB olacak şekilde otomatik küçültülür
- **Diğer seçenekler:** 512×512, şeffaf, ≤ 500 KB animasyonlu **WebP** çıkartma dosyası (çıkartma uygulamaları için)
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
| `public/js/app.js` | Arayüz mantığı, WhatsApp'a gönderme (Web Share), cihaza göre adımlar |
| `public/js/converter.js` | ffmpeg.wasm ile GIF ve WebP üretimi, boyut sınırına sığdırma |
| `public/js/links.js` | Linkten indirme, Giphy ve X (Twitter) link çözümleme |
| `public/vendor/ffmpeg/` | `@ffmpeg/ffmpeg` ESM dosyaları (Worker aynı alan adından yüklenmeli) |
