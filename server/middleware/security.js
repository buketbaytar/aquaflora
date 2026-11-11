import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { config, isProduction } from '../config.js';
import { User } from '../../src/models/User.js';
import { HttpError, unauthorized, forbidden } from '../lib/validate.js';

/* ---------------- Güvenlik başlıkları (helmet'in ihtiyacımız olan kısmı) ---------------- */
const CSP = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    // Admin paneli satır içi onclick kullanıyor; kaldırılınca 'unsafe-inline' çıkarılabilir
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https:",
    "connect-src 'self' https://api.cloudinary.com",
    // iyzico Ortak Ödeme Sayfası'na yönlendirme + 3D Secure dönüşü
    "form-action 'self' https://*.iyzipay.com https://*.iyzico.com",
    "frame-src 'self' https://*.iyzipay.com https://*.iyzico.com"
].join('; ');

export function securityHeaders(req, res, next) {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.removeHeader('X-Powered-By');
    next();
}

/* ---------------- CSRF (senkronize token deseni, oturum çerezinde saklanır) ---------------- */
export function issueCsrfToken(req) {
    if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('base64url');
    return req.session.csrf;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();
    const sent = req.get('x-csrf-token') || req.get('csrf-token') || req.body?._csrf || '';
    const expected = req.session?.csrf || '';
    const ok = sent && expected && sent.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
    if (!ok) {
        return res.status(403).json({ error: 'Oturum doğrulaması başarısız. Lütfen sayfayı yenileyin.', code: 'EBADCSRFTOKEN' });
    }
    next();
}

/* ---------------- Kimlik ---------------- */
export async function loadUser(req, res, next) {
    req.user = null;
    const id = req.session?.userId;
    if (id) {
        try {
            req.user = await User.findById(id).select('-passwordHash -resetPasswordTokenHash');
            if (!req.user) req.session.userId = undefined;
        } catch {
            req.user = null;
        }
    }
    next();
}

export const requireUser = (req, res, next) => (req.user ? next() : next(unauthorized()));
export const requireAdmin = (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!req.user.isAdmin) return next(forbidden('Yönetici yetkisi gerekli'));
    next();
};

/* ---------------- Rate limit ---------------- */
const limiter = (windowMin, max, message) => rateLimit({
    windowMs: windowMin * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message }
});

export const limits = {
    api: limiter(1, 300, 'Çok fazla istek. Lütfen biraz bekleyin.'),
    auth: limiter(15, 20, 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.'),
    passwordReset: limiter(60, 5, 'Çok fazla şifre sıfırlama isteği. Daha sonra deneyin.'),
    order: limiter(10, 15, 'Çok fazla sipariş denemesi. Lütfen biraz bekleyin.'),
    chat: limiter(1, 30, 'Çok hızlı mesaj gönderiyorsunuz.'),
    lookup: limiter(15, 30, 'Çok fazla sorgu. Lütfen biraz bekleyin.')
};

/* ---------------- CORS (yalnızca ayrı origin'den erişim gerekiyorsa) ---------------- */
export function corsOptions() {
    return {
        origin(origin, cb) {
            if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true);
            return cb(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-CSRF-Token']
    };
}

/* ---------------- Hata yöneticisi ---------------- */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
    if (err instanceof HttpError || err.expose) {
        return res.status(err.status || 400).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    }
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'İstek çok büyük' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Geçersiz JSON' });
    if (err.name === 'CastError') return res.status(400).json({ error: 'Geçersiz kimlik' });
    if (err.name === 'ValidationError') return res.status(400).json({ error: 'Geçersiz veri' });
    if (err.code === 11000) return res.status(409).json({ error: 'Bu kayıt zaten mevcut' });

    console.error(`❌ ${req.method} ${req.path}:`, err);
    res.status(500).json({ error: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' });
}
