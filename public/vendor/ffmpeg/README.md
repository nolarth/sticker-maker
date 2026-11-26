`@ffmpeg/ffmpeg@0.12.15` paketinin `dist/esm` dosyaları (MIT lisansı, https://github.com/ffmpegwasm/ffmpeg.wasm).
Web Worker'ın sitenin kendi alan adından yüklenmesi gerektiği için CDN yerine depoya kopyalandı.
Çekirdek (`@ffmpeg/core@0.12.10`, ~30 MB) jsDelivr CDN'den yüklenir — bkz. `public/js/converter.js`.
