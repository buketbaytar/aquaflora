import { config } from '../config.js';

const tl = (n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

/**
 * Sıkça Sorulan Sorular — İŞLETME SAHİBİ BU DOSYAYI DÜZENLEYEREK chatbot yanıtlarını güncelleyebilir.
 * `keywords`: Türkçe karakterler sadeleştirilmiş (ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c), küçük harf.
 * Bir mesajda en çok anahtar kelimesi geçen kayıt seçilir.
 */
export function faqEntries() {
    const { flatFee, freeThreshold, estimatedDays, carrierName } = config.shipping;
    const shippingText = !flatFee
        ? 'Tüm siparişlerde kargo ücretsizdir.'
        : freeThreshold
            ? `Kargo ücreti ${tl(flatFee)}; ${tl(freeThreshold)} ve üzeri siparişlerde kargo ücretsizdir.`
            : `Kargo ücreti ${tl(flatFee)}'dir.`;

    const methods = [];
    if (config.payment.methods.includes('card')) methods.push('kredi/banka kartı (iyzico güvencesiyle, 3D Secure; uygun kartlarda 2-9 taksit)');
    if (config.payment.methods.includes('bank_transfer')) methods.push(`havale/EFT (ödemenin ${config.payment.bankReservationHours} saat içinde yapılması gerekir)`);

    return [
        {
            key: 'shipping',
            title: 'Kargo ücreti ve süresi',
            keywords: ['kargo', 'teslimat', 'gonderim', 'ne zaman gelir', 'kac gunde', 'ucretsiz kargo', 'kargo ucreti'],
            answer: `${shippingText} Siparişler ödeme onayından sonra ${estimatedDays} içinde ${carrierName} ile kargoya verilir. Kargoya verildiğinde takip numarası e-posta ile gönderilir.`
        },
        {
            key: 'returns',
            title: 'İade ve değişim koşulları',
            keywords: ['iade sartlari', 'iade kosul', 'kac gun', 'cayma', 'iade suresi', 'degisim kosul'],
            answer: 'Ürünü teslim aldığınız tarihten itibaren 14 gün içinde cayma hakkınızı kullanarak iade edebilirsiniz. Ürün kullanılmamış ve orijinal ambalajında olmalıdır. Hijyen bandı açılmış mayo, bikini, silikonlu maske gibi ürünler iade alınamaz. İade onaylandıktan sonra ödeme, en geç 14 gün içinde ödeme yaptığınız yönteme iade edilir.',
            links: [{ label: 'İade koşullarının tamamı', href: '/iade-kosullari.html' }]
        },
        {
            key: 'payment',
            title: 'Ödeme yöntemleri ve taksit',
            keywords: ['odeme', 'taksit', 'kredi karti', 'havale', 'eft', 'kapida', 'banka karti'],
            answer: methods.length ? `Ödeme yöntemlerimiz: ${methods.join('; ')}. Kapıda ödeme seçeneğimiz bulunmamaktadır.` : 'Ödeme seçenekleri yakında aktif olacaktır.'
        },
        {
            key: 'size',
            title: 'Beden seçimi',
            keywords: ['beden', 'olcu', 'numara', 'kalip', 'buyuk mu', 'kucuk mu', 'hangi beden'],
            answer: 'Ürün sayfasında stokta olan bedenler ve adetleri listelenir. Emin olamazsanız boy-kilo bilginizle "Canlı desteğe bağlan" seçeneğini kullanın, ekibimiz size uygun bedeni önersin. Beden uymazsa 14 gün içinde "İade / Değişim" menüsünden değişim talebi oluşturabilirsiniz.'
        },
        {
            key: 'invoice',
            title: 'Fatura',
            keywords: ['fatura', 'kurumsal', 'vergi', 'e-arsiv', 'e arsiv'],
            answer: 'Tüm siparişler için e-arşiv fatura düzenlenir ve e-posta adresinize gönderilir. Kurumsal fatura için ödeme adımında "Kurumsal" seçeneğini işaretleyip firma bilgilerinizi girebilirsiniz.'
        },
        {
            key: 'warranty',
            title: 'Garanti',
            keywords: ['garanti', 'arizali', 'bozuk', 'kusurlu', 'servis'],
            answer: 'Ürünlerimiz üretici/ithalatçı garantisi kapsamındadır (elektronik ürünlerde en az 2 yıl). Kusurlu ürün teslim aldıysanız "İade / Değişim" menüsünden talep oluşturun; fotoğraf talep edip en kısa sürede dönüş yapıyoruz.'
        },
        {
            key: 'contact',
            title: 'İletişim',
            keywords: ['iletisim', 'telefon', 'adres', 'magaza', 'e-posta', 'mail', 'calisma saat'],
            answer: [
                `Müşteri hizmetleri: ${config.support.hours}.`,
                config.support.phone && `Telefon: ${config.support.phone}`,
                config.support.email && `E-posta: ${config.support.email}`
            ].filter(Boolean).join(' ')
        },
        {
            key: 'account',
            title: 'Üyelik ve şifre',
            keywords: ['sifre', 'sifremi unuttum', 'uyelik', 'hesap', 'giris yapamiyorum'],
            answer: 'Giriş penceresindeki "Şifremi unuttum" bağlantısıyla e-postanıza sıfırlama bağlantısı gönderebilirsiniz. Üye olmadan da alışveriş yapabilir, siparişinizi sipariş numarası ve e-posta adresinizle takip edebilirsiniz.'
        }
    ];
}
