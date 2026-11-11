import { Router } from 'express';
import { Order } from '../../src/models/Order.js';
import { config, isProduction } from '../config.js';
import { limits, requireUser } from '../middleware/security.js';
import { notFound, forbidden, str, email as vEmail, badRequest } from '../lib/validate.js';
import { createOrder, markPaid, markFailed, changeStatus, toPublicOrder, ORDER_NO_RE } from '../services/orders.js';
import * as iyzico from '../payments/iyzico.js';

const router = Router();

/** Bu oturum siparişi görebilir mi? (sahibi, admin, bu oturumda oluşturan veya e-posta doğrulayan) */
function canView(req, order, emailParam) {
    if (req.user?.isAdmin) return true;
    if (req.user && order.userId && String(order.userId) === String(req.user._id)) return true;
    if ((req.session.orders || []).includes(order.orderNumber)) return true;
    const em = vEmail(emailParam);
    return !!(em && order.customer?.email === em);
}

function rememberOrder(req, orderNumber) {
    const list = (req.session.orders ||= []);
    if (!list.includes(orderNumber)) list.push(orderNumber);
    if (list.length > 10) list.shift();
}

/* ---------------- Checkout ---------------- */
router.post('/orders', limits.order, async (req, res) => {
    if (!config.isLive) {
        return res.status(503).json({ error: 'Mağazamız henüz satışa açılmadı. Çok yakında sipariş alabileceksiniz!', code: 'STORE_PREVIEW' });
    }
    const order = await createOrder({
        user: req.user,
        body: req.body,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    rememberOrder(req, order.orderNumber);

    if (order.paymentMethod === 'bank_transfer') {
        return res.status(201).json({ orderNumber: order.orderNumber, next: 'bank_transfer', order: toPublicOrder(order) });
    }

    // Kart ödemesi
    if (config.payment.cardProvider === 'test' && !isProduction) {
        await markPaid(order, { transactionId: `TEST-${Date.now()}`, note: 'Test ödemesi (geliştirme)' });
        return res.status(201).json({ orderNumber: order.orderNumber, next: 'redirect', redirectUrl: `/odeme-sonuc?no=${order.orderNumber}` });
    }

    try {
        const { token, paymentPageUrl } = await iyzico.initialize(order, { ip: req.ip, user: req.user });
        order.payment.token = token;
        order.payment.conversationId = order.orderNumber;
        await order.save();
        res.status(201).json({ orderNumber: order.orderNumber, next: 'redirect', redirectUrl: paymentPageUrl });
    } catch (e) {
        console.error('iyzico başlatma hatası:', e.message);
        await markFailed(order, 'Ödeme sayfası başlatılamadı');
        throw badRequest('Ödeme sayfası şu anda açılamıyor. Lütfen tekrar deneyin veya havale/EFT seçin.');
    }
});

/* ---------------- Sipariş görüntüleme / takip ---------------- */
router.get('/orders', requireUser, async (req, res) => {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
    res.set('Cache-Control', 'no-store').json(orders.map(toPublicOrder));
});

router.get('/orders/:orderNumber', limits.lookup, async (req, res) => {
    const no = str(req.params.orderNumber, 30).toUpperCase();
    if (!ORDER_NO_RE.test(no)) throw notFound('Sipariş bulunamadı');
    const order = await Order.findOne({ orderNumber: no }).lean();
    // Var/yok bilgisini sızdırmamak için yetkisiz erişimde de 404
    if (!order || !canView(req, order, req.query.email)) throw notFound('Sipariş bulunamadı. Sipariş numarası ve e-posta adresini kontrol edin.');
    rememberOrder(req, order.orderNumber);
    res.set('Cache-Control', 'no-store').json(toPublicOrder(order));
});

router.post('/orders/:orderNumber/cancel', async (req, res) => {
    const order = await Order.findOne({ orderNumber: str(req.params.orderNumber, 30).toUpperCase() });
    if (!order || !canView(req, order)) throw notFound('Sipariş bulunamadı');
    if (order.status !== 'pending_payment') throw forbidden('Bu sipariş artık iptal edilemiyor. İade/iptal için destek talebi oluşturun.');
    await changeStatus(order, 'cancelled', { note: 'Müşteri iptali', notify: false });
    res.json(toPublicOrder(order));
});

/* ---------------- iyzico callback ----------------
 * iyzico tarayıcıyı bu adrese form POST'u ile yönlendirir (CSRF token taşımaz → CSRF muaf).
 * Gövdeye güvenilmez: token ile sonuç iyzico API'sinden sunucu tarafında doğrulanır.
 */
router.post('/payment/iyzico/callback', async (req, res) => {
    const token = str(req.body?.token, 200);
    const fail = (no, msg) => res.redirect(303, `/odeme-sonuc?no=${encodeURIComponent(no || '')}&status=failed&message=${encodeURIComponent(msg)}`);
    if (!token) return fail('', 'Ödeme bilgisi alınamadı');

    const order = await Order.findOne({ 'payment.token': token });
    if (!order) return fail('', 'Sipariş bulunamadı');

    let result;
    try {
        result = await iyzico.retrieve(token);
    } catch (e) {
        console.error('iyzico retrieve hatası:', e.message);
        return fail(order.orderNumber, 'Ödeme sonucu doğrulanamadı. Kartınızdan çekim yapıldıysa bizimle iletişime geçin.');
    }

    const verdict = iyzico.evaluate(result, order);
    if (verdict.ok) {
        await markPaid(order, { transactionId: verdict.transactionId });
        return res.redirect(303, `/odeme-sonuc?no=${encodeURIComponent(order.orderNumber)}&status=success`);
    }
    await markFailed(order, verdict.reason);
    return fail(order.orderNumber, 'Ödeme tamamlanamadı. Kart bilgilerinizi kontrol edip tekrar deneyebilirsiniz.');
});

// Eski uç noktalar
router.post('/payment/initialize', (req, res) => res.status(410).json({ error: 'Bu uç nokta kaldırıldı. /api/orders kullanın.' }));

export default router;
