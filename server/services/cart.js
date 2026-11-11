import { Cart } from '../../src/models/Cart.js';
import { Product } from '../../src/models/Product.js';
import { findProduct, variantStock } from './catalog.js';
import { badRequest, notFound, conflict, int, str } from '../lib/validate.js';

const MAX_LINES = 50;

/** Kullanıcının sepetini getirir; yoksa oluşturur. Eski sayısal productId kayıtlarını dönüştürür. */
export async function getUserCart(userId) {
    let cart = await Cart.findOne({ userId });
    if (!cart) cart = await Cart.create({ userId, items: [] });

    const legacy = cart.items.filter(i => !i.product && i.productId != null);
    if (legacy.length) {
        const prods = await Product.find({ id: { $in: legacy.map(i => i.productId) } }).select('_id id').lean();
        const map = new Map(prods.map(p => [p.id, p._id]));
        cart.items = cart.items
            .map(i => (i.product ? i : (map.has(i.productId) ? { ...i.toObject(), product: map.get(i.productId), productId: undefined } : null)))
            .filter(Boolean);
        await cart.save();
    }
    return cart;
}

/** Sepet satırlarını güncel fiyat ve stokla zenginleştirir. Satıştan kalkmış ürünler çıkarılır. */
export async function cartLines(items) {
    const ids = [...new Set(items.map(i => String(i.product)).filter(Boolean))];
    const products = await Product.find({ _id: { $in: ids } }).lean();
    const byId = new Map(products.map(p => [String(p._id), p]));

    const lines = [];
    for (const i of items) {
        const p = byId.get(String(i.product));
        if (!p || p.active === false) continue;
        const hasVariants = (p.variants || []).length > 0;
        const available = Math.max(0, hasVariants ? variantStock(p, i.selectedVariant) : (p.stock || 0));
        lines.push({
            productId: String(p._id),
            name: p.name,
            image: p.image || '',
            category: p.category || '',
            brand: p.brand || '',
            price: p.price,
            selectedVariant: i.selectedVariant || null,
            quantity: i.quantity,
            available,
            hasVariants,
            lineTotal: Math.round(p.price * i.quantity * 100) / 100,
            problem: available === 0 ? 'out_of_stock' : (i.quantity > available ? 'insufficient_stock' : null)
        });
    }
    return lines;
}

/** Sepete eklenecek ürünü ve adedi doğrular; stok sınırına göre kırpar. */
async function resolveLine({ productId, selectedVariant, quantity }) {
    const product = await findProduct(productId);
    if (!product) throw notFound('Ürün bulunamadı veya satışta değil');
    const hasVariants = (product.variants || []).length > 0;
    const variant = hasVariants ? str(selectedVariant, 40) : null;
    if (hasVariants) {
        if (!variant) throw badRequest('Lütfen beden/seçenek seçiniz');
        if (!product.variants.some(v => v.size === variant)) throw badRequest('Geçersiz beden seçimi');
    }
    const available = Math.max(0, hasVariants ? variantStock(product, variant) : (product.stock || 0));
    return { product, variant: variant || undefined, available, quantity: int(quantity, { min: 1, max: 99, def: 1 }) };
}

const sameLine = (i, productId, variant) => String(i.product) === String(productId) && (i.selectedVariant || undefined) === (variant || undefined);

export async function addToCart(cart, input) {
    const { product, variant, available, quantity } = await resolveLine(input);
    if (available <= 0) throw conflict(`${product.name}${variant ? ` (${variant})` : ''} şu anda stokta yok`);

    const existing = cart.items.find(i => sameLine(i, product._id, variant));
    const wanted = (existing?.quantity || 0) + quantity;
    if (wanted > available) {
        throw conflict(`${product.name}${variant ? ` (${variant})` : ''} için en fazla ${available} adet ekleyebilirsiniz`);
    }
    if (existing) existing.quantity = wanted;
    else {
        if (cart.items.length >= MAX_LINES) throw badRequest('Sepetiniz dolu');
        cart.items.push({ product: product._id, selectedVariant: variant, quantity });
    }
    cart.reminderSentAt = undefined;
    await cart.save();
    return cart;
}

export async function setCartQuantity(cart, input) {
    const { product, variant, available } = await resolveLine({ ...input, quantity: 1 });
    const qty = int(input.quantity, { min: 0, max: 99, def: 1 });
    const idx = cart.items.findIndex(i => sameLine(i, product._id, variant));
    if (idx === -1) throw notFound('Ürün sepette bulunamadı');
    if (qty === 0) cart.items.splice(idx, 1);
    else {
        if (qty > available) throw conflict(`Bu üründen stokta ${available} adet var`);
        cart.items[idx].quantity = qty;
    }
    await cart.save();
    return cart;
}

export async function removeFromCart(cart, { productId, selectedVariant }) {
    const before = cart.items.length;
    cart.items = cart.items.filter(i => !(String(i.product) === String(productId) && (i.selectedVariant || null) === (selectedVariant || null)));
    if (cart.items.length !== before) await cart.save();
    return cart;
}

/** Girişte misafir (localStorage) sepetini üye sepetiyle birleştirir. Hatalı/stoksuz satırlar sessizce atlanır. */
export async function mergeIntoCart(cart, guestItems = []) {
    const notices = [];
    for (const g of guestItems.slice(0, MAX_LINES)) {
        try {
            const { product, variant, available, quantity } = await resolveLine(g);
            if (available <= 0) { notices.push(`${product.name} stokta olmadığı için eklenmedi`); continue; }
            const existing = cart.items.find(i => sameLine(i, product._id, variant));
            const wanted = Math.min(available, Math.max(existing?.quantity || 0, quantity));
            if (existing) existing.quantity = wanted;
            else cart.items.push({ product: product._id, selectedVariant: variant, quantity: wanted });
        } catch { /* geçersiz satır */ }
    }
    await cart.save();
    return { cart, notices };
}
