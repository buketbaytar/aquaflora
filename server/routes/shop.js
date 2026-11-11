import { Router } from 'express';
import { Product } from '../../src/models/Product.js';
import { Category } from '../../src/models/Category.js';
import { SubCategory } from '../../src/models/SubCategory.js';
import { Brand } from '../../src/models/Brand.js';
import { publicConfig } from '../config.js';
import { requireUser } from '../middleware/security.js';
import { notFound, str, isObjectId, badRequest } from '../lib/validate.js';
import { findProduct, searchProducts, toPublicProduct } from '../services/catalog.js';
import { getUserCart, cartLines, addToCart, setCartQuantity, removeFromCart, mergeIntoCart } from '../services/cart.js';

const router = Router();
const shortCache = (res, sec = 60) => res.set('Cache-Control', `public, max-age=${sec}, stale-while-revalidate=${sec * 5}`);

router.get('/config', (req, res) => {
    shortCache(res, 300);
    res.json(publicConfig());
});

/* ---------------- Katalog ---------------- */
router.get('/products', async (req, res) => {
    const q = req.query;
    const list = await searchProducts({
        q: str(q.q, 100) || undefined,
        category: str(q.category, 80) || undefined,
        subCategory: str(q.subCategory, 80) || undefined,
        brand: str(q.brand, 80) || undefined,
        minPrice: Number(q.minPrice) || undefined,
        maxPrice: Number(q.maxPrice) || undefined,
        inStock: q.inStock === '1' || q.inStock === 'true',
        sort: str(q.sort, 20) || undefined,
        limit: Math.min(Number(q.limit) || 0, 500) || undefined
    });
    shortCache(res, 30);
    res.json(list);
});

router.get('/products/:id', async (req, res) => {
    const p = await findProduct(req.params.id);
    if (!p) throw notFound('Ürün bulunamadı');
    shortCache(res, 30);
    res.json(toPublicProduct(p));
});

// Görüntülenme sayacı (CSRF muaf — zararsız sayaç; rate limit api genelinde)
router.post('/products/:id/view', async (req, res) => {
    if (isObjectId(req.params.id)) {
        const seen = (req.session.viewed ||= []);
        if (!seen.includes(req.params.id)) {
            await Product.updateOne({ _id: req.params.id }, { $inc: { views: 1 } });
            seen.push(req.params.id);
            if (seen.length > 30) seen.shift();
        }
    }
    res.json({ success: true });
});

router.get('/categories', async (req, res) => {
    const [cats, subs, catCounts, subCounts] = await Promise.all([
        Category.find().lean(),
        SubCategory.find().sort({ name: 1 }).lean(),
        Product.aggregate([{ $match: { active: true } }, { $group: { _id: '$categoryId', n: { $sum: 1 } } }]),
        Product.aggregate([{ $match: { active: true } }, { $group: { _id: '$subCategoryId', n: { $sum: 1 } } }])
    ]);
    const cc = new Map(catCounts.map(x => [String(x._id), x.n]));
    const sc = new Map(subCounts.map(x => [String(x._id), x.n]));
    cats.sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name, 'tr'));
    shortCache(res, 120);
    // ?all=1 → boş kategoriler dahil (admin/rapor); varsayılan: sadece satışta ürünü olanlar
    const all = req.query.all === '1';
    res.json(cats
        .map(c => ({
            id: String(c._id),
            title: c.name,
            slug: c.slug,
            productCount: cc.get(String(c._id)) || 0,
            sub: subs.filter(s => String(s.categoryId) === String(c._id) && (all || sc.get(String(s._id))))
                .map(s => ({ id: String(s._id), name: s.name, slug: s.slug, productCount: sc.get(String(s._id)) || 0 }))
        }))
        .filter(c => all || c.productCount > 0));
});

router.get('/subcategories', async (req, res) => {
    res.json(await SubCategory.find().populate('categoryId', 'name').sort({ name: 1 }).lean());
});

router.get('/brands', async (req, res) => {
    shortCache(res, 300);
    res.json(await Brand.find().sort({ name: 1 }).lean());
});

/* ---------------- Sepet (üyeler; misafir sepeti tarayıcıda tutulur) ---------------- */
const lineInput = (b) => ({
    productId: str(String(b.productId ?? ''), 40),
    selectedVariant: b.selectedVariant ? str(b.selectedVariant, 40) : null,
    quantity: b.quantity
});

async function sendCart(res, cart, extra = {}) {
    res.set('Cache-Control', 'no-store');
    res.json({ items: await cartLines(cart.items), ...extra });
}

router.get('/cart', async (req, res) => {
    if (!req.user) return res.set('Cache-Control', 'no-store').json({ items: [] });
    await sendCart(res, await getUserCart(req.user._id));
});

router.post('/cart/add', requireUser, async (req, res) => {
    const cart = await getUserCart(req.user._id);
    await addToCart(cart, lineInput(req.body));
    await sendCart(res, cart);
});

router.post('/cart/update', requireUser, async (req, res) => {
    const cart = await getUserCart(req.user._id);
    await setCartQuantity(cart, lineInput(req.body));
    await sendCart(res, cart);
});

router.post('/cart/remove', requireUser, async (req, res) => {
    const cart = await getUserCart(req.user._id);
    await removeFromCart(cart, lineInput(req.body));
    await sendCart(res, cart);
});

router.post('/cart/merge', requireUser, async (req, res) => {
    if (!Array.isArray(req.body.items)) throw badRequest('items dizi olmalı');
    const cart = await getUserCart(req.user._id);
    const { notices } = await mergeIntoCart(cart, req.body.items.map(lineInput));
    await sendCart(res, cart, { notices });
});

/** Misafir sepetindeki ürünlerin güncel fiyat/stok bilgisini döndürür */
router.post('/cart/quote', async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 50) : [];
    const valid = items.map(lineInput).filter(i => isObjectId(i.productId))
        .map(i => ({ product: i.productId, selectedVariant: i.selectedVariant, quantity: Math.max(1, Math.min(99, parseInt(i.quantity, 10) || 1)) }));
    res.set('Cache-Control', 'no-store').json({ items: await cartLines(valid) });
});

export default router;
