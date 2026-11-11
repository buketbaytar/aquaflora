/**
 * Excel/CSV'den toplu ürün ve kategori içe aktarma.
 *
 *   npm run catalog:import -- data/katalog-sablonu.csv           → DENEME: hiçbir şey yazmaz, ne yapılacağını gösterir
 *   npm run catalog:import -- data/katalog-sablonu.csv --apply   → veritabanına yazar
 *
 * Kurallar:
 *  - Ürünler `sku` ile eşleştirilir (yoksa ürün adıyla). Var olan ürün güncellenir, yoksa oluşturulur.
 *  - BOŞ hücre = o alana dokunma (yeniden içe aktarmak stok/fiyatı silmez).
 *  - `aktif=evet` olabilmesi için fiyat > 0 ve en az 1 görsel gerekir; yoksa ürün pasif kalır (uyarı verilir).
 *  - Kategori / alt kategori / marka yoksa oluşturulur. Hiçbir şey SİLİNMEZ.
 */
import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.js';
import { Category } from '../src/models/Category.js';
import { SubCategory } from '../src/models/SubCategory.js';
import { Brand } from '../src/models/Brand.js';
import { slugify } from '../server/lib/validate.js';
import { parseCsv, parsePrice, parseVariants, parseSpecs, parseImages, yes } from './catalog-csv.js';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--')) || 'data/katalog-sablonu.csv';
const APPLY = args.includes('--apply');

if (!process.env.MONGODB_URI) { console.error('MONGODB_URI tanımlı değil (.env).'); process.exit(1); }
if (!fs.existsSync(file)) { console.error(`Dosya bulunamadı: ${file}`); process.exit(1); }

const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const host = (process.env.MONGODB_URI.split('@')[1] || '').split('/')[0];
console.log(`📄 ${file}: ${rows.length} satır`);
console.log(`🗄️  Veritabanı: ${host.replace(/^[^.]+/, '***')}`);
console.log(APPLY ? '✍️  UYGULAMA MODU — değişiklikler yazılacak\n' : '🔍 DENEME MODU — hiçbir şey yazılmayacak (yazmak için --apply)\n');

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

const stats = { created: 0, updated: 0, skipped: 0, newCats: new Set(), newSubs: new Set(), newBrands: new Set() };
const warnings = [];
const cache = { cat: new Map(), sub: new Map(), brand: new Map() };

let catOrder = 0;
async function ensureCategory(name) {
    const slug = slugify(name);
    if (cache.cat.has(slug)) return cache.cat.get(slug);
    const order = (++catOrder) * 10; // CSV'deki ilk görülme sırası = menü sırası
    let c = await Category.findOne({ $or: [{ slug }, { name }] });
    if (!c) {
        stats.newCats.add(name);
        c = APPLY ? await Category.create({ name, slug, order }) : { _id: new mongoose.Types.ObjectId(), name };
    } else if (APPLY && c.order !== order) {
        await Category.updateOne({ _id: c._id }, { $set: { order } });
    }
    cache.cat.set(slug, c);
    return c;
}
async function ensureSub(name, cat) {
    const slug = slugify(name);
    const key = `${cat._id}|${slug}`;
    if (cache.sub.has(key)) return cache.sub.get(key);
    let s = await SubCategory.findOne({ categoryId: cat._id, $or: [{ slug }, { name }] });
    if (!s) {
        stats.newSubs.add(`${cat.name} › ${name}`);
        s = APPLY ? await SubCategory.create({ name, slug, categoryId: cat._id }) : { _id: new mongoose.Types.ObjectId(), name };
    }
    cache.sub.set(key, s);
    return s;
}
async function ensureBrand(name) {
    const slug = slugify(name);
    if (cache.brand.has(slug)) return cache.brand.get(slug);
    let b = await Brand.findOne({ $or: [{ slug }, { name }] });
    if (!b) {
        stats.newBrands.add(name);
        b = APPLY ? await Brand.create({ name, slug }) : { _id: new mongoose.Types.ObjectId(), name };
    }
    cache.brand.set(slug, b);
    return b;
}

for (const r of rows) {
    const where = `satır ${r._line}${r.sku ? ` (${r.sku})` : ''}`;
    if (!r.urun_adi || !r.kategori) { warnings.push(`${where}: ürün adı ve kategori zorunlu — atlandı`); stats.skipped++; continue; }

    const cat = await ensureCategory(r.kategori);
    const sub = r.alt_kategori ? await ensureSub(r.alt_kategori, cat) : null;

    const existing = await Product.findOne(r.sku ? { sku: r.sku } : { name: r.urun_adi });
    const set = {};
    set.name = r.urun_adi;
    set.slug = slugify(r.urun_adi);
    if (r.sku) set.sku = r.sku;
    set.categoryId = cat._id; set.category = cat.name;
    if (sub) { set.subCategoryId = sub._id; set.subCategory = sub.name; }
    if (r.marka || !existing) {
        const b = await ensureBrand(r.marka || 'Markasız');
        set.brandId = b._id; set.brand = b.name;
    }
    const price = parsePrice(r.fiyat);
    if (price !== null) set.price = price; else if (!existing) set.price = 0;
    const variants = parseVariants(r.bedenler);
    if (variants) {
        set.variants = variants;
        set.stock = variants.reduce((s, v) => s + v.stock, 0);
    } else if (r.stok !== '') set.stock = Math.max(0, parseInt(r.stok, 10) || 0);
    else if (!existing) set.stock = 0;
    const images = parseImages(r.gorseller);
    if (images) { set.images = images; set.image = images[0] || ''; }
    if (r.gorseller && !images?.length) warnings.push(`${where}: görsel adresleri https:// ile başlamalı`);
    if (r.video) set.video = r.video;
    if (r.aciklama) set.description = r.aciklama;
    const specs = parseSpecs(r.ozellikler);
    if (specs) set.specs = specs;
    if (r.one_cikan) set.isFeatured = yes(r.one_cikan);

    if (r.aktif) {
        const finalPrice = set.price ?? existing?.price ?? 0;
        const finalImages = set.images ?? existing?.images ?? (existing?.image ? [existing.image] : []);
        if (yes(r.aktif) && (!(finalPrice > 0) || !finalImages.length)) {
            warnings.push(`${where}: "${r.urun_adi}" aktif yapılamadı — fiyat ve en az 1 görsel gerekli`);
            set.active = false;
        } else set.active = yes(r.aktif);
    } else if (!existing) set.active = false;

    if (existing) stats.updated++; else stats.created++;
    if (APPLY) {
        if (existing) await Product.updateOne({ _id: existing._id }, { $set: set }, { runValidators: true });
        else await Product.create(set);
    }
}

console.log(`Yeni ürün: ${stats.created} · Güncellenecek: ${stats.updated} · Atlanan: ${stats.skipped}`);
if (stats.newCats.size) console.log(`Yeni kategoriler: ${[...stats.newCats].join(', ')}`);
if (stats.newSubs.size) console.log(`Yeni alt kategoriler (${stats.newSubs.size}): ${[...stats.newSubs].join(' · ')}`);
if (stats.newBrands.size) console.log(`Yeni markalar: ${[...stats.newBrands].join(', ')}`);
if (warnings.length) console.log(`\n⚠️  Uyarılar (${warnings.length}):\n - ${warnings.join('\n - ')}`);
if (!APPLY) console.log('\nDeneme bitti. Uygulamak için aynı komutu --apply ile çalıştırın.');
else console.log('\n✅ İçe aktarma tamamlandı.');
await mongoose.disconnect();
