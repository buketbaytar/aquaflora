# 🚀 Vast Supernova Deployment Rehberi

Bu rehber, projenin production ortamına (Render.com ve Netlify) taşınması için gereken adımları içerir.

## 1. MongoDB Atlas Hazırlığı

- **Database Access:** Yeni bir veritabanı kullanıcısı oluşturun veya mevcut olanın bilgilerini not edin.
- **Network Access:** Render.com'un dinamik IP kullandığını unutmayın. En güvenli yol IP whitelist'e `0.0.0.0/0` (tüm IP'lere izin ver) eklemektir.
- **Connection String:** Atlas panelinden bağlantı linkini alın (Ör: `mongodb+srv://...`).

## 2. Backend Deployment (Render.com)

1. Render.com üzerinde **"New Web Service"** oluşturun.
2. Github deponuzu bağlayın.
3. Parametreleri şu şekilde ayarlayın:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start` (veya `node server.js`)
4. **Environment Variables** kısmına şunları ekleyin:
   - `MONGODB_URI`: MongoDB Atlas linkiniz.
   - `SESSION_SECRET`: Rastgele güçlü bir anahtar (Ör: `abc-123-xyz`).
   - `NODE_ENV`: `production`
   - `FRONTEND_URL`: Netlify'dan alacağınız URL (Ör: `https://vast-supernova.netlify.app`).
   - `CUSTOM_DOMAIN`: (Varsa) Kendi alan adınız.
   - `PORT`: `3000` (Render otomatik port atasa da tanımlı kalması iyidir).

## 3. Frontend Deployment (Netlify)

1. Netlify üzerinde **"Add new site"** -> **"Import an existing project"**.
2. Değişkenleri şu şekilde ayarlayın:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. **Environment Variables** kısmına şunları ekleyin:
   - `VITE_API_BASE_URL`: Render'dan aldığınız backend URL'i (Ör: `https://vast-supernova.onrender.com`).

## 4. CORS ve Güvenlik Ayarları

- Backend `server.js` dosyasında CORS ayarları güncellendi. Eğer yeni bir domain eklerseniz, backend environment variable'lardaki `FRONTEND_URL` veya `CUSTOM_DOMAIN` alanlarını güncelleyin.
- Ödeme sistemi (iyzico) şu an için **devredışı** bırakıldı. `CartPage.js` üzerinde "Bakımda" mesajı görünür.

## 5. Test Senaryoları

- [ ] Site yüklendiğinde "Giriş Yap" alanı çalışıyor mu? (Backend bağlantı testi)
- [ ] Ürünler listeleniyor mu?
- [ ] Sepete ürün eklenebiliyor mu?
- [ ] Sepet sayfasında "Ödemeye Geç" butonu pasif ve uyarı mesajı var mı?
- [ ] Sayfa yenilendiğinde oturum devam ediyor mu?

## 6. Hızlı Başlangıç Komutları (Yerel Test)

```bash
# Backend için
$ env PORT=3000 MONGODB_URI=... node server.js

# Frontend için (Vite)
$ npm run dev
```

---
> [!NOTE]
> Herhangi bir sorunda `Render Logs` veya `Netlify Deploy Logs` kısımlarını kontrol etmeyi unutmayın.
