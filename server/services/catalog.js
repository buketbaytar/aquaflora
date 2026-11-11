import { Product } from '../../src/models/Product.js';
import { Category } from '../../src/models/Category.js';
import { SubCategory } from '../../src/models/SubCategory.js';
import { isObjectId, escapeRegex, slugify } from '../lib/validate.js';

export function totalStock(p) {
    if (p.variants?.length) return p.variants.reduce((s, v) => s + (v.stock || 0), 0);
    return p.stock || 0;
}

export function variantStock(p, size) {
    if (!p.variants?.length) return p.stock || 0;
    return p.variants.find(v => v.size === size)?.stock ?? 0;
}

/** Tüm API yanıtlarında tek tip ürün nesnesi. `id` her zaman MongoDB _id (string). */
export function toPublicProduct(p) {
    const stock = totalStock(p);
    return {
        id: String(p._id),
        legacyId: p.id ?? null,
        slug: p.slug || slugify(p.name),
        name: p.name,
        price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
        image: p.image || p.images?.[0] || '',
        images: (p.images?.length ? p.images : (p.image ? [p.image] : [])).filter(Boolean),
        sku: p.sku || '',
        video: p.video || '',
        description: p.description || '',
        specs: p.specs || null,
        category: p.categoryId?.name || p.category || '',
        categoryId: p.categoryId?._id ? String(p.categoryId._id) : (p.categoryId ? String(p.categoryId) : null),
        subCategory: p.subCategoryId?.name || p.subCategory || '',
        subCategoryId: p.subCategoryId?._id ? String(p.subCategoryId._id) : (p.subCategoryId ? String(p.subCategoryId) : null),
        brand: p.brandId?.name || p.brand || '',
        isFeatured: !!p.isFeatured,
        views: p.views || 0,
        variants: (p.variants || []).map(v => ({ size: v.size, stock: Math.max(0, v.stock || 0) })),
        stock: Math.max(0, stock),
        inStock: stock > 0,
        createdAt: p.createdAt
    };
}

const POPULATE = [
    ['categoryId', 'name slug'],
    ['subCategoryId', 'name slug'],
    ['brandId', 'name slug']
];

export function populated(q) {
    for (const [path, select] of POPULATE) q.populate(path, select);
    return q;
}

/** _id, eski sayısal id veya slug ile ürün bul */
export async function findProduct(idOrSlug, { activeOnly = true } = {}) {
    const key = String(idOrSlug || '').trim();
    if (!key) return null;
    const base = activeOnly ? { active: true } : {};
    let filter;
    if (isObjectId(key)) filter = { _id: key };
    else if (/^\d+$/.test(key)) filter = { id: Number(key) };
    else filter = { slug: key };
    return populated(Product.findOne({ ...base, ...filter })).lean();
}

/**
 * Ürün listeleme/arama. Parametresiz çağrı tüm aktif ürünleri döndürür.
 * q: metin araması (Türkçe karakter duyarsız, kısmi eşleşme)
 */
export async function searchProducts({ q, category, subCategory, brand, minPrice, maxPrice, inStock, sort, limit } = {}) {
    const filter = { active: true };
    if (category) {
        if (isObjectId(category)) filter.categoryId = category;
        else {
            const cat = await Category.findOne({ $or: [{ slug: category }, { name: category }] }).lean();
            filter.$or = cat ? [{ categoryId: cat._id }, { category: cat.name }] : [{ category }];
        }
    }
    if (subCategory) {
        const sub = await SubCategory.findOne({ $or: [{ slug: subCategory }, { name: subCategory }] }).lean();
        filter.subCategory = sub ? sub.name : new RegExp(`^${escapeRegex(subCategory)}$`, 'i');
    }
    if (brand) filter.brand = new RegExp(`^${escapeRegex(brand)}$`, 'i');
    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    let docs = await populated(Product.find(filter)).lean();
    let list = docs.map(toPublicProduct);

    if (q) {
        const tokens = normalizeTR(q).split(' ').filter(t => t.length > 1);
        if (tokens.length) {
            list = list
                .map(p => {
                    const hay = normalizeTR(`${p.name} ${p.brand} ${p.category} ${p.subCategory} ${p.description}`);
                    const name = normalizeTR(p.name);
                    let score = 0;
                    for (const t of tokens) {
                        if (name.includes(t)) score += 3;
                        else if (hay.includes(t)) score += 1;
                    }
                    return { p, score };
                })
                .filter(x => x.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(x => x.p);
        }
    }
    if (inStock) list = list.filter(p => p.inStock);

    switch (sort) {
        case 'price_asc': list.sort((a, b) => a.price - b.price); break;
        case 'price_desc': list.sort((a, b) => b.price - a.price); break;
        case 'newest': list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
        case 'popular': list.sort((a, b) => b.views - a.views); break;
        default: break;
    }
    if (limit) list = list.slice(0, Number(limit));
    return list;
}

/** Türkçe karakter + büyük/küçük harf duyarsız karşılaştırma için normalleştirme */
export function normalizeTR(s) {
    return String(s || '')
        .toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/â/g, 'a')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
