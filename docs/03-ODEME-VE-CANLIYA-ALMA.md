# Ödeme Altyapısı ve Canlıya Alma Rehberi

## 1. Ödeme kuruluşu seçimi

| Sağlayıcı | Kime uygun | Entegrasyon | Bu projede |
|---|---|---|---|
| **iyzico** | TR'de şahıs/şirket, en hızlı başvuru, iyzico Korumalı Alışveriş güveni | Ortak Ödeme Sayfası (yönlendirme) — kart bilgisi sitenize gelmez | ✅ **Hazır ve bağlı** (`server/payments/iyzico.js`) |
| **PayTR** | TR, genelde daha düşük komisyon, iFrame ödeme | iFrame + bildirim URL'i (HMAC imzalı) | 📄 Şablon aşağıda (§3) |
| **Stripe** | Yurt dışı satış; **Türkiye'de kurulu işletmeleri doğrudan kabul etmez** (yurt dışı şirket gerekir) | Checkout Session + webhook | 📄 Şablon aşağıda (§4) |
| **Havale/EFT** | POS onayı beklerken ilk günden satış | Yok (IBAN gösterilir, admin onaylar) | ✅ Hazır |

> Komisyon oranları ve para çekme (valör) süreleri sık değişir; başvurmadan önce güncel tarifeleri sağlayıcıdan teyit edin.

**Önerilen sıra:** 1) Havale/EFT ile hemen açılın → 2) iyzico başvurusu (onay genelde birkaç iş günü) → 3) onay gelince `PAYMENT_METHODS=card,bank_transfer`.

### iyzico başvurusundan önce sitede bulunması gerekenler (bu çalışmada hazırlandı, bilgileri siz dolduracaksınız)
- [x] Mesafeli Satış Sözleşmesi (`/sozlesme.html`) — **şirket bilgilerini doldurun**
- [x] Ön Bilgilendirme Formu (`/on-bilgilendirme.html`) — **[ ] alanlarını doldurun**
- [x] İptal/İade koşulları (`/iade-kosullari.html`)
- [x] KVKK Aydınlatma + Çerez politikası (`/kvkk.html`) — **başvuru e-postası/adres doldurun**
- [x] Ödeme adımında zorunlu sözleşme onay kutuları (sunucuda IP + zaman ile saklanır)
- [ ] İletişim bilgileri (adres, telefon, e-posta) — `SUPPORT_*` ortam değişkenleri + sözleşmeler
- [ ] Footer'da iyzico logo bandı (iyzico onay sonrası verdiği görseli `Footer.js`'e ekleyin)

## 2. iyzico — nasıl çalışıyor (kod hazır)

```
Müşteri "Siparişi Onayla" ─► POST /api/orders
   ├─ sunucu fiyatı DB'den hesaplar, stoğu atomik düşer (30 dk rezervasyon)
   ├─ iyzico.initialize(order) ─► paymentPageUrl
   └─ tarayıcı iyzico ödeme sayfasına yönlenir (3D Secure, taksit)
iyzico ─► POST /api/payment/iyzico/callback (token)
   ├─ iyzico.retrieve(token) ile sonuç SUNUCUDAN doğrulanır
   ├─ tutar + sepet no karşılaştırılır
   ├─ başarılı: sipariş "paid", onay e-postası, admin bildirimi
   └─ başarısız: "payment_failed", stok geri eklenir
Ödenmeden 30 dk geçerse ─► zamanlanmış iş siparişi iptal eder, stoğu geri ekler
```

**Test (sandbox):**
1. https://sandbox-merchant.iyzipay.com adresinden ücretsiz sandbox hesabı açın → Ayarlar > API anahtarları.
2. `.env`: `PAYMENT_METHODS=card,bank_transfer`, `CARD_PROVIDER=iyzico`, `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL=https://sandbox-api.iyzipay.com`
3. iyzico'nun dokümantasyonundaki **test kartlarıyla** ödeme yapın (ör. başarılı kart `5528790000000008`, ileri tarihli SKT, herhangi bir CVC).
4. Canlıya geçerken sadece anahtarları ve `IYZICO_BASE_URL=https://api.iyzipay.com`'u değiştirin.

> Callback'in çalışması için `PUBLIC_URL` iyzico'nun erişebileceği **https** adres olmalı (localhost'ta test için ngrok vb. veya doğrudan Render'da sandbox testi).

## 3. PayTR şablonu (iyzico yerine/yanında)

`server/payments/paytr.js` olarak eklenebilir — ek paket gerektirmez:

```js
import crypto from 'crypto';
const { PAYTR_MERCHANT_ID: id, PAYTR_MERCHANT_KEY: key, PAYTR_MERCHANT_SALT: salt, PAYTR_TEST_MODE = '1' } = process.env;
const hmac = (s) => crypto.createHmac('sha256', key).update(s).digest('base64');

// PayTR merchant_oid sadece harf+rakam kabul eder → "AQ-261111-ABCDE" yerine "AQ261111ABCDE"
export const toOid = (orderNumber) => orderNumber.replace(/-/g, '');

export async function getIframeToken(order, ip) {
  const basket = Buffer.from(JSON.stringify(
    order.items.map(i => [i.name, i.price.toFixed(2), i.quantity])
  )).toString('base64');
  const amount = Math.round(order.totalAmount * 100); // kuruş
  const f = {
    merchant_id: id, user_ip: ip, merchant_oid: toOid(order.orderNumber), email: order.customer.email,
    payment_amount: amount, user_basket: basket, no_installment: 0, max_installment: 0,
    currency: 'TL', test_mode: PAYTR_TEST_MODE
  };
  const hashStr = `${f.merchant_id}${f.user_ip}${f.merchant_oid}${f.email}${f.payment_amount}${f.user_basket}${f.no_installment}${f.max_installment}${f.currency}${f.test_mode}`;
  const body = new URLSearchParams({
    ...f, paytr_token: hmac(hashStr + salt), debug_on: '0', timeout_limit: '30', lang: 'tr',
    user_name: order.customer.name, user_phone: order.customer.phone,
    user_address: `${order.shippingAddress.addressLine} ${order.shippingAddress.district}/${order.shippingAddress.city}`,
    merchant_ok_url: `${process.env.PUBLIC_URL}/odeme-sonuc?no=${order.orderNumber}`,
    merchant_fail_url: `${process.env.PUBLIC_URL}/odeme-sonuc?no=${order.orderNumber}&status=failed`
  });
  const r = await (await fetch('https://www.paytr.com/odeme/api/get-token', { method: 'POST', body })).json();
  if (r.status !== 'success') throw new Error('PayTR: ' + r.reason);
  return `https://www.paytr.com/odeme/guvenli/${r.token}`; // iframe src (CSP frame-src'ye paytr.com ekleyin)
}

// Bildirim URL'i (PayTR paneline girilir): POST /api/payment/paytr/callback — CSRF muaf listesine ekleyin
export function verifyCallback(b) {
  return hmac(`${b.merchant_oid}${salt}${b.status}${b.total_amount}`) === b.hash;
}
// Route: if (!verifyCallback(req.body)) return res.status(400).send('bad hash');
//        order = Order.findOne({ orderNumber: <oid'den geri çevrilmiş> }); status==='success' ? markPaid : markFailed;
//        res.send('OK');  // PayTR "OK" metnini görmezse bildirimi tekrarlar
```

## 4. Stripe şablonu (yurt dışı şirketle global satış)

```bash
npm i stripe
```

```js
// server/payments/stripe.js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function createCheckout(order) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: order.customer.email,
    line_items: order.items.map(i => ({
      quantity: i.quantity,
      price_data: { currency: 'try', unit_amount: Math.round(i.price * 100), product_data: { name: i.name } }
    })),
    metadata: { orderNumber: order.orderNumber },
    success_url: `${process.env.PUBLIC_URL}/odeme-sonuc?no=${order.orderNumber}`,
    cancel_url: `${process.env.PUBLIC_URL}/odeme-sonuc?no=${order.orderNumber}&status=failed`
  });
  return session.url;
}

// app.js'te express.json()'dan ÖNCE (ham gövde gerekir):
// app.post('/api/payment/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
//   const ev = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
//   if (ev.type === 'checkout.session.completed') {
//     const order = await Order.findOne({ orderNumber: ev.data.object.metadata.orderNumber });
//     await markPaid(order, { transactionId: ev.data.object.payment_intent });
//   }
//   res.json({ received: true });
// });
```

## 5. Taslak mod, Render uyuma sorunu ve şu anki kesinti

### 5.1 Şu anki durum: site "uyuyor" değil, uyanırken çöküyor
`aqualora.shop` şu an `503` ve `x-render-routing: hibernate-wake-error` döndürüyor. Render servisi uyandırmaya çalışıyor ama uygulama ayağa kalkamıyor. Eski kod, production'da MongoDB'ye bağlanamazsa kendini kapatıyordu (`process.exit(1)`).
**En olası sebep:** Atlas ücretsiz (M0) cluster uzun süre (≈60 gün) kullanılmayınca **otomatik duraklatılır.**

Kontrol edin:
1. **Atlas → Clusters:** "Paused" yazıyorsa **Resume**'a basın.
2. **Atlas → Network Access:** `0.0.0.0/0` kaydı duruyor mu?
3. **Render → Logs:** `MongoDB Connection Error` / `FATAL` satırı var mı?

Yeni kod bu durumda **çökmez**: sunucu ayağa kalkar, ziyaretçiye "Kısa bir bakım çalışması yapıyoruz" sayfası gösterir ve veritabanına arka planda tekrar bağlanmayı dener.

### 5.2 Taslak (ön izleme) modu: domainin açık olması sorun mu?
Satış yapmadan domainin yayında olması **tek başına yasal sorun değildir.** Ancak eski haliyle şu riskler vardı:
- Sitede "Sepete ekle / Siparişi tamamla" çalışıyor görünüyordu, sözleşmelerde satıcı bilgisi yoktu.
- Google demo ürünleri (Unsplash görselli, gerçek olmayan stoklarla) indeksleyebilirdi; bunları sonradan temizlemek zaman alır.
- Kayıt formu kişisel veri topluyordu ama KVKK metni eksikti.
- Eski kodda tahmin edilebilir admin şifresi riski vardı (`admin123`).

**Çözüm:** `STORE_MODE` ayarı. Varsayılan değer `preview`:
- Üstte "Mağazamız çok yakında satışa açılıyor" bandı görünür.
- Sipariş API'si kapalıdır (ödeme sayfası bilgilendirme gösterir).
- `robots.txt` tüm siteyi kapatır, her yanıtta `X-Robots-Tag: noindex` gönderilir.
- Ödeme ayarları (IBAN/iyzico) zorunlu değildir.

Satışa açılacağınız gün Render'da `STORE_MODE=live` yapın. Google Search Console'dan sitemap'i gönderin.

### 5.3 Render ücretsiz plan neden uyuyor, ne yapılmalı?
Render Free, 15 dakika istek gelmezse servisi durdurur. İlk ziyaretçi 30-60 sn bekler; bu sırada iyzico ödeme dönüşü gecikebilir, zamanlanmış işler çalışmaz.

| Çözüm | Maliyet | Ne zaman |
|---|---|---|
| **Render Starter planına geçmek** | ~7 $/ay | **Satışa açılırken şart.** Hiç uyumaz; tek kalıcı çözüm budur. |
| **UptimeRobot / cron-job.org ile 5-10 dk'da bir ping** | 0 | Taslak dönemi için. Hem uyanık tutar hem site çökerse size e-posta atar. |

UptimeRobot kurulumu (hesabı sizin açmanız gerekiyor):
1. https://uptimerobot.com → ücretsiz hesap → **Add New Monitor**
2. Monitor Type: **HTTP(s)** · URL: `https://aqualora.shop/health` · Interval: **5 minutes**
3. Alert contact olarak e-postanızı seçin.

`/health` uç noktası hafiftir (veritabanı sorgusu yapmaz), her zaman `200` döner ve `{"db":"up|down"}` bilgisini verir. Ping'in sitenin kendisini uyanık tutması için sunucu kodu gerekmez; dışarıdan gelen istek yeterlidir. Uygulama kendi kendine ping atamaz, çünkü uyuduğunda kod da çalışmaz.

> Not: Render Free ayda 750 saat verir. Tek servis 7/24 açık kalınca yaklaşık 744 saat eder; sınırın içindedir. Ama aynı hesapta ikinci bir ücretsiz servis varsa saatler yetmez.

## 6. Canlıya alma — tek servis, en düşük maliyet

### Mimari
```
Müşteri ──HTTPS──► aqualora.shop (Render Web Service)
                     ├─ Express: /api/*  (sepet, sipariş, chat, admin)
                     ├─ dist/ (Vite ile derlenmiş site)
                     └─ zamanlanmış işler (rezervasyon süresi, sepet hatırlatma)
                   ──► MongoDB Atlas (Frankfurt)
                   ──► iyzico API · Resend (e-posta)
```
Frontend ve API **aynı domainde** → CORS ve çerez (SameSite) sorunları yok. Netlify'a ayrıca gerek yoktur.

### Tahmini aylık maliyet
| Kalem | Seçenek | Maliyet |
|---|---|---|
| Sunucu | Render **Starter** (uyumaz, zamanlanmış işler sürekli çalışır) | ~7 $ |
| | Render Free (15 dk boşta uyur, ilk istek ~30-60 sn; ödeme callback'i gecikebilir) | 0 $ — sadece test |
| Veritabanı | Atlas M0 → satış başlayınca Flex | 0 → ~8-30 $ |
| E-posta | Resend ücretsiz katman | 0 $ |
| Domain | .shop / .com.tr | yıllık |
| SSL | Render otomatik (Let's Encrypt) | 0 $ |

### Adım adım (Render)
1. **Render → New → Web Service** → GitHub reposunu bağlayın.
2. Ayarlar:
   - Runtime: **Node** · Region: **Frankfurt**
   - Build Command: `npm ci` *(package.json'daki `postinstall` siteyi otomatik derler)*
   - Start Command: `npm start`
   - Health Check Path: `/health`
3. **Environment** sekmesine `.env.example`'daki değişkenleri girin. Asgari: `NODE_ENV=production`, `PUBLIC_URL=https://aqualora.shop`, `MONGODB_URI`, `SESSION_SECRET` (≥32 karakter), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (≥12 karakter), `PAYMENT_METHODS`, banka bilgileri, `SUPPORT_*`. **`VITE_API_BASE_URL` tanımlamayın.**
4. Deploy → loglarda `🚀 Aqualora ... (production)` görmelisiniz. Eksik/zayıf ayar varsa sunucu başlamaz ve hangi değişkenin eksik olduğunu yazar.

### Domain ve SSL
1. Render → Service → **Settings → Custom Domains** → `aqualora.shop` ve `www.aqualora.shop` ekleyin.
2. Domain sağlayıcınızın DNS panelinde Render'ın gösterdiği kayıtları girin (genellikle):
   - `aqualora.shop` → **A** kaydı → Render'ın verdiği IP
   - `www` → **CNAME** → `servis-adiniz.onrender.com`
3. DNS yayıldığında (birkaç dk – birkaç saat) Render **SSL sertifikasını otomatik** üretir ve yeniler.
4. `PUBLIC_URL`'i kanonik adresinizle (ör. `https://aqualora.shop`) eşleştirin; diğerini Render'da yönlendirme olarak bırakın.
5. *(İsteğe bağlı)* Cloudflare kullanırsanız: SSL modu **Full (strict)**, proxy açık. Ekstra DDoS koruması ve önbellek sağlar.

### E-posta (Resend)
1. resend.com → domain ekleyin → verdiği **SPF/DKIM** DNS kayıtlarını girin (spam'e düşmemek için şart).
2. `RESEND_API_KEY`, `MAIL_FROM="Aqualora <siparis@aqualora.shop>"`, `ADMIN_NOTIFY_EMAIL`.

### Google
- Search Console'a domaini ekleyin → `https://aqualora.shop/sitemap.xml` gönderin.
- Merchant Center (ücretsiz ürün listeleri) için ürün sayfalarında JSON-LD (fiyat, stok) hazırdır.

## 7. Yayın öncesi kontrol listesi
- [ ] `.env`'deki son satırda yorum olarak duran değeri silin; bir şifre ise değiştirin.
- [ ] `.env`'den `VITE_API_BASE_URL` satırını kaldırın; yerelde `NODE_ENV=development` kullanın.
- [ ] Canlı DB'de `admin@aquaflora.com / admin123` hesabı varsa: `ADMIN_EMAIL`/`ADMIN_PASSWORD` ayarlayıp `npm run admin:reset` (eski hesabın admin yetkisini de kaldırır).
- [ ] MongoDB Atlas kullanıcı şifresini değiştirin (dosyalarda paylaşıldıysa).
- [ ] Sözleşme sayfalarındaki şirket bilgileri, marka adı (Aqualora/Aquaflora tutarlılığı).
- [ ] `server/chat/faq.js` yanıtlarını kendi kargo/iade politikanıza göre gözden geçirin.
- [ ] Sandbox'ta: başarılı ödeme, başarısız ödeme, 30 dk ödenmeyen sipariş, havale onayı, kargoya verme, iade talebi.
- [ ] Yerelde test: `npm run test:smoke` (**sadece test veritabanına karşı**).
- [ ] KVKK: VERBİS kayıt yükümlülüğünüzü ve yurt dışı aktarım (Render/Atlas/Resend) bildirimini bir danışmanla teyit edin.

## 8. Yerel geliştirme
```bash
cp .env.example .env    # değerleri doldurun, NODE_ENV=development
npm install
npm run server          # API :3000 (dosya değişince yeniden başlar)
npm run dev             # Site :5173 (/api istekleri :3000'e yönlenir)
```
