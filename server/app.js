import express from 'express';
import cors from 'cors';
import cookieSession from 'cookie-session';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { config, isProduction } from './config.js';
import { securityHeaders, csrfProtection, issueCsrfToken, loadUser, limits, corsOptions, errorHandler, requireAdmin } from './middleware/security.js';
import authRoutes from './routes/auth.js';
import shopRoutes from './routes/shop.js';
import orderRoutes from './routes/orders.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import { seoRouter } from './routes/seo.js';

const MAINTENANCE_HTML = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta http-equiv="refresh" content="30"><title>Kısa bir bakımdayız</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#001220;color:#e6f9ff;font-family:system-ui,sans-serif;text-align:center;padding:24px}
h1{color:#00f2ff;font-size:1.6rem}p{opacity:.8;max-width:420px}</style></head>
<body><main><div style="font-size:3rem">🌊</div><h1>Kısa bir bakım çalışması yapıyoruz</h1>
<p>Sitemiz birkaç dakika içinde tekrar hizmetinizde olacak. Bu sayfa kendini otomatik yeniler.</p></main></body></html>`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

// Tarayıcıdan CSRF token'sız gelmesi beklenen POST uçları
const CSRF_EXEMPT = new Set(['/payment/iyzico/callback', '/products/view']);

export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1); // Render / Cloudflare arkasında gerçek IP ve HTTPS bilgisi için

    app.use(securityHeaders);
    // Taslak modda arama motorları siteyi indekslemez
    if (!config.isLive) app.use((req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); next(); });

    // Sağlık kontrolü (Render health check ve uptime izleme) — oturum/CSRF gerektirmez.
    // DB kopsa bile 200 döner: süreç ayakta kalır ve ziyaretçiye bakım sayfası gösterilir (Render çökme döngüsüne girmez).
    app.get('/health', (req, res) => {
        res.set('Cache-Control', 'no-store').json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down', mode: config.storeMode });
    });

    // Eski adres → yeni adres (SEO için kalıcı yönlendirme)
    app.get('/urunler.html', (req, res) => {
        const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
        res.redirect(301, `/urunler${qs}`);
    });

    // Statik dosyalar: hash'li varlıklar 1 yıl cache, HTML cache'lenmez
    app.use('/assets', express.static(path.join(DIST, 'assets'), { immutable: true, maxAge: '1y', index: false }));
    app.use(express.static(DIST, { index: false, maxAge: '1h' }));
    app.use(express.static(path.join(ROOT, 'public'), { index: false, maxAge: '1h' }));

    app.use(express.json({ limit: '100kb' }));
    app.use(express.urlencoded({ extended: false, limit: '20kb' }));

    // Veritabanı bağlantısı yokken: API 503, sayfalar bakım ekranı (statik dosyalar ve sağlık kontrolü hariç)
    app.use((req, res, next) => {
        if (mongoose.connection.readyState === 1) return next();
        res.set('Retry-After', '30');
        if (req.path.startsWith('/api/')) return res.status(503).json({ error: 'Kısa bir bakım çalışması yapıyoruz. Lütfen birkaç dakika sonra tekrar deneyin.' });
        return res.status(503).type('html').send(MAINTENANCE_HTML);
    });

    app.use(cookieSession({
        name: 'aqua_session',
        keys: [config.sessionSecret],
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 gün (sepet/chat geçmişi için)
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax'
    }));

    // API
    const api = express.Router();
    api.use(cors(corsOptions()));
    api.use(limits.api);
    api.use(loadUser);
    api.get('/csrf-token', (req, res) => res.set('Cache-Control', 'no-store').json({ csrfToken: issueCsrfToken(req) }));
    api.use((req, res, next) => {
        const normalized = req.path.replace(/^\/products\/[^/]+\/view$/, '/products/view');
        return CSRF_EXEMPT.has(normalized) ? next() : csrfProtection(req, res, next);
    });
    api.use(authRoutes);
    api.use(shopRoutes);
    api.use(orderRoutes);
    api.use(chatRoutes);
    api.use(adminRoutes);
    api.use((req, res) => res.status(404).json({ error: 'API uç noktası bulunamadı' }));
    app.use('/api', api);

    // Admin paneline kısa yol (sadece adminler)
    app.get('/admin', loadUser, requireAdmin, (req, res) => res.redirect('/kaptan_kosku_881.html'));

    // SEO + SPA fallback
    app.use(seoRouter(DIST));

    app.use((req, res) => res.status(404).type('text/plain').send('Bulunamadı'));
    app.use(errorHandler);
    return app;
}
