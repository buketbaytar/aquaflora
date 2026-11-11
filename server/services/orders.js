import crypto from 'crypto';
import { Product } from '../../src/models/Product.js';
import { Order } from '../../src/models/Order.js';
import { Cart } from '../../src/models/Cart.js';
import { User } from '../../src/models/User.js';
import { config, shippingFeeFor } from '../config.js';
import { mails } from '../lib/mailer.js';
import { badRequest, conflict, str, email as vEmail, phoneTR, tckn, int, isObjectId } from '../lib/validate.js';

/* ---------------- Sipariş numarası ---------------- */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışan karakterler yok (0/O, 1/I)
export function generateOrderNumber(prefix = 'AQ') {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rnd = Array.from(crypto.randomBytes(5), b => ALPHABET[b % ALPHABET.length]).join('');
    return `${prefix}-${ymd}-${rnd}`;
}
export const ORDER_NO_RE = /\b(AQ-\d{6}-[A-Z0-9]{5})\b/i;

/* ---------------- Stok ---------------- */
/**
 * Koşullu atomik stok düşümü: `stock >= qty` şartı aynı sorguda kontrol edilir,
 * böylece eşzamanlı iki sipariş stoğu eksiye düşüremez. Bir kalem başarısız olursa
 * önceki kalemler geri alınır (MongoDB transaction gerektirmez, Atlas M0'da da çalışır).
 */
export async function reserveStock(items) {
    const done = [];
    for (const it of items) {
        const q = it.quantity;
        const res = it.selectedVariant
            ? await Product.updateOne(
                { _id: it.product, variants: { $elemMatch: { size: it.selectedVariant, stock: { $gte: q } } } },
                { $inc: { 'variants.$.stock': -q } })
            : await Product.updateOne({ _id: it.product, stock: { $gte: q } }, { $inc: { stock: -q } });
        if (res.modifiedCount !== 1) {
            await releaseStock(done);
            throw conflict(`${it.name}${it.selectedVariant ? ` (${it.selectedVariant})` : ''} için yeterli stok kalmadı. Lütfen sepetinizi güncelleyin.`);
        }
        done.push(it);
    }
}

export async function releaseStock(items) {
    for (const it of items) {
        if (!it.product) continue;
        const q = it.quantity;
        if (it.selectedVariant) {
            await Product.updateOne({ _id: it.product, 'variants.size': it.selectedVariant }, { $inc: { 'variants.$.stock': q } });
        } else {
            await Product.updateOne({ _id: it.product }, { $inc: { stock: q } });
        }
    }
}

/* ---------------- Fiyatlama (her zaman sunucu tarafı, istemci fiyatına asla güvenilmez) ---------------- */
export async function priceItems(rawItems) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) throw badRequest('Sepetiniz boş');
    if (rawItems.length > 50) throw badRequest('Sepette çok fazla ürün var');

    // Aynı ürün+varyant satırlarını birleştir
    const merged = new Map();
    for (const r of rawItems) {
        const pid = String(r.productId || r.product || '');
        if (!isObjectId(pid)) throw badRequest('Sepette geçersiz ürün var');
        const variant = str(r.selectedVariant, 40) || null;
        const key = `${pid}|${variant || ''}`;
        const qty = int(r.quantity, { min: 1, max: 99, def: 1 });
        merged.set(key, { pid, variant, quantity: (merged.get(key)?.quantity || 0) + qty });
    }

    const ids = [...new Set([...merged.values()].map(m => m.pid))];
    const products = await Product.find({ _id: { $in: ids }, active: true }).lean();
    const byId = new Map(products.map(p => [String(p._id), p]));

    const items = [];
    let subtotal = 0;
    for (const m of merged.values()) {
        const p = byId.get(m.pid);
        if (!p) throw conflict('Sepetinizdeki bir ürün artık satışta değil. Lütfen sepetinizi kontrol edin.');
        const hasVariants = (p.variants || []).length > 0;
        if (hasVariants && !m.variant) throw badRequest(`${p.name} için beden seçilmelidir`);
        if (hasVariants && !p.variants.some(v => v.size === m.variant)) throw badRequest(`${p.name} için geçersiz beden`);
        const lineTotal = Math.round(p.price * m.quantity * 100) / 100;
        subtotal += lineTotal;
        items.push({
            product: p._id,
            name: p.name,
            image: p.image,
            category: p.category,
            price: p.price,
            selectedVariant: hasVariants ? m.variant : undefined,
            quantity: m.quantity,
            lineTotal
        });
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const shippingFee = shippingFeeFor(subtotal);
    return { items, subtotal, shippingFee, totalAmount: Math.round((subtotal + shippingFee) * 100) / 100 };
}

/* ---------------- Checkout girdisi doğrulama ---------------- */
export function validateCheckout(body, user) {
    const errors = {};
    const c = body.customer || {};
    const s = body.shippingAddress || {};
    const b = body.billing || {};
    const consents = body.consents || {};

    const name = str(c.name, 100);
    const em = vEmail(c.email || user?.email);
    const phone = phoneTR(c.phone);
    if (name.split(' ').filter(Boolean).length < 2) errors['customer.name'] = 'Ad ve soyad giriniz';
    if (!em) errors['customer.email'] = 'Geçerli bir e-posta giriniz';
    if (!phone) errors['customer.phone'] = 'Geçerli bir cep telefonu giriniz (5XX XXX XX XX)';

    const shipping = {
        fullName: str(s.fullName || name, 100),
        phone: phoneTR(s.phone || c.phone) || phone,
        city: str(s.city, 50),
        district: str(s.district, 50),
        addressLine: str(s.addressLine, 300),
        zipCode: str(s.zipCode, 10).replace(/[^0-9]/g, '')
    };
    if (!shipping.city) errors['shippingAddress.city'] = 'İl seçiniz';
    if (!shipping.district) errors['shippingAddress.district'] = 'İlçe giriniz';
    if (shipping.addressLine.length < 10) errors['shippingAddress.addressLine'] = 'Açık adresinizi giriniz';

    const billingType = b.type === 'corporate' ? 'corporate' : 'individual';
    const billing = { type: billingType, address: b.sameAsShipping === false ? {
        fullName: str(b.address?.fullName, 100), city: str(b.address?.city, 50), district: str(b.address?.district, 50),
        addressLine: str(b.address?.addressLine, 300), zipCode: str(b.address?.zipCode, 10)
    } : { ...shipping } };
    if (b.identityNumber) {
        billing.identityNumber = tckn(b.identityNumber);
        if (!billing.identityNumber) errors['billing.identityNumber'] = 'T.C. kimlik numarası geçersiz';
    }
    if (billingType === 'corporate') {
        billing.companyName = str(b.companyName, 150);
        billing.taxOffice = str(b.taxOffice, 80);
        billing.taxNumber = str(b.taxNumber, 11).replace(/[^0-9]/g, '');
        if (!billing.companyName) errors['billing.companyName'] = 'Firma ünvanı giriniz';
        if (!billing.taxOffice) errors['billing.taxOffice'] = 'Vergi dairesi giriniz';
        if (!/^\d{10}$/.test(billing.taxNumber)) errors['billing.taxNumber'] = 'Vergi numarası 10 haneli olmalı';
    }
    if (billing.address.addressLine && billing.address.addressLine.length < 10) errors['billing.address'] = 'Fatura adresini giriniz';

    const paymentMethod = body.paymentMethod;
    if (!config.payment.methods.includes(paymentMethod)) errors.paymentMethod = 'Geçerli bir ödeme yöntemi seçiniz';

    if (consents.preInfo !== true) errors['consents.preInfo'] = 'Ön Bilgilendirme Formu onaylanmalı';
    if (consents.distanceSales !== true) errors['consents.distanceSales'] = 'Mesafeli Satış Sözleşmesi onaylanmalı';
    if (consents.kvkk !== true) errors['consents.kvkk'] = 'KVKK Aydınlatma Metni onaylanmalı';

    if (Object.keys(errors).length) throw badRequest('Lütfen işaretli alanları kontrol edin', errors);

    return {
        customer: { name, email: em, phone },
        shippingAddress: shipping,
        billing,
        paymentMethod,
        customerNote: str(body.note, 500),
        marketingOptIn: consents.marketing === true
    };
}

/* ---------------- Sipariş oluşturma ---------------- */
export async function createOrder({ user, body, ip, userAgent }) {
    const input = validateCheckout(body, user);
    const priced = await priceItems(body.items);

    await reserveStock(priced.items);

    const now = new Date();
    const reservationMs = input.paymentMethod === 'bank_transfer'
        ? config.payment.bankReservationHours * 3600 * 1000
        : config.payment.cardReservationMinutes * 60 * 1000;

    let order;
    try {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                order = await Order.create({
                    orderNumber: generateOrderNumber(),
                    userId: user?._id,
                    customer: input.customer,
                    shippingAddress: input.shippingAddress,
                    billing: input.billing,
                    items: priced.items,
                    subtotal: priced.subtotal,
                    shippingFee: priced.shippingFee,
                    totalAmount: priced.totalAmount,
                    paymentMethod: input.paymentMethod,
                    payment: { provider: input.paymentMethod === 'card' ? config.payment.cardProvider : 'bank_transfer' },
                    status: 'pending_payment',
                    statusHistory: [{ status: 'pending_payment', at: now }],
                    consents: {
                        preInfoAcceptedAt: now,
                        distanceSalesAcceptedAt: now,
                        kvkkAcknowledgedAt: now,
                        marketingOptIn: input.marketingOptIn,
                        ip,
                        userAgent: str(userAgent, 300)
                    },
                    reservationExpiresAt: new Date(now.getTime() + reservationMs),
                    customerNote: input.customerNote
                });
                break;
            } catch (e) {
                if (e.code === 11000 && attempt < 2) continue; // sipariş no çakışması, tekrar dene
                throw e;
            }
        }
    } catch (e) {
        await releaseStock(priced.items);
        throw e;
    }

    if (user) {
        // Üyenin sepetini temizle, telefonu ve ticari ileti iznini güncelle
        await Cart.updateOne({ userId: user._id }, { $set: { items: [] } });
        const upd = {};
        if (!user.phone) upd.phone = input.customer.phone;
        if (input.marketingOptIn && !user.marketingConsent?.granted) upd.marketingConsent = { granted: true, at: now };
        if (Object.keys(upd).length) await User.updateOne({ _id: user._id }, { $set: upd });
    }

    if (order.paymentMethod === 'bank_transfer') {
        mails.orderReceived(order);
        mails.adminNewOrder(order);
    }
    return order;
}

/* ---------------- Durum geçişleri ---------------- */
function pushStatus(order, status, note) {
    order.status = status;
    order.statusHistory.push({ status, at: new Date(), note });
}

/** Ödeme onayı — idempotent: aynı callback iki kez gelse de sipariş bir kez işlenir. */
export async function markPaid(order, { transactionId, note } = {}) {
    if (['paid', 'preparing', 'shipped', 'delivered'].includes(order.status)) return order;

    if (order.stockReleased) {
        // Süre aşımıyla iptal edilmiş siparişe geç gelen ödeme: stoğu yeniden ayırmayı dene
        try {
            await reserveStock(order.items);
            order.stockReleased = false;
        } catch {
            order.adminNote = `${order.adminNote || ''}\n⚠️ Ödeme süre aşımından sonra geldi ve stok yetersiz. Müşteriyle iletişime geçin / iade edin.`.trim();
        }
    }
    order.payment.transactionId = transactionId || order.payment.transactionId;
    order.payment.paidAt = new Date();
    order.reservationExpiresAt = undefined;
    pushStatus(order, 'paid', note);
    await order.save();

    mails.orderPaid(order);
    if (order.paymentMethod === 'card') mails.adminNewOrder(order);
    checkLowStock(order.items).catch(() => { });
    return order;
}

export async function markFailed(order, reason) {
    if (order.status !== 'pending_payment') return order;
    if (!order.stockReleased) {
        await releaseStock(order.items);
        order.stockReleased = true;
    }
    order.payment.failureReason = str(reason, 300);
    pushStatus(order, 'payment_failed', reason);
    await order.save();
    return order;
}

const RELEASING_STATUSES = new Set(['cancelled', 'payment_failed', 'refunded']);

/** Admin veya sistem tarafından durum değişikliği */
export async function changeStatus(order, status, { note, carrier, trackingNumber, trackingUrl, notify = true } = {}) {
    if (status === order.status && !trackingNumber) return order;

    if (status === 'paid' && order.status === 'pending_payment') return markPaid(order, { note });

    if (RELEASING_STATUSES.has(status) && !order.stockReleased) {
        await releaseStock(order.items);
        order.stockReleased = true;
    }
    if (status === 'shipped') {
        order.shipment = {
            carrier: str(carrier, 60) || order.shipment?.carrier || config.shipping.carrierName,
            trackingNumber: str(trackingNumber, 60) || order.shipment?.trackingNumber,
            trackingUrl: str(trackingUrl, 300) || order.shipment?.trackingUrl,
            shippedAt: order.shipment?.shippedAt || new Date()
        };
    }
    if (status !== order.status) pushStatus(order, status, str(note, 300));
    await order.save();
    if (notify && ['preparing', 'shipped', 'delivered', 'cancelled', 'refunded'].includes(status)) mails.orderStatusChanged(order);
    return order;
}

/** Ödeme süresi dolan siparişleri iptal edip stoğu geri bırakır (zamanlanmış iş). */
export async function expireStaleOrders() {
    const stale = await Order.find({ status: 'pending_payment', reservationExpiresAt: { $lt: new Date() } }).limit(100);
    for (const o of stale) {
        await changeStatus(o, 'cancelled', { note: 'Ödeme süresi doldu (otomatik)', notify: false });
    }
    return stale.length;
}

async function checkLowStock(items) {
    const ids = items.map(i => i.product).filter(Boolean);
    const prods = await Product.find({ _id: { $in: ids } }).lean();
    const lines = [];
    for (const p of prods) {
        if (p.variants?.length) {
            for (const v of p.variants) if (v.stock <= config.lowStockThreshold) lines.push(`${p.name} (${v.size}): ${v.stock} adet`);
        } else if ((p.stock || 0) <= config.lowStockThreshold) lines.push(`${p.name}: ${p.stock || 0} adet`);
    }
    if (lines.length) mails.adminLowStock(lines);
}

/** İstemciye dönen sipariş görünümü (iç alanlar gizlenir) */
export function toPublicOrder(o) {
    return {
        orderNumber: o.orderNumber || String(o._id),
        status: o.status,
        statusHistory: (o.statusHistory || []).map(h => ({ status: h.status, at: h.at })),
        createdAt: o.createdAt,
        items: o.items.map(i => ({
            productId: i.product ? String(i.product) : null, name: i.name, image: i.image,
            price: i.price, selectedVariant: i.selectedVariant, quantity: i.quantity, lineTotal: i.lineTotal ?? i.price * i.quantity
        })),
        subtotal: o.subtotal ?? o.totalAmount,
        shippingFee: o.shippingFee || 0,
        totalAmount: o.totalAmount,
        paymentMethod: o.paymentMethod,
        reservationExpiresAt: o.status === 'pending_payment' ? o.reservationExpiresAt : null,
        shipment: o.shipment?.trackingNumber ? o.shipment : null,
        customer: o.customer ? { name: o.customer.name, email: o.customer.email } : null,
        shippingAddress: o.shippingAddress ? { city: o.shippingAddress.city, district: o.shippingAddress.district } : null,
        bank: o.paymentMethod === 'bank_transfer' && o.status === 'pending_payment' ? config.payment.bank : null
    };
}
