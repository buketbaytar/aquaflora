# Veritabanı Mimarisi ve Veri Saklama Planı

## 1. Öneri: MongoDB Atlas'ta kalın (taşımayın)

| Seçenek | Aylık maliyet (başlangıç) | Bakım | Bu proje için |
|---|---|---|---|
| **MongoDB Atlas** (mevcut) | **M0: ücretsiz** (512 MB) → Flex: ~8–30 $ | Yedek, güncelleme, ölçekleme yönetilir | ✅ **Kod zaten Mongoose ile yazılı; taşıma maliyeti sıfır** |
| Supabase / Neon (PostgreSQL) | Ücretsiz katman → 19–25 $ | Yönetilen | Tüm modellerin SQL'e yeniden yazılması gerekir (2–4 hafta iş) |
| Firebase Firestore | Kullanım başına | Yönetilen | Sorgu modeli e-ticaret raporlamasına uygun değil, vendor lock-in |
| Gömülü (SQLite) | 0 | Yedek/kalıcı disk sizde | Render free'de disk kalıcı değil → veri kaybı riski |

**Karar:** Küçük bir işletme için en düşük bakım + en düşük geçiş maliyeti, mevcut **MongoDB Atlas**'ı kullanmaya devam etmektir.

Pratik ayarlar:
- **Bölge:** `Frankfurt (eu-central-1)` — Türkiye'ye en yakın; KVKK yurt dışı aktarım beyanınızda bu bölgeyi belirtin.
- **Plan:** Başlangıçta **M0 (ücretsiz)**. M0'da otomatik yedek **yoktur** → ilk satıştan itibaren **Flex** veya **M10**'a geçin ya da haftalık `mongodump` alın (aşağıda).
- **Kullanıcı:** Uygulama için sadece `readWrite` yetkili ayrı bir DB kullanıcısı oluşturun.
- **Ağ erişimi:** Render free planda sabit IP yok → `0.0.0.0/0` gerekli; bu yüzden **güçlü, uzun bir DB şifresi** şarttır. Render ücretli planda "Static Outbound IP" ile sadece o IP'yi açabilirsiniz.

## 2. Mevcut durum → yeni durum

| Veri | Önce | Şimdi |
|---|---|---|
| Ürün | `products` + statik `src/data/products.js` (çift kaynak) | Tek kaynak `products`; statik dosya sadece boş DB'ye **demo** yükleme için |
| Sepet | Sadece üyeler, `productId: Number` (hatalı) | Üye: `carts` (`product: ObjectId`); Misafir: tarayıcı `localStorage`, girişte birleştirilir |
| Sipariş | Adres/fatura/durum geçmişi yok | `orders` — sipariş no, adres, fatura, ödeme, durum geçmişi, kargo, yasal onay ispatı |
| Chat | Hiç saklanmıyordu | `chatconversations` — 180 gün sonra otomatik silinir (TTL index) |
| Destek/iade | Yok | `supporttickets` |
| Oturum | İmzalı çerez | Aynı (sunucuda oturum tablosu gerekmez → bakım yok) |

## 3. Şema (ER diyagramı)

```mermaid
erDiagram
    USER ||--o| CART : "1 sepet"
    USER ||--o{ ORDER : "verir (misafirde boş)"
    USER }o--o{ PRODUCT : "favorites[]"
    USER ||--o{ CHAT_CONVERSATION : "sahibi (misafirde boş)"
    USER ||--o{ SUPPORT_TICKET : "açar"
    CATEGORY ||--o{ SUBCATEGORY : "içerir"
    CATEGORY ||--o{ PRODUCT : "categoryId"
    SUBCATEGORY ||--o{ PRODUCT : "subCategoryId"
    BRAND ||--o{ PRODUCT : "brandId"
    CART ||--|{ CART_ITEM : "items[] (gömülü)"
    CART_ITEM }o--|| PRODUCT : "product"
    ORDER ||--|{ ORDER_ITEM : "items[] (gömülü, fiyat anlık görüntü)"
    ORDER_ITEM }o--|| PRODUCT : "product"
    CHAT_CONVERSATION ||--|{ CHAT_MESSAGE : "messages[] (gömülü, son 200)"
    SUPPORT_TICKET }o--o| CHAT_CONVERSATION : "conversationId"
    SUPPORT_TICKET }o--o| ORDER : "orderNumber"

    USER { ObjectId _id; string email UK; string passwordHash; string name; string phone; bool isAdmin; date kvkkAcknowledgedAt; object marketingConsent; string resetPasswordTokenHash; date resetPasswordExpires }
    PRODUCT { ObjectId _id; string name; string slug; number price; number stock; array variants "size, stock"; bool active; bool isFeatured; number views; ObjectId categoryId; ObjectId brandId }
    CATEGORY { ObjectId _id; string name UK; string slug UK }
    SUBCATEGORY { ObjectId _id; string name; string slug; ObjectId categoryId }
    BRAND { ObjectId _id; string name UK; string slug UK }
    CART { ObjectId userId UK; date updatedAt; date reminderSentAt }
    CART_ITEM { ObjectId product; string selectedVariant; number quantity }
    ORDER { string orderNumber UK; ObjectId userId; object customer; object shippingAddress; object billing; number subtotal; number shippingFee; number totalAmount; string paymentMethod; object payment; string status; array statusHistory; object shipment; object consents; date reservationExpiresAt; bool stockReleased }
    ORDER_ITEM { ObjectId product; string name; number price; string selectedVariant; number quantity; number lineTotal }
    CHAT_CONVERSATION { string sessionKey; ObjectId userId; string status; mixed pending; string verifiedEmail; date lastMessageAt "TTL" }
    CHAT_MESSAGE { string role; string text; array quickReplies; array products; array links; date at }
    SUPPORT_TICKET { string ticketNumber UK; string type; string status; string email; string phone; string orderNumber; string reason; string message }
```

### Tasarım kararları
- **Sipariş kalemleri gömülü ve fiyat "anlık görüntü"**: ürün fiyatı sonradan değişse de sipariş tutarı değişmez (yasal zorunluluk).
- **Stok ürün dokümanında**: `variants[].stock` ve `stock` alanları koşullu `$inc` ile atomik düşer (`server/services/orders.js → reserveStock`). Transaction gerektirmez; Atlas M0'da çalışır.
- **Sipariş durum makinesi:** `pending_payment → paid → preparing → shipped → delivered` / `cancelled`, `payment_failed`, `refund_requested`, `refunded`. İptal/iade durumlarında stok **otomatik ve bir kez** geri eklenir (`stockReleased`).
- **Chat mesajları gömülü:** küçük işletme hacminde ayrı koleksiyondan daha basit; son 200 mesaj tutulur, 180 gün işlem görmeyen konuşma otomatik silinir.

### İndeksler (uygulama açılışında otomatik oluşur)
`users.email` (unique) · `products.active, categoryId, slug, text(name, brand, …)` · `products.id` (sparse unique — eski seed ID) · `carts.userId` (unique), `carts.updatedAt` · `orders.orderNumber` (unique), `userId`, `status`, `customer.email`, `payment.token`, `reservationExpiresAt` · `chatconversations.sessionKey, userId, lastMessageAt (TTL)` · `supporttickets.ticketNumber` (unique), `status`

### Otomatik geçişler (`server/db.js → migrate()`)
- Eski `products.id_1` index'i sparse değilse yeniden oluşturulur (aksi halde admin panelden **ikinci ürün eklenemiyordu**).
- Slug'ı olmayan ürünlere slug eklenir.
- Eski sepetlerdeki sayısal `productId`'ler okunurken `product` (ObjectId) alanına çevrilir.

## 4. Yedekleme (M0 kullanıyorsanız zorunlu)

Atlas M0 otomatik yedek almaz. Haftada bir kendi bilgisayarınızda:

```bash
mongodump --uri="mongodb+srv://KULLANICI:SIFRE@cluster0.xxxxx.mongodb.net/aqualora" --out=yedek-$(date +%F)
```

Geri yükleme: `mongorestore --uri="..." yedek-YYYY-MM-DD/`
(MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools)

## 5. Veri saklama süreleri (KVKK)
| Veri | Süre | Nasıl |
|---|---|---|
| Sipariş + fatura bilgisi | 10 yıl (VUK/TTK) | Silinmez; hesap silinse de siparişte kalır |
| Chat kayıtları | 180 gün | TTL index, `CHAT_RETENTION_DAYS` |
| Sepet | Hesap aktif olduğu sürece | — |
| Şifre sıfırlama token'ı | 1 saat | Hash olarak saklanır |
| Sözleşme onayı ispatı (IP, zaman) | Sipariş ile birlikte | `orders.consents` |
