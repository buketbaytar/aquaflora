# Aqualora — Kurulum ve Canlıya Alma

Proje artık **tek servis** olarak çalışır: Express hem API'yi hem derlenmiş siteyi (`dist/`) aynı domainden sunar. Ayrı Netlify kurulumuna gerek yoktur.

| Doküman | İçerik |
|---|---|
| [docs/01-ANALIZ-RAPORU.md](docs/01-ANALIZ-RAPORU.md) | Bulunan eksikler/hatalar ve yapılan düzeltmeler |
| [docs/02-VERITABANI-MIMARISI.md](docs/02-VERITABANI-MIMARISI.md) | DB önerisi, ER şeması, yedekleme, saklama süreleri |
| [docs/03-ODEME-VE-CANLIYA-ALMA.md](docs/03-ODEME-VE-CANLIYA-ALMA.md) | iyzico/PayTR/Stripe, taslak mod, Render uyuma sorunu, domain, SSL, yayın kontrol listesi |
| [docs/04-MAGAZA-KATALOG-VE-GORSELLER.md](docs/04-MAGAZA-KATALOG-VE-GORSELLER.md) | Dalış mağazası kategori yapısı, Excel ile toplu ürün ekleme, görseller (Cloudinary) |

Hızlı başlangıç:

```bash
cp .env.example .env
npm install
npm run server   # :3000
npm run dev      # :5173
```

Ortam değişkenleri: [.env.example](.env.example)
