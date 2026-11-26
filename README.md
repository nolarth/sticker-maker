# StikerYap — GIF → WhatsApp Çıkartma

GIF'leri **link girerek** ya da **dosya yükleyerek** WhatsApp çıkartmasına dönüştüren web sitesi.

## Özellikler

- **Dosya yükleme:** sürükle-bırak, dosya seçici veya **Ctrl+V** ile yapıştırma (GIF, MP4, WebM, PNG, JPG — en fazla 25 MB)
- **Link ile:** doğrudan `.gif` linkleri, **Giphy** sayfa linkleri (`giphy.com/gifs/...`) ve sayfadaki `og:image`/`og:video` etiketleri üzerinden **Tenor** gibi siteler
- **WhatsApp kurallarına otomatik uyum:**
  - 512×512 kare tuval (Sığdır = şeffaf dolgu / Kırp / Uzat)
  - Animasyonlu WebP, sonsuz döngü, en fazla 10 sn (başlangıç saniyesi seçilebilir)
  - Animasyonlu ≤ 500 KB, sabit ≤ 100 KB — sığana kadar FPS ve kalite kademeli düşürülür
- **Önizleme:** şeffaflık ızgarası + WhatsApp sohbet balonu görünümü
- **Paylaş:** mobilde Web Share API ile doğrudan WhatsApp'a gönderme
- **Paket:** 3–30 çıkartmayı toplayıp `.wastickers` dosyası olarak indirme (96×96 paket simgesi otomatik)
- Açık/koyu tema, mobil uyumlu, Türkçe arayüz

## Çalıştırma

Gereksinimler: Node.js 18+ ve **ffmpeg** (libwebp desteğiyle).

```bash
npm install
npm start          # http://localhost:3000
npm test
```

Docker ile:

```bash
docker build -t stikeryap .
docker run -p 3000:3000 stikeryap
```

Ortam değişkenleri: `PORT` (varsayılan 3000), `MAX_CONCURRENT` (aynı anda çalışacak ffmpeg sayısı, varsayılan 2).

## Mimari

| Dosya | Görev |
|---|---|
| `server.js` | Express sunucu, `POST /api/convert` (multipart `file` veya `url`, `fit`, `start`), hız ve eşzamanlılık sınırı |
| `lib/convert.js` | ffprobe + ffmpeg ile WebP üretimi, boyut sınırına sığdırma döngüsü |
| `lib/fetchUrl.js` | Linkten güvenli indirme (özel IP/SSRF engeli, DNS sabitleme, boyut/zaman sınırı, yönlendirme takibi), Giphy/Tenor çözümleme |
| `public/` | Arayüz (bağımlılıksız HTML/CSS/JS, `.wastickers` için küçük ZIP yazıcı) |

Yüklenen dosyalar diske yalnızca dönüştürme süresince geçici olarak yazılır ve hemen silinir.

## Çıkartmayı WhatsApp'a ekleme

- **WhatsApp Web/Masaüstü:** `.webp` dosyasını sohbete sürükle → çıkartma olarak gönderilir → favorilere ekle.
- **Android:** "WhatsApp'ta paylaş" butonu veya `.wastickers` paketini bir çıkartma paketi uygulamasıyla aç.
- **iPhone:** Çıkartmayı kendine gönder, gelen çıkartmaya basılı tutup favorilere ekle.
