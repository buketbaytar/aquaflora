/** Marka ve site ayarları — marka adını tek yerden değiştirin (VITE_SITE_NAME). */
export const SITE = {
    name: import.meta.env.VITE_SITE_NAME || 'Aqualora',
    tagline: 'Dalış, Yüzme ve Outdoor Ekipmanları',
    instagram: 'https://www.instagram.com/aquaaflora'
};

// Varsayılan: aynı origin (Express hem API'yi hem siteyi sunar). Ayrı bir API sunucusu kullanılıyorsa VITE_API_BASE_URL verin.
// Güvenlik ağı: yapılandırılan adres aynı site ise (www farkı dahil) veya localhost'ta geliştirme yapılıyorsa göreli yol kullanılır;
// böylece yerelde yanlışlıkla canlı API'ye istek atılmaz ve www/çıplak domain arasında çerez sorunu yaşanmaz.
function resolveApiBase() {
    const configured = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    if (!configured || typeof location === 'undefined') return '';
    try {
        const bare = (h) => h.replace(/^www\./, '');
        if (['localhost', '127.0.0.1'].includes(location.hostname)) return '';
        if (bare(new URL(configured).hostname) === bare(location.hostname)) return '';
    } catch { return ''; }
    return configured;
}
export const API_BASE = resolveApiBase();

/** Sunucudan gelen gizli olmayan ayarlar (kargo, ödeme yöntemleri, destek kanalları) */
export const runtime = {
    storeMode: 'live',
    paymentMethods: [],
    shipping: { flatFee: 0, freeThreshold: 0, estimatedDays: '' },
    support: {}
};
