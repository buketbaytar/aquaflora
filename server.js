/**
 * Aqualora — sunucu giriş noktası.
 * Tek servis: API + derlenmiş frontend (dist/) aynı origin'den sunulur → CORS/çerez sorunları olmaz.
 * Kod yapısı:
 *   server/config.js        ortam değişkenleri ve doğrulama
 *   server/app.js           Express uygulaması ve middleware sırası
 *   server/routes/*         API uç noktaları
 *   server/services/*       sepet, sipariş, stok, katalog iş mantığı
 *   server/chat/*           müşteri asistanı (kural tabanlı)
 *   server/payments/*       ödeme sağlayıcıları (iyzico)
 *   server/jobs.js          zamanlanmış işler (rezervasyon süresi, sepet hatırlatma)
 */
import { config, validateConfig } from './server/config.js';
import { connectDb, migrate, seedCatalogIfEmpty, ensureAdmin } from './server/db.js';
import { createApp } from './server/app.js';
import { startJobs } from './server/jobs.js';

process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));

/** DB'ye bağlanana kadar arka planda tekrar dener; bu sürede site bakım sayfası gösterir (çökmez). */
async function connectWithRetry() {
    for (let attempt = 1; ; attempt++) {
        try {
            await connectDb();
            await migrate();
            await seedCatalogIfEmpty();
            await ensureAdmin();
            if (process.env.DISABLE_JOBS !== 'true') startJobs();
            return;
        } catch (e) {
            const wait = Math.min(60, 5 * attempt);
            console.error(`❌ MongoDB bağlantısı başarısız (deneme ${attempt}): ${String(e.message).split('\n')[0]}`);
            if (attempt === 1) console.error('   → Atlas panelinde cluster duraklatılmış (Paused) mı ve Network Access 0.0.0.0/0 açık mı kontrol edin.');
            await new Promise(r => setTimeout(r, wait * 1000));
        }
    }
}

async function main() {
    validateConfig();

    const app = createApp();
    const server = app.listen(config.port, () => {
        console.log(`🚀 ${config.siteName} http://localhost:${config.port} (${config.isProduction ? 'production' : 'development'})`);
        console.log(`   Mağaza modu: ${config.storeMode === 'live' ? 'SATIŞA AÇIK' : 'TASLAK (sipariş kapalı, noindex)'} · Ödeme: ${config.payment.methods.join(', ')}`);
    });
    connectWithRetry();

    const shutdown = (sig) => {
        console.log(`${sig} alındı, kapatılıyor...`);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

main().catch((e) => {
    console.error('❌ Başlatılamadı:', e.message);
    process.exit(1);
});
