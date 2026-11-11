import { Router } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import { Product } from '../../src/models/Product.js';
import { Category } from '../../src/models/Category.js';
import { SubCategory } from '../../src/models/SubCategory.js';
import { Brand } from '../../src/models/Brand.js';
import { Order, ORDER_STATUSES } from '../../src/models/Order.js';
import { SupportTicket, TICKET_STATUSES } from '../../src/models/SupportTicket.js';
import { requireAdmin } from '../middleware/security.js';
import { badRequest, notFound, str, isObjectId, slugify } from '../lib/validate.js';
import { changeStatus } from '../services/orders.js';
import { populated } from '../services/catalog.js';

const router = Router();
router.use('/admin', requireAdmin);

const idParam = (req) => {
    if (!isObjectId(req.params.id)) throw badRequest('Geçersiz kimlik');
    return req.params.id;
};

/* ---------------- Kategoriler ---------------- */
router.get('/admin/categories', async (req, res) => res.json(await Category.find().sort({ createdAt: -1 })));

router.post('/admin/categories', async (req, res) => {
    const name = str(req.body.name, 80);
    if (!name) throw badRequest('Kategori adı gerekli');
    res.json(await Category.create({ name, slug: slugify(name) }));
});

router.put('/admin/categories/:id', async (req, res) => {
    const name = str(req.body.name, 80);
    if (!name) throw badRequest('Kategori adı gerekli');
    const cat = await Category.findByIdAndUpdate(idParam(req), { name, slug: slugify(name) }, { new: true });
    if (!cat) throw notFound();
    await Product.updateMany({ categoryId: cat._id }, { $set: { category: cat.name } });
    res.json(cat);
});

router.delete('/admin/categories/:id', async (req, res) => {
    const id = idParam(req);
    const inUse = await Product.countDocuments({ categoryId: id });
    if (inUse) throw badRequest(`Bu kategoride ${inUse} ürün var. Önce ürünleri taşıyın veya silin.`);
    await Category.findByIdAndDelete(id);
    await SubCategory.deleteMany({ categoryId: id });
    res.json({ message: 'Silindi' });
});

/* ---------------- Alt kategoriler ---------------- */
router.get('/admin/subcategories', async (req, res) =>
    res.json(await SubCategory.find().populate('categoryId', 'name').sort({ createdAt: -1 })));

router.post('/admin/subcategories', async (req, res) => {
    const name = str(req.body.name, 80);
    const categoryId = str(req.body.categoryId, 30);
    if (!name || !isObjectId(categoryId)) throw badRequest('Ad ve ana kategori gerekli');
    res.json(await SubCategory.create({ name, slug: slugify(name), categoryId }));
});

router.put('/admin/subcategories/:id', async (req, res) => {
    const upd = {};
    if (req.body.name) { upd.name = str(req.body.name, 80); upd.slug = slugify(upd.name); }
    if (req.body.categoryId) {
        if (!isObjectId(req.body.categoryId)) throw badRequest('Geçersiz kategori');
        upd.categoryId = req.body.categoryId;
    }
    const sub = await SubCategory.findByIdAndUpdate(idParam(req), upd, { new: true });
    if (!sub) throw notFound();
    if (upd.name) await Product.updateMany({ subCategoryId: sub._id }, { $set: { subCategory: sub.name } });
    res.json(sub);
});

router.delete('/admin/subcategories/:id', async (req, res) => {
    await SubCategory.findByIdAndDelete(idParam(req));
    res.json({ message: 'Silindi' });
});

/* ---------------- Markalar ---------------- */
router.get('/admin/brands', async (req, res) => res.json(await Brand.find().sort({ createdAt: -1 })));

const brandFields = (b) => ({ name: str(b.name, 80), logo: str(b.logo, 500), description: str(b.description, 1000) });

router.post('/admin/brands', async (req, res) => {
    const data = brandFields(req.body);
    if (!data.name) throw badRequest('Marka adı gerekli');
    res.json(await Brand.create({ ...data, slug: slugify(data.name) }));
});

router.put('/admin/brands/:id', async (req, res) => {
    const data = brandFields(req.body);
    if (data.name) data.slug = slugify(data.name); else delete data.name;
    const brand = await Brand.findByIdAndUpdate(idParam(req), data, { new: true });
    if (!brand) throw notFound();
    if (data.name) await Product.updateMany({ brandId: brand._id }, { $set: { brand: brand.name } });
    res.json(brand);
});

router.delete('/admin/brands/:id', async (req, res) => {
    const id = idParam(req);
    const inUse = await Product.countDocuments({ brandId: id });
    if (inUse) throw badRequest(`Bu markaya bağlı ${inUse} ürün var.`);
    await Brand.findByIdAndDelete(id);
    res.json({ message: 'Silindi' });
});

/* ---------------- Ürünler ---------------- */
router.get('/admin/products', async (req, res) => {
    const products = await populated(Product.find().sort({ createdAt: -1 })).lean();
    res.json(products.map(p => ({
        ...p,
        category: p.categoryId?.name || p.category,
        subCategory: p.subCategoryId?.name || p.subCategory,
        brand: p.brandId?.name || p.brand
    })));
});

/** Ürün gövdesini beyaz liste ile doğrular (mass-assignment önlemi) */
async function productData(body, partial = false) {
    const d = {};
    const err = {};
    if (!partial || body.name !== undefined) {
        d.name = str(body.name, 200);
        if (!d.name) err.name = 'Ürün adı gerekli';
        else d.slug = slugify(d.name);
    }
    if (!partial || body.price !== undefined) {
        d.price = Number(body.price);
        if (!(d.price >= 0)) err.price = 'Geçerli fiyat giriniz';
    }
    for (const k of ['image', 'video']) if (body[k] !== undefined) d[k] = str(body[k], 1000);
    if (body.images !== undefined) {
        const list = (Array.isArray(body.images) ? body.images : String(body.images).split(/\s+/))
            .map(u => str(u, 1000)).filter(u => /^https:\/\//.test(u));
        d.images = [...new Set(list)].slice(0, 12);
        if (d.images.length) d.image = d.images[0];
    } else if (d.image) d.images = [d.image];
    if (body.sku !== undefined) d.sku = str(body.sku, 60) || undefined;
    if (body.description !== undefined) d.description = str(body.description, 5000);
    if (body.specs !== undefined && (body.specs === null || typeof body.specs === 'object')) d.specs = body.specs;
    if (body.active !== undefined) d.active = body.active !== false;
    if (body.isFeatured !== undefined) d.isFeatured = !!body.isFeatured;

    if (body.variants !== undefined) {
        if (!Array.isArray(body.variants)) err.variants = 'Geçersiz beden listesi';
        else d.variants = body.variants
            .map(v => ({ size: str(v.size, 40), stock: Math.max(0, parseInt(v.stock, 10) || 0) }))
            .filter(v => v.size);
    }
    if (body.stock !== undefined) d.stock = Math.max(0, parseInt(body.stock, 10) || 0);
    if (d.variants?.length) d.stock = d.variants.reduce((s, v) => s + v.stock, 0);

    if (!partial || body.categoryId) {
        const cat = isObjectId(body.categoryId) ? await Category.findById(body.categoryId) : null;
        if (!cat) err.categoryId = 'Kategori seçiniz';
        else { d.categoryId = cat._id; d.category = cat.name; }
    }
    if (body.subCategoryId !== undefined) {
        const sub = isObjectId(body.subCategoryId) ? await SubCategory.findById(body.subCategoryId) : null;
        d.subCategoryId = sub?._id || null;
        d.subCategory = sub?.name || '';
    }
    if (!partial || body.brandId) {
        const brand = isObjectId(body.brandId) ? await Brand.findById(body.brandId) : null;
        if (!brand) err.brandId = 'Marka seçiniz';
        else { d.brandId = brand._id; d.brand = brand.name; }
    }
    if (Object.keys(err).length) throw badRequest(Object.values(err)[0], err);
    return d;
}

router.post('/admin/products', async (req, res) => {
    res.json(await Product.create(await productData(req.body)));
});

router.put('/admin/products/:id', async (req, res) => {
    const product = await Product.findByIdAndUpdate(idParam(req), { $set: await productData(req.body, true) }, { new: true, runValidators: true });
    if (!product) throw notFound('Ürün bulunamadı');
    res.json(product);
});

router.delete('/admin/products/:id', async (req, res) => {
    const id = idParam(req);
    // Geçmiş siparişlerde referans olan ürün silinmez, satıştan kaldırılır
    if (await Order.exists({ 'items.product': id })) {
        await Product.updateOne({ _id: id }, { $set: { active: false } });
        return res.json({ message: 'Ürün siparişlerde kullanıldığı için silinmedi, satıştan kaldırıldı (pasif).' });
    }
    const result = await Product.findByIdAndDelete(id);
    if (!result) throw notFound('Ürün bulunamadı');
    res.json({ message: 'Ürün silindi' });
});

/* ---------------- Siparişler ---------------- */
router.get('/admin/orders', async (req, res) => {
    const filter = {};
    if (req.query.status && ORDER_STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const q = str(req.query.q, 60);
    if (q) filter.$or = [{ orderNumber: q.toUpperCase() }, { 'customer.email': q.toLowerCase() }];
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 100, 500)).lean();
    res.set('Cache-Control', 'no-store').json(orders);
});

router.put('/admin/orders/:id/status', async (req, res) => {
    const order = await Order.findById(idParam(req));
    if (!order) throw notFound('Sipariş bulunamadı');
    const status = str(req.body.status, 30);
    if (!ORDER_STATUSES.includes(status)) throw badRequest('Geçersiz durum');
    if (status === 'shipped' && !str(req.body.trackingNumber, 60) && !order.shipment?.trackingNumber) {
        throw badRequest('Kargoya verildi durumu için takip numarası giriniz');
    }
    await changeStatus(order, status, {
        note: req.body.note,
        carrier: req.body.carrier,
        trackingNumber: req.body.trackingNumber,
        trackingUrl: req.body.trackingUrl,
        notify: req.body.notify !== false
    });
    if (req.body.adminNote !== undefined) { order.adminNote = str(req.body.adminNote, 1000); await order.save(); }
    res.json(order);
});

/* ---------------- Destek talepleri ---------------- */
router.get('/admin/tickets', async (req, res) => {
    const filter = {};
    if (req.query.status && TICKET_STATUSES.includes(req.query.status)) filter.status = req.query.status;
    res.set('Cache-Control', 'no-store').json(await SupportTicket.find(filter).sort({ createdAt: -1 }).limit(200).lean());
});

router.put('/admin/tickets/:id', async (req, res) => {
    const upd = {};
    if (req.body.status) {
        if (!TICKET_STATUSES.includes(req.body.status)) throw badRequest('Geçersiz durum');
        upd.status = req.body.status;
    }
    if (req.body.adminNote !== undefined) upd.adminNote = str(req.body.adminNote, 1000);
    const t = await SupportTicket.findByIdAndUpdate(idParam(req), upd, { new: true });
    if (!t) throw notFound();
    res.json(t);
});

/* ---------------- Görsel yükleme (Cloudinary, imzalı) ----------------
 * Dosya sunucumuzdan geçmez: tarayıcı doğrudan Cloudinary'ye yükler, biz sadece kısa ömürlü imza üretiriz.
 * API secret asla tarayıcıya gönderilmez.
 */
router.get('/admin/upload-signature', (req, res) => {
    const { cloudName, apiKey, apiSecret, folder } = config.cloudinary;
    if (!cloudName || !apiKey || !apiSecret) {
        return res.status(501).json({ error: 'Görsel yükleme için CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ve CLOUDINARY_API_SECRET tanımlayın.' });
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex');
    res.set('Cache-Control', 'no-store').json({ cloudName, apiKey, timestamp, folder, signature });
});

/* ---------------- Özet ---------------- */
router.get('/admin/stats', async (req, res) => {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [byStatus, revenue, openTickets, lowStock] = await Promise.all([
        Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        Order.aggregate([{ $match: { createdAt: { $gte: since }, status: { $in: ['paid', 'preparing', 'shipped', 'delivered'] } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' }, n: { $sum: 1 } } }]),
        SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
        Product.find({ active: true, $or: [{ variants: { $size: 0 }, stock: { $lte: 3 } }, { 'variants.stock': { $lte: 0 } }] }).select('name stock variants').limit(50).lean()
    ]);
    res.set('Cache-Control', 'no-store').json({
        ordersByStatus: Object.fromEntries(byStatus.map(s => [s._id, s.n])),
        last30Days: { revenue: revenue[0]?.total || 0, orders: revenue[0]?.n || 0 },
        openTickets,
        lowStock
    });
});

export default router;
