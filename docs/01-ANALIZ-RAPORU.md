# Aqualora — Üretim Öncesi Analiz Raporu

> Kapsam: `server.js`, `server-payment.js`, `src/**`, `public/**`, `vite.config.js`, yardımcı scriptler.
> Önem seviyeleri: **🔴 Kritik** (satış/veri/güvenliği doğrudan bozar) · **🟠 Yüksek** · **🟡 Orta** · **⚪ Düşük**
> Sütun "Durum": ✅ bu çalışmada düzeltildi · 📘 rehberde anlatıldı (sizin aksiyonunuz gerekli)

---

## 1. Uçtan Uca E-Ticaret Akışı

### 1.1 Ürün kataloğu / ürün kimlikleri
| # | Bulgu | Önem | Durum |
|---|---|---|---|
| K1 | `/api/products` ürün `id` alanını MongoDB `_id` (string) olarak döndürüyor; ürün detay sayfası `parseInt(id)` ile arıyor → **ürün detay sayfası `undefined.name` hatasıyla çöküyor.** | 🔴 | ✅ |
| K2 | Sepet şeması `productId: Number`; frontend `_id` (string) gönderiyor, backend `parseInt("65ab…")` yapıyor → **yanlış ürün/boş sepet**. Sipariş `productId: Number required` → sipariş kaydı da kırılıyor. | 🔴 | ✅ |
| K3 | Favorilerde aynı karışıklık (`parseInt(id)` + `_id` eşleşmesi) → favori ekle/çıkar tutarsız. | 🟠 | ✅ |
| K4 | `ProductList`, `ShopPage` statik `src/data/products.js`'i import ediyor → admin panelden eklenen ürünlerle çelişen eski veri gösterilebiliyor. | 🟡 | ✅ |
| K5 | Video alanı boş olan ürünlerde `<video src="undefined">` → sunucuya `/undefined` istekleri (sunucuda "hotfix" ile susturulmuş). | 🟡 | ✅ |
| K6 | Ürün URL'leri yok (SPA iç state ile geziyor) → ürün paylaşılamıyor, geri tuşu çalışmıyor, Google ürün sayfalarını indeksleyemiyor. | 🟠 | ✅ |

### 1.2 Filtreleme / arama
| # | Bulgu | Önem | Durum |
|---|---|---|---|
| F1 | Header'daki arama kutusu hiçbir şeye bağlı değil. | 🟠 | ✅ |
| F2 | Mobil/tablette (≤1024px) menü ve arama `display:none`, yerine hamburger menü yok → **mobil kullanıcı kategoriye/aramaya ulaşamıyor.** | 🔴 | ✅ |
| F3 | Sıralama (fiyat artan/azalan, yeni, popüler) ve "sadece stoktakiler" filtresi yok. | 🟡 | ✅ |
| F4 | Fiyat aralığı 30.000 ₺ ile sabit; daha pahalı ürünler filtreden düşüyor. | 🟡 | ✅ |
| F5 | `?category=` parametresi okunmuyor (sadece `subCategory`). | 🟡 | ✅ |

### 1.3 Sepet yönetimi
| # | Bulgu | Önem | Durum |
|---|---|---|---|
| S1 | `cart.js` POST isteklerine **CSRF token eklemiyor** → sunucu `csurf` ile 403 döner; sepete ekle/sil canlıda çalışmaz. Aynı durum ürün görüntülenme sayacı ve favoriler için de geçerli. | 🔴 | ✅ |
| S2 | Misafir sepeti yok: giriş yapmayan kullanıcı sepete ürün ekleyemiyor (401). Sektör standardı: localStorage misafir sepeti + girişte sunucu sepetiyle birleştirme. | 🔴 | ✅ |
| S3 | Adet artır/azalt yok; toplam hesabı adedi yok sayıyor (`// Quantity is 1 for now`); sepet sayacı satır sayısını gösteriyor. | 🟠 | ✅ |
| S4 | Sepete eklerken stok kontrolü yok (stokta olmayan ürün sepete girip ödemede patlıyor). | 🟠 | ✅ |
| S5 | Sepette unutulan ürün hatırlatması (abandoned cart) yok. | 🟡 | ✅ (e-posta servisi tanımlanınca aktif) |

### 1.4 Stok ve sipariş
| # | Bulgu | Önem | Durum |
|---|---|---|---|
| O1 | Stok kontrolü ile stok düşümü ayrı adımlar ve atomik değil → aynı anda iki sipariş **stoğu eksiye düşürebilir** (race condition). | 🔴 | ✅ koşullu atomik düşüm + geri alma |
| O2 | Sipariş ödeme alınmadan `status: 'paid'` olarak kaydediliyor (TEST modu canlı kodda). | 🔴 | ✅ |
| O3 | Siparişte adres, telefon, fatura bilgisi, sipariş numarası, kargo takip, durum geçmişi yok. | 🔴 | ✅ |
| O4 | Ödenmeyen siparişin ayırdığı stok hiç geri bırakılmıyor (rezervasyon süresi yok). | 🟠 | ✅ (kart: 30 dk, havale: 48 saat) |
| O5 | Kullanıcının "Siparişlerim" sayfası ve misafir sipariş takibi yok. | 🟠 | ✅ |
| O6 | Sipariş onay e-postası / yöneticiye yeni sipariş bildirimi yok. | 🟠 | ✅ (Resend API ile, anahtar girilince) |
| O7 | Admin panelde sipariş yönetimi (durum güncelle, kargo no gir) yok. | 🟠 | ✅ |
| O8 | Kargo ücreti "Ücretsiz" yazılı ama hiçbir yerde kural yok; chatbot "24 saatte teslim" diyor (yanıltıcı ticari beyan). | 🟡 | ✅ ayarlanabilir kargo kuralı |

### 1.5 Ödeme (checkout)
| # | Bulgu | Önem | Durum |
|---|---|---|---|
| P1 | Ödeme tamamen kapalı (`503 maintenance`); `server-payment.js` hiçbir yerden import edilmiyor ve sahte alıcı bilgisi (sabit TC, adres, IP) gönderiyor. | 🔴 | ✅ iyzico Ortak Ödeme Sayfası entegrasyonu |
| P2 | Ödeme callback'i sipariş ile ödeme sonucunu eşleştirip doğrulamıyor. | 🔴 | ✅ token ile sunucudan doğrulama + idempotent |
| P3 | Havale/EFT seçeneği yok (sanal POS onayı gelene kadar satış yapmanın en hızlı yolu). | 🟡 | ✅ |

### 1.6 Kullanıcı / üyelik
| # | Bulgu | Önem | Durum |
|---|---|---|---|
| U1 | "Şifremi unuttum" çalışmıyor. | 🟠 | ✅ token'lı sıfırlama |
| U2 | E-posta küçük harfe çevrilmiyor (`Ali@x.com` ≠ `ali@x.com` → çift hesap). | 🟡 | ✅ |
| U3 | Şifre politikası yok (sunucuda min. uzunluk kontrolü yok). | 🟠 | ✅ min. 8 karakter |
| U4 | Kayıtta KVKK aydınlatma onayı ve ayrı ticari ileti (İYS) izni alınmıyor. | 🟠 | ✅ |
| U5 | `AuthModal.js` ölü kod (`Auth.init()` diye bir fonksiyon yok). | ⚪ | ✅ silindi |

---

## 2. Güvenlik

| # | Bulgu | Önem | Durum |
|---|---|---|---|
| G1 | `reset_admin.js` ve bellek modu **`admin@aquaflora.com / admin123`** sabit yönetici hesabı oluşturuyor. Bu script canlı DB'ye karşı çalıştırıldıysa şifre herkesçe tahmin edilebilir. | 🔴 | ✅ env'den okunuyor · 📘 canlıdaki admin şifresini değiştirin |
| G2 | `SESSION_SECRET` yoksa `'gizli_anahtar_degistirin'` ile devam ediyor → oturum çerezi sahtelenebilir. | 🔴 | ✅ prod'da yoksa sunucu başlamaz |
| G3 | `.env` dosyası `dotenv` ile hiç yüklenmiyor (sadece kullanılmayan `server-payment.js` yüklüyor). | 🟠 | ✅ |
| G4 | `.env` içinde, son satırda yorum olarak duran parola benzeri bir değer var. | 🟠 | 📘 silin, bir parolaysa değiştirin |
| G5 | `ADMIN_EMAIL/ADMIN_PASSWORD` tanımsızsa `bcrypt.hash(undefined)` hatası; tanımlıysa her açılışta denenir. | 🟡 | ✅ |
| G6 | Express tarafında güvenlik başlıkları yok (CSP, HSTS, X-Frame-Options…). `_headers` sadece Netlify'da çalışır; site Render'da Express'ten servis ediliyor. | 🟠 | ✅ |
| G7 | Hata yanıtlarında `e.message` istemciye dönüyor (iç yapı sızıntısı). | 🟡 | ✅ merkezi hata yöneticisi |
| G8 | Admin ürün güncelleme `req.body`'yi doğrudan `findByIdAndUpdate`'e veriyor (mass-assignment). | 🟡 | ✅ alan beyaz listesi |
| G9 | Gövde boyut limiti yok (büyük JSON ile bellek şişirme). | 🟡 | ✅ 100 KB |
| G10 | Loglarda kullanıcı e-postaları düz metin (KVKK açısından gereksiz kişisel veri işleme). | 🟡 | ✅ |
| G11 | `csurf` paketi 2022'de terk edildi (deprecated). | 🟡 | ✅ yerine küçük, bağımlılıksız CSRF koruması |
| G12 | Çerez `secure: true` sabit → localhost'ta (http) oturum hiç çalışmıyor; geliştirme zorlaşıyor. | ⚪ | ✅ |
| G13 | Admin paneli gizli bir dosya adına (`kaptan_kosku_881.html`) dayanıyor. API tarafı `isAdmin` ile korunuyor, bu yeterli; ancak `/admin` rotası olmayan `admin.html`'i servis etmeye çalışıyor. | ⚪ | ✅ `/admin` → panele yönlendirme (yetki kontrollü) |
| G14 | Frontend `API_BASE` varsayılanı canlı domain (`https://aqualora.shop`) → **yerelde geliştirme yaparken canlı veritabanına istek atılıyor.** | 🟠 | ✅ varsayılan aynı origin |
| G15 | Rate limit sadece login/register'da; chat, sipariş, şifre sıfırlama uçları korumasız. | 🟡 | ✅ |

## 3. Form doğrulama ve hata yönetimi
- Sunucu tarafında hiçbir girdi şeması doğrulanmıyor (e-posta biçimi, telefon, adres, adet sınırları, ObjectId). → ✅ `server/lib/validate.js`
- `alert()` ile hata gösterimi; ağ hatasında kullanıcıya anlamlı mesaj yok. → ✅ toast + satır içi form hataları
- Global `unhandledRejection` / Express hata yakalayıcı yok → bir async hata tüm isteği askıda bırakabiliyor. → ✅
- DB bağlantısı `setTimeout(2000)` ile "umarım bağlanmıştır" mantığıyla seed ediliyor (yarış durumu). → ✅ bağlantı beklenip sonra dinlemeye başlanıyor
- Bellek modu (DB yokken çalışma) iki paralel kod yolu yaratıp hatalara yol açıyor; sipariş zaten DB istiyor. → ✅ kaldırıldı, DB zorunlu.

## 4. SEO
| Bulgu | Durum |
|---|---|
| `<html lang="en">`; Türkçe site | ✅ |
| Marka adı 4 farklı: **Aqualora** (title/domain), **AQUAFLORA** (logo), **DeepDive** (SEO, footer, chatbot), **vast-supernova** (urunler.html) | ✅ tek kaynak `src/config.js` (`VITE_SITE_NAME`) — 📘 sözleşmelerdeki ünvanı siz güncelleyin |
| `robots.txt`, `sitemap.xml`, canonical, Open Graph etiketleri yok | ✅ dinamik `sitemap.xml` |
| Ürün sayfaları JS ile render → sosyal medya önizlemesi ve tarayıcı dışı botlar boş sayfa görüyor | ✅ `/urun/:id` için sunucu tarafı meta enjeksiyonu |
| JSON-LD'de stok durumu her zaman `InStock`, fiyat yanlış parse | ✅ |
| Görsellerde boyut/`decoding` yok; tüm ürünler için video etiketi | ✅ |

## 5. Performans
- Header + chat her sayfa geçişinde baştan render ediliyor; her render'da `scroll` ve `document.click` dinleyicileri **tekrar ekleniyor** (bellek sızıntısı, chat önerilerinde mesajların çoğalması). → ✅ layout bir kez kurulur, sadece içerik değişir.
- `/api/products` her istekte tüm ürünleri 3 `populate` ile çekiyor, cache yok. → ✅ kısa süreli `Cache-Control` + statik dosyalarda uzun cache (`/assets/*` immutable).
- Sıkıştırma yok. → 📘 Render/Cloudflare otomatik yapar; ek paket gerekmez.

## 6. Mobil uyumluluk
- ≤1024px'te navigasyon ve arama kayboluyor (F2). → ✅ hamburger menü + mobil arama
- Header'daki `--primary-color` değişkeni hiç tanımlı değil → Giriş/Üye Ol butonları şeffaf görünüyor. → ✅
- Chat penceresi küçük ekranda tam ekran olmalı. → ✅

## 7. Ticari sitede olması gerekip eksik olanlar (mimariye eklendi)
1. ✅ Sipariş numarası (`AQ-YYMMDD-XXXX`) ve durum makinesi: `pending_payment → paid → preparing → shipped → delivered` (+ `cancelled`, `payment_failed`, `refund_requested`, `refunded`)
2. ✅ Stok rezervasyonu + süre aşımında otomatik iade
3. ✅ Sipariş onay / kargoya verildi / şifre sıfırlama / sepet hatırlatma e-postaları
4. ✅ Ön Bilgilendirme Formu + Mesafeli Satış Sözleşmesi onayı **sunucuda zaman damgası ve IP ile saklanıyor** (uyuşmazlıkta ispat yükü satıcıdadır)
5. ✅ Ön Bilgilendirme Formu sayfası (`/on-bilgilendirme.html`) — eksikti
6. ✅ Çerez bilgilendirme bandı
7. ✅ Misafir alışverişi (üye olmadan sipariş) + e-posta + sipariş no ile takip
8. ✅ İade/değişim talebi kaydı (chat üzerinden, `SupportTicket`)
9. ✅ Düşük stok uyarısı (admin e-postası)
10. 📘 Gerçek şirket bilgileri (ünvan, MERSİS, vergi no, adres, KEP) — sözleşme sayfalarında yer tutucu var, **yasal zorunluluk**
11. 📘 E-fatura/e-arşiv entegrasyonu (Paraşüt, Logo İşbaşı vb.) — satış hacmi artınca

## 8. Chatbox
Mevcut `AIAssistant.js` "simüle" yanıt veren, 3 anahtar kelimeye bakan, geçmiş tutmayan, her render'da dinleyici çoğaltan bir kutu; "Tüm siparişlerde kargo ücretsiz ve 24 saatte teslim" gibi **gerçek olmayan ticari taahhüt** veriyor. → ✅ Bölüm 2'deki çözüm odaklı asistanla değiştirildi (bkz. `server/chat/`).

## 9. Veri saklama — mevcut durum
| Veri | Nerede | Sorun |
|---|---|---|
| Ürün, kategori, marka | MongoDB Atlas (`products`, `categories`, `subcategories`, `brands`) + **statik `src/data/products.js`** | Çift kaynak |
| Kullanıcı | MongoDB `users` | Adres/telefon/onay yok |
| Sepet | MongoDB `carts` (sadece üyeler) | Misafir sepeti yok, `productId` tipi hatalı |
| Sipariş | MongoDB `orders` | Adres/fatura/durum geçmişi yok |
| Chat | **Hiçbir yerde** | Sayfa yenilenince kaybolur |
| Oturum | İmzalı çerez (`cookie-session`) | Uygun (sunucusuz, bakım gerektirmez) |

Öneri ve şema: `docs/02-VERITABANI-MIMARISI.md`

## 10. Ödeme ve canlıya alma
`docs/03-ODEME-VE-CANLIYA-ALMA.md`
