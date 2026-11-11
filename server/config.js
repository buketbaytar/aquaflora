import 'dotenv/config';

const env = process.env;
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const list = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);

export const isProduction = env.NODE_ENV === 'production';

const publicUrl = (env.PUBLIC_URL || env.CUSTOM_DOMAIN || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, '');

// Mağaza modu:
//   preview  → site gezilebilir, sipariş ALINMAZ, arama motorlarına kapalı (varsayılan — taslak/hazırlık dönemi)
//   live     → satış açık
const storeMode = ['live', 'preview'].includes(env.STORE_MODE) ? env.STORE_MODE : 'preview';

export const config = {
    isProduction,
    storeMode,
    isLive: storeMode === 'live',
    port: num(env.PORT, 3000),
    mongoUri: env.MONGODB_URI,
    sessionSecret: env.SESSION_SECRET,
    siteName: env.SITE_NAME || 'Aqualora',
    publicUrl,

    allowedOrigins: [
        publicUrl,
        ...list(env.FRONTEND_URL),
        ...list(env.CUSTOM_DOMAIN),
        ...list(env.EXTRA_ALLOWED_ORIGINS),
        ...(isProduction ? [] : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'])
    ].filter((v, i, a) => v && a.indexOf(v) === i),

    admin: {
        email: (env.ADMIN_EMAIL || '').trim().toLowerCase(),
        password: env.ADMIN_PASSWORD || '',
        notifyEmail: env.ADMIN_NOTIFY_EMAIL || env.ADMIN_EMAIL || ''
    },

    shipping: {
        // Sabit kargo ücreti (TL). 0 = her zaman ücretsiz
        flatFee: num(env.SHIPPING_FEE, 0),
        // Bu tutar ve üzeri siparişlerde kargo ücretsiz. 0 = eşik yok
        freeThreshold: num(env.FREE_SHIPPING_THRESHOLD, 0),
        carrierName: env.SHIPPING_CARRIER || 'Anlaşmalı kargo',
        estimatedDays: env.SHIPPING_ESTIMATE || '1-3 iş günü'
    },

    payment: {
        // Virgülle ayrılmış: card, bank_transfer
        methods: list(env.PAYMENT_METHODS || 'bank_transfer'),
        // card yöntemi için sağlayıcı: iyzico | test (test sadece geliştirmede)
        cardProvider: env.CARD_PROVIDER || 'iyzico',
        cardReservationMinutes: num(env.CARD_RESERVATION_MINUTES, 30),
        bankReservationHours: num(env.BANK_RESERVATION_HOURS, 48),
        bank: {
            name: env.BANK_NAME || '',
            accountHolder: env.BANK_ACCOUNT_HOLDER || '',
            iban: env.BANK_IBAN || ''
        },
        iyzico: {
            apiKey: env.IYZICO_API_KEY || '',
            secretKey: env.IYZICO_SECRET_KEY || '',
            baseUrl: env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
        }
    },

    mail: {
        resendApiKey: env.RESEND_API_KEY || '',
        from: env.MAIL_FROM || '',
        replyTo: env.MAIL_REPLY_TO || ''
    },

    support: {
        email: env.SUPPORT_EMAIL || '',
        phone: env.SUPPORT_PHONE || '',
        whatsapp: (env.SUPPORT_WHATSAPP || '').replace(/[^0-9]/g, ''),
        hours: env.SUPPORT_HOURS || 'Hafta içi 09:00-18:00'
    },

    cloudinary: {
        cloudName: env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: env.CLOUDINARY_API_KEY || '',
        apiSecret: env.CLOUDINARY_API_SECRET || '',
        folder: env.CLOUDINARY_FOLDER || 'aqualora/urunler'
    },

    lowStockThreshold: num(env.LOW_STOCK_THRESHOLD, 3),
    abandonedCartHours: num(env.ABANDONED_CART_HOURS, 24),
    chatRetentionDays: num(env.CHAT_RETENTION_DAYS, 180)
};

/** Prod ortamda eksik/zayıf ayarla açılmayı engeller. */
export function validateConfig() {
    const errors = [];
    if (!config.mongoUri) errors.push('MONGODB_URI tanımlı değil');
    if (isProduction) {
        if (!config.sessionSecret || config.sessionSecret.length < 32) {
            errors.push('SESSION_SECRET en az 32 karakter olmalı (ör: `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`)');
        }
        if (!env.PUBLIC_URL) errors.push('PUBLIC_URL tanımlı değil (ör: https://aqualora.shop)');
    }
    // Ödeme ayarları sadece satış açıkken zorunlu
    if (isProduction && config.isLive) {
        if (config.payment.methods.includes('card')) {
            if (config.payment.cardProvider === 'test') errors.push('CARD_PROVIDER=test canlıda kullanılamaz');
            if (config.payment.cardProvider === 'iyzico' && (!config.payment.iyzico.apiKey || !config.payment.iyzico.secretKey)) {
                errors.push('IYZICO_API_KEY / IYZICO_SECRET_KEY tanımlı değil');
            }
        }
        if (config.payment.methods.includes('bank_transfer') && !config.payment.bank.iban) {
            errors.push('Havale/EFT açık ama BANK_IBAN tanımlı değil');
        }
    }
    if (!config.sessionSecret) {
        // Geliştirmede rastgele anahtar: her yeniden başlatmada oturumlar düşer, bu beklenen davranış
        config.sessionSecret = (globalThis.crypto?.randomUUID?.() || String(Math.random())) + Date.now();
        console.warn('⚠️  SESSION_SECRET yok, geçici anahtar kullanılıyor (sadece geliştirme).');
    }
    if (errors.length) {
        const msg = 'Yapılandırma hatası:\n - ' + errors.join('\n - ');
        throw new Error(msg);
    }
}

/** Frontend'in bilmesi gereken, gizli olmayan ayarlar. */
export function publicConfig() {
    return {
        siteName: config.siteName,
        storeMode: config.storeMode,
        paymentMethods: config.payment.methods,
        shipping: {
            flatFee: config.shipping.flatFee,
            freeThreshold: config.shipping.freeThreshold,
            estimatedDays: config.shipping.estimatedDays
        },
        support: {
            email: config.support.email,
            phone: config.support.phone,
            whatsapp: config.support.whatsapp,
            hours: config.support.hours
        }
    };
}

export function shippingFeeFor(subtotal) {
    const { flatFee, freeThreshold } = config.shipping;
    if (!flatFee) return 0;
    if (freeThreshold && subtotal >= freeThreshold) return 0;
    return flatFee;
}
