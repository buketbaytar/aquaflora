import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { config } from './config.js';
import { Product } from '../src/models/Product.js';
import { Category } from '../src/models/Category.js';
import { SubCategory } from '../src/models/SubCategory.js';
import { Brand } from '../src/models/Brand.js';
import { User } from '../src/models/User.js';
import { slugify } from './lib/validate.js';

export async function connectDb() {
    if (mongoose.connection.readyState === 1) return;
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        family: 4
    });
    mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB bağlantısı koptu, yeniden deneniyor...'));
    mongoose.connection.on('reconnected', () => console.log('✅ MongoDB yeniden bağlandı'));
    console.log('✅ MongoDB bağlandı');
}

/** Tek seferlik, güvenli şema geçişleri (her açılışta çalışır, idempotent) */
export async function migrate() {
    // 1) Product.id benzersiz index'i sparse olmalı; aksi halde id'siz ikinci ürün eklenemez
    try {
        const idx = await Product.collection.indexes();
        const legacy = idx.find(i => i.name === 'id_1' && !i.sparse);
        if (legacy) {
            await Product.collection.dropIndex('id_1');
            console.log('🔧 products.id_1 index sparse olarak yeniden oluşturuluyor');
        }
        await Product.syncIndexes();
    } catch (e) {
        console.warn('Index geçişi uyarısı:', e.message);
    }

    // 2) Slug'ı olmayan ürünlere slug ekle
    const noSlug = await Product.find({ $or: [{ slug: { $exists: false } }, { slug: '' }] }).select('_id name').lean();
    for (const p of noSlug) await Product.updateOne({ _id: p._id }, { $set: { slug: slugify(p.name) } });
    if (noSlug.length) console.log(`🔧 ${noSlug.length} ürüne slug eklendi`);
}

/** Boş veritabanına örnek katalog yükler (sadece kategoriler boşsa) */
export async function seedCatalogIfEmpty() {
    if (await Category.countDocuments()) return;
    if (config.isProduction && process.env.SEED_DEMO_DATA !== 'true') {
        console.log('ℹ️  Katalog boş. Demo veri yüklemek için SEED_DEMO_DATA=true ayarlayın veya admin panelden ürün ekleyin.');
        return;
    }
    const { products: seedProducts, categories } = await import('../src/data/products.js');
    console.log('📦 Demo katalog yükleniyor...');
    const catMap = {}, subMap = {};
    for (const c of categories) {
        const cat = await Category.create({ name: c.title, slug: slugify(c.title) });
        catMap[c.title] = cat._id;
        for (const s of c.sub) {
            const sub = await SubCategory.create({ name: s, slug: slugify(s), categoryId: cat._id });
            subMap[`${c.title}|${s}`] = sub._id;
        }
    }
    for (const p of seedProducts) {
        const brandName = p.brand || 'Genel';
        let brand = await Brand.findOne({ slug: slugify(brandName) });
        if (!brand) brand = await Brand.create({ name: brandName, slug: slugify(brandName) });
        const price = typeof p.price === 'string' ? parseFloat(p.price.replace(/[^\d,]/g, '').replace(',', '.')) : p.price;
        const variants = p.variants || [];
        await Product.create({
            id: p.id, name: p.name, slug: slugify(p.name),
            category: p.category, subCategory: p.subCategory,
            categoryId: catMap[p.category], subCategoryId: subMap[`${p.category}|${p.subCategory}`],
            brandId: brand._id, brand: brand.name,
            price, image: p.image, video: p.video, specs: p.specs,
            variants,
            stock: variants.length ? variants.reduce((s, v) => s + v.stock, 0) : (p.stock ?? 20),
            active: true, isFeatured: !!p.isFeatured
        });
    }
    console.log('✅ Demo katalog yüklendi');
}

/** ADMIN_EMAIL + ADMIN_PASSWORD tanımlıysa ve böyle bir kullanıcı yoksa yönetici oluşturur. */
export async function ensureAdmin() {
    const { email, password } = config.admin;
    if (!email || !password) return;
    const existing = await User.findOne({ email });
    if (existing) {
        if (!existing.isAdmin) console.warn(`⚠️  ADMIN_EMAIL ile kayıtlı kullanıcı admin değil. Admin yapmak için: npm run admin:reset`);
        return;
    }
    if (password.length < 12) {
        console.warn('⚠️  ADMIN_PASSWORD en az 12 karakter olmalı; admin oluşturulmadı.');
        return;
    }
    await User.create({ email, name: 'Yönetici', isAdmin: true, passwordHash: await bcrypt.hash(password, 12) });
    console.log('👑 Yönetici hesabı oluşturuldu');
}
