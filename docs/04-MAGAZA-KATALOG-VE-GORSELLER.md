# Dalış Mağazası: Kategori Yapısı, Ürün Ekleme ve Görseller

## 1. Mevcut yapının sorunu

Şu anki kategoriler **disipline** göre (Tüplü Dalış / Serbest Dalış / Yüzme / Kamp) ayrılmış:
- "Elbiseler" hem Tüplü hem Serbest altında tekrar ediyor; "Maske" iki ayrı yerde.
- Müşteri "5mm elbise" ya da "kapalı topuk palet" diye **ürün tipiyle** arar. Ama ürünler disipline göre dağıtıldığı için müşteri aradığı tipin hangi kategoride olduğunu bilemiyor.
- "Kamp & Outdoor" dalış mağazası kimliğini (ve Google'daki konumlanmayı) zayıflatıyor.

Sektörde dalış mağazaları genelde **ürün tipine göre** üst kategori kullanır. Disiplin (tüplü/serbest), kalınlık, cinsiyet, beden gibi bilgiler **özellik/filtre** olarak verilir.

## 2. Önerilen kategori ağacı (şablona işlendi)

| # | Kategori | Alt kategoriler | Kritik özellikler (filtre) |
|---|---|---|---|
| 1 | **Maske & Şnorkel** | Dalış Maskeleri · Şnorkeller · Maske-Şnorkel Setleri | Cam tipi, hacim, numaralı cam uyumu |
| 2 | **Paletler** | Kapalı Topuk · Açık Topuk · Serbest Dalış Paletleri · Palet Aksesuarları | Topuk tipi, kanat malzemesi, beden (36-37 …) |
| 3 | **Dalış Elbiseleri** | Shorty · Islak Elbiseler · Semi-Dry ve Kuru · Zıpkın ve Kamuflaj · Lycra ve Rashguard | **Kalınlık (3/5/7mm)**, cinsiyet, su sıcaklığı, beden |
| 4 | **Patik, Eldiven, Başlık** | Patikler · Eldivenler · Başlıklar · Yelek ve Alt Katmanlar | Kalınlık, beden |
| 5 | **Tüplü Dalış Ekipmanı** | Regülatörler · Denge Yelekleri (BCD) · Konsol ve Göstergeler · Ağırlık Sistemleri | DIN/INT bağlantı, BCD tipi |
| 6 | **Dalış Bilgisayarı & Enstrüman** | Dalış Bilgisayarları · Pusula ve Enstrümanlar | Hava/Nitrox, saat/konsol |
| 7 | **Serbest Dalış & Zıpkın** | Zıpkın Tüfekleri · Zıpkın Yedek Parçaları · Şamandıra ve İpler · Ağırlık ve Kemerler | Tüfek boyu, lastikli/havalı |
| 8 | **Sualtı Aydınlatma & Kamera** | Sualtı Fenerleri · Kamera ve Kutular | Lümen, pil tipi |
| 9 | **Aksesuar & Güvenlik** | Dalış Bıçakları · Güvenlik Ekipmanları · Çantalar · Bakım Ürünleri | — |
| 10 | **Yüzme** | Yüzme Gözlükleri · Boneler · Mayolar · Antrenman Ekipmanları | Cinsiyet, beden |
| 11 | **Setler & Paketler** | Başlangıç Setleri | Seviye — sepet ortalamasını artırır |

**Kamp & Outdoor:** Gerçekten satıyorsanız en sona alın, satmıyorsanız admin panelden ürünlerini pasif yapın. Ürünü olmayan kategoriler artık menüde **otomatik gizleniyor**.

Menüde masaüstünde ilk 6 kategori görünür, kalanlar "Tüm Ürünler" ile mobil menüdedir. Sıra, CSV'deki ilk görülme sırasıdır.

## 3. Bir dalış mağazasında olması gerekenler — durum

| Özellik | Durum |
|---|---|
| Ürün tipine göre kategori + marka/fiyat/stok filtresi + sıralama + arama | ✅ |
| Beden/numara varyantları ve beden bazlı stok | ✅ |
| Çoklu ürün görseli (galeri) | ✅ bu çalışmada eklendi |
| Ürün teknik özellikleri (kalınlık, malzeme…) | ✅ `ozellikler` sütunu |
| Başlangıç setleri / paketler | ✅ kategori olarak |
| Ürün önerisi ve beden yardımı (chat) | ✅ |
| Stok yoksa "gelince haber ver" | ✅ chat → destek talebi |
| **Beden tablosu sayfası** (elbise/palet/patik) | 📝 Markaya göre değişir; tedarikçinizin tablolarıyla `public/` altına sayfa ekleyin |
| **"Hangi kalınlık?" rehberi** (su sıcaklığı ↔ mm) | 📝 Şablonda `Su sıcaklığı` özelliği var; içerik/blog sayfası SEO için çok değerli |
| Regülatör bakımı / tüp dolumu gibi hizmetler | 📝 Fiziksel mağazanız varsa "Hizmet" kategorisi olarak eklenebilir |
| Ürün yorumları | ⏳ sonraki aşama |
| Kupon / indirim kodu | ⏳ sonraki aşama |

## 4. Ürün ekleme — iki yol

### A) Tek tek: Admin paneli
`https://aqualora.shop/admin` → Ürünler → Yeni Ürün. Görselleri **📷 Bilgisayardan yükle** ile ekleyebilirsiniz (bkz. §5).

### B) Toplu: Excel / CSV (önerilen)
1. `data/katalog-sablonu.csv` dosyasını Excel'de açın. Şablonda **57 taslak ürün** var; hepsi `aktif=hayir` olduğu için sitede görünmez.
2. Satmayacağınız satırları silin, kendi ürünlerinizi ekleyin. Sütunlar:

| Sütun | Örnek | Not |
|---|---|---|
| sku | `ELB-003` | Benzersiz stok kodu; güncellemede eşleştirme anahtarı |
| kategori / alt_kategori | `Dalış Elbiseleri` / `Islak Elbiseler` | Yoksa otomatik oluşturulur |
| urun_adi | `5mm Tam Boy Islak Dalış Elbisesi - Erkek` | Marka + model + özellik yazmak SEO için iyidir |
| marka | `Mares` | Boşsa "Markasız" |
| fiyat | `4.250,00` | KDV dahil satış fiyatı |
| stok | `12` | Bedensiz ürünler için |
| bedenler | `S:3\|M:5\|L:2` | Bedenli ürünlerde stok burada |
| gorseller | `https://...jpg\|https://...jpg` | İlki ana görsel |
| ozellikler | `Kalınlık=5mm\|Cinsiyet=Erkek` | Ürün sayfasında tablo olarak çıkar |
| one_cikan / aktif | `evet` / `hayir` | **Aktif için fiyat > 0 ve en az 1 görsel zorunlu** |

3. Kaydederken **CSV UTF-8 (virgül/noktalı virgülle ayrılmış)** seçin.
4. Önce deneyin, sonra uygulayın:
```bash
npm run catalog:import -- data/katalog-sablonu.csv
```
```bash
npm run catalog:import -- data/katalog-sablonu.csv --apply
```
5. Mevcut ürünleri düzenlemek için: `npm run catalog:export` → oluşan dosyayı düzenleyin → aynı şekilde içe aktarın. **Boş hücre = değiştirme**, yani yanlışlıkla stok silinmez. Script hiçbir şey silmez.

> Komutlar `.env`'deki `MONGODB_URI` veritabanına yazar. Önce deneme modunun çıktısını okuyun.

## 5. Görseller: nereden, nasıl?

### Nereden?
1. **Tedarikçi / distribütör medya kiti (en iyi yol):** Mares, Cressi, Scubapro, Aqualung, Omer, Salvimar gibi markaların Türkiye distribütörleri, yetkili satıcılara ürün fotoğraflarını (genelde Google Drive / FTP / bayi portalı) verir. Bayilik anlaşmanızda **"görsel kullanım izni"** isteyin.
2. **Kendi çekimleriniz:** Telefon + beyaz fon kartonu + gün ışığı yeterli. Ön, yan, detay (fermuar, toka, taban), kullanım fotoğrafı. 1200×1200 px kare, sade arka plan.
3. ❌ **Başka sitelerden / Google Görseller'den kopyalamayın.** Fotoğraflar telif hakkıyla korunur. Hem hukuki risk taşır, hem iyzico/PayTR denetiminde sorun çıkarır.
4. ❌ Unsplash gibi stok fotoğraflar gerçek ürünü göstermediği için ürün görseli olarak **yanıltıcıdır** (şu anki demo verilerde bu durum var). Sadece banner/arka plan için kullanın.

### Nasıl yüklenir? → Cloudinary (ücretsiz katman, bakım gerektirmez)
Görseller sunucuda değil Cloudinary'de (CDN) saklanır. Render yeniden başlasa da kaybolmaz. Site, görseli her ekran için otomatik küçültür ve WebP/AVIF'e çevirir (`src/utils/img.js`).

1. https://cloudinary.com → ücretsiz hesap açın (bunu sizin yapmanız gerekiyor).
2. Dashboard → **Cloud name**, **API Key**, **API Secret** değerlerini kopyalayın.
3. Render → Environment (ve yerelde `.env`):
```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=aqualora/urunler
```
4. Admin panel → ürün düzenle → **📷 Bilgisayardan yükle** → birden fazla foto seçin. Adresler kutuya otomatik eklenir → Kaydet.

Güvenlik: API secret tarayıcıya hiç gitmez. Sunucu, sadece adminlere kısa ömürlü bir imza verir ve dosya doğrudan Cloudinary'ye yüklenir.

**Excel ile toplu yükleme için:** Cloudinary panelinde **Media Library → Upload** ile klasör halinde yükleyin. Her görselin "Copy URL" adresini CSV'deki `gorseller` sütununa yapıştırın. Dosyaları SKU ile adlandırırsanız (`ELB-003-1.jpg`) eşleştirmek kolaylaşır.
