import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { Product } from '../../src/models/Product.js';
import { Category } from '../../src/models/Category.js';
import { config } from '../config.js';
import { findProduct, toPublicProduct } from '../services/catalog.js';
import { slugify } from '../lib/validate.js';

/**
 * SEO yardımcıları:
 *  - /robots.txt, /sitemap.xml (veritabanından dinamik)
 *  - SPA fallback: index.html'e sayfa bazlı <title>, description, canonical, Open Graph ve JSON-LD enjekte edilir.
 *    Böylece Google, WhatsApp/Instagram önizlemeleri JS çalıştırmadan doğru bilgiyi görür (SSR'sız düşük maliyetli çözüm).
 */
export function seoRouter(distDir) {
    const router = Router();
    const indexPath = path.join(distDir, 'index.html');
    let template = null;
    const getTemplate = () => {
        if (!template || !config.isProduction) {
            template = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : null;
        }
        return template;
    };

    router.get('/robots.txt', (req, res) => {
        // Taslak modda tüm site arama motorlarına kapalı
        if (!config.isLive) return res.type('text/plain').send('User-agent: *\nDisallow: /\n');
        res.type('text/plain').send([
            'User-agent: *',
            'Allow: /',
            'Disallow: /api/',
            'Disallow: /sepet',
            'Disallow: /odeme',
            'Disallow: /hesabim',
            'Disallow: /sifre-sifirla',
            'Disallow: /kaptan_kosku_881.html',
            `Sitemap: ${config.publicUrl}/sitemap.xml`
        ].join('\n'));
    });

    router.get('/sitemap.xml', async (req, res) => {
        const [products, cats] = await Promise.all([
            Product.find({ active: true }).select('_id name slug createdAt').lean(),
            Category.find().select('_id').lean()
        ]);
        const u = (loc, lastmod, priority) => `<url><loc>${config.publicUrl}${loc}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${priority}</priority></url>`;
        const urls = [
            u('/', null, '1.0'),
            u('/urunler', null, '0.9'),
            ...cats.map(c => u(`/urunler?category=${c._id}`, null, '0.8')),
            ...products.map(p => u(productPath(p), p.createdAt, '0.7')),
            u('/iade-kosullari.html', null, '0.3'),
            u('/sozlesme.html', null, '0.3'),
            u('/kvkk.html', null, '0.3')
        ];
        res.type('application/xml').set('Cache-Control', 'public, max-age=3600')
            .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('').replace(/&/g, '&amp;')}</urlset>`);
    });

    // SPA fallback (API ve dosya istekleri hariç)
    router.get(/^\/(?!api\/).*/, async (req, res, next) => {
        if (path.extname(req.path)) return next(); // .js/.css/.png vs. bulunamadıysa 404'e düşsün
        const html = getTemplate();
        if (!html) return res.status(503).send('Uygulama derlenmemiş. `npm run build` çalıştırın.');

        let meta = {
            title: `${config.siteName} | Dalış, Yüzme ve Outdoor Ekipmanları`,
            description: 'Tüplü dalış, serbest dalış, yüzme ve outdoor ekipmanlarında güvenli alışveriş. Hızlı kargo, kolay iade.',
            canonical: `${config.publicUrl}${req.path === '/' ? '/' : req.path}`,
            image: null,
            jsonLd: { '@context': 'https://schema.org', '@type': 'Organization', name: config.siteName, url: config.publicUrl },
            noindex: !config.isLive || /^\/(sepet|odeme|hesabim|sifre-sifirla|odeme-sonuc|siparis-takip)/.test(req.path),
            status: 200
        };

        const m = req.path.match(/^\/urun\/(?:.*-)?([a-f0-9]{24})$/i) || req.path.match(/^\/urun\/([^/]+)$/);
        if (m) {
            const p = await findProduct(m[1]).catch(() => null);
            if (!p) meta = { ...meta, title: `Ürün bulunamadı | ${config.siteName}`, noindex: true, status: 404 };
            else {
                const pp = toPublicProduct(p);
                const desc = (pp.description || `${pp.brand} ${pp.name}. ${pp.category} kategorisinde, ${pp.price.toLocaleString('tr-TR')} TL.`).slice(0, 160);
                meta = {
                    ...meta,
                    noindex: !config.isLive,
                    title: `${pp.name} | ${config.siteName}`,
                    description: desc,
                    canonical: `${config.publicUrl}${productPath(p)}`,
                    image: pp.image,
                    type: 'product',
                    jsonLd: {
                        '@context': 'https://schema.org/',
                        '@type': 'Product',
                        name: pp.name,
                        image: pp.image ? [pp.image] : undefined,
                        description: desc,
                        sku: pp.id,
                        brand: pp.brand ? { '@type': 'Brand', name: pp.brand } : undefined,
                        offers: {
                            '@type': 'Offer',
                            url: `${config.publicUrl}${productPath(p)}`,
                            priceCurrency: 'TRY',
                            price: pp.price.toFixed(2),
                            availability: pp.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                            itemCondition: 'https://schema.org/NewCondition'
                        }
                    }
                };
            }
        } else if (req.path === '/urunler' || req.path === '/urunler.html') {
            meta.title = `Tüm Ürünler | ${config.siteName}`;
            meta.canonical = `${config.publicUrl}/urunler`;
        }

        res.status(meta.status).set('Cache-Control', 'no-cache').type('html').send(injectMeta(html, meta));
    });

    return router;
}

export const productPath = (p) => `/urun/${p.slug || slugify(p.name)}-${p._id}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function injectMeta(html, m) {
    const tags = [
        `<title>${esc(m.title)}</title>`,
        `<meta name="description" content="${esc(m.description)}">`,
        `<link rel="canonical" href="${esc(m.canonical)}">`,
        m.noindex ? '<meta name="robots" content="noindex, nofollow">' : '',
        `<meta property="og:site_name" content="${esc(config.siteName)}">`,
        `<meta property="og:type" content="${m.type || 'website'}">`,
        `<meta property="og:title" content="${esc(m.title)}">`,
        `<meta property="og:description" content="${esc(m.description)}">`,
        `<meta property="og:url" content="${esc(m.canonical)}">`,
        `<meta property="og:locale" content="tr_TR">`,
        m.image ? `<meta property="og:image" content="${esc(m.image)}">` : '',
        `<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}">`,
        // JSON-LD içinde </script> kaçışı
        `<script type="application/ld+json" id="json-ld">${JSON.stringify(m.jsonLd).replace(/</g, '\\u003c')}</script>`
    ].filter(Boolean).join('\n    ');

    return html
        .replace(/<title>[\s\S]*?<\/title>/i, '')
        .replace(/<meta\s+name="description"[^>]*>/i, '')
        .replace('</head>', `    ${tags}\n  </head>`);
}
