/**
 * Mevcut ürünleri Excel'de düzenlenebilir CSV'ye aktarır (içe aktarma ile aynı format).
 *   npm run catalog:export            → data/katalog-YYYY-MM-DD.csv
 * Düzenledikten sonra: npm run catalog:import -- data/katalog-YYYY-MM-DD.csv --apply
 */
import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product.js';
import { toCsv, formatVariants, formatSpecs } from './catalog-csv.js';

if (!process.env.MONGODB_URI) { console.error('MONGODB_URI tanımlı değil (.env).'); process.exit(1); }
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

const products = await Product.find().sort({ category: 1, subCategory: 1, name: 1 }).lean();
const rows = products.map(p => ({
    sku: p.sku || '',
    kategori: p.category || '',
    alt_kategori: p.subCategory || '',
    urun_adi: p.name,
    marka: p.brand || '',
    fiyat: String(p.price ?? '').replace('.', ','),
    stok: p.variants?.length ? '' : (p.stock ?? 0),
    bedenler: formatVariants(p.variants),
    gorseller: (p.images?.length ? p.images : (p.image ? [p.image] : [])).join('|'),
    video: p.video || '',
    aciklama: p.description || '',
    ozellikler: formatSpecs(p.specs),
    one_cikan: p.isFeatured ? 'evet' : 'hayir',
    aktif: p.active === false ? 'hayir' : 'evet'
}));
const noSku = rows.filter(r => !r.sku).length;
fs.mkdirSync('data', { recursive: true });
const out = `data/katalog-${new Date().toISOString().slice(0, 10)}.csv`;
fs.writeFileSync(out, toCsv(rows));
console.log(`✅ ${rows.length} ürün → ${out}`);
if (noSku) console.log(`ℹ️  ${noSku} üründe SKU yok; içe aktarırken ürün adıyla eşleşir. SKU eklemeniz önerilir.`);
await mongoose.disconnect();
