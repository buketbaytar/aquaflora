import Iyzipay from 'iyzipay';
import { config } from '../config.js';

/**
 * iyzico "Ortak Ödeme Sayfası" (Checkout Form) entegrasyonu.
 * Kart bilgisi sitemize hiç gelmez → PCI-DSS yükü iyzico'dadır. 3D Secure ve taksit iyzico tarafında yönetilir.
 *
 * Akış:
 *  1) initialize(order) → iyzico bir `paymentPageUrl` ve `token` döner; müşteri bu sayfaya yönlendirilir.
 *  2) Müşteri ödemeyi tamamlayınca iyzico, callbackUrl'e `token` ile POST eder.
 *  3) retrieve(token) ile sonucu iyzico'dan SUNUCU TARAFINDA doğrularız (callback gövdesine güvenilmez).
 */
let client;
function iyzico() {
    if (!client) {
        const { apiKey, secretKey, baseUrl } = config.payment.iyzico;
        if (!apiKey || !secretKey) throw new Error('iyzico anahtarları tanımlı değil');
        client = new Iyzipay({ apiKey, secretKey, uri: baseUrl });
    }
    return client;
}

const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
const fmtDate = (d) => new Date(d || Date.now()).toISOString().replace('T', ' ').slice(0, 19);

function splitName(full) {
    const parts = String(full || '').trim().split(/\s+/);
    const surname = parts.length > 1 ? parts.pop() : '-';
    return { name: parts.join(' ') || '-', surname };
}

function addr(a, fallbackName) {
    return {
        contactName: a?.fullName || fallbackName,
        city: a?.city || '-',
        country: 'Turkey',
        address: [a?.addressLine, a?.district].filter(Boolean).join(', ') || '-',
        zipCode: a?.zipCode || undefined
    };
}

export function initialize(order, { ip, user }) {
    const { name, surname } = splitName(order.customer.name);
    const basketItems = order.items.map((i, idx) => ({
        id: `${String(i.product || idx)}${i.selectedVariant ? `-${i.selectedVariant}` : ''}`,
        name: `${i.name}${i.selectedVariant ? ` (${i.selectedVariant})` : ''}`.slice(0, 100),
        category1: i.category || 'Genel',
        itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
        price: money(i.lineTotal ?? i.price * i.quantity)
    }));
    if (order.shippingFee > 0) {
        basketItems.push({ id: 'KARGO', name: 'Kargo', category1: 'Kargo', itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL, price: money(order.shippingFee) });
    }

    const request = {
        locale: Iyzipay.LOCALE.TR,
        conversationId: order.orderNumber,
        price: money(order.totalAmount),
        paidPrice: money(order.totalAmount),
        currency: Iyzipay.CURRENCY.TRY,
        basketId: order.orderNumber,
        paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
        callbackUrl: `${config.publicUrl}/api/payment/iyzico/callback`,
        enabledInstallments: [1, 2, 3, 6, 9],
        buyer: {
            id: String(order.userId || order.customer.email),
            name,
            surname,
            gsmNumber: order.customer.phone,
            email: order.customer.email,
            // iyzico zorunlu alan; TCKN alınmadıysa iyzico'nun kabul ettiği varsayılan değer gönderilir
            identityNumber: order.billing?.identityNumber || '11111111111',
            lastLoginDate: fmtDate(user?.lastLoginAt),
            registrationDate: fmtDate(user?.createdAt),
            registrationAddress: addr(order.shippingAddress, order.customer.name).address,
            ip: ip || '127.0.0.1',
            city: order.shippingAddress.city,
            country: 'Turkey',
            zipCode: order.shippingAddress.zipCode || undefined
        },
        shippingAddress: addr(order.shippingAddress, order.customer.name),
        billingAddress: addr(order.billing?.address || order.shippingAddress, order.billing?.companyName || order.customer.name),
        basketItems
    };

    return new Promise((resolve, reject) => {
        iyzico().checkoutFormInitialize.create(request, (err, result) => {
            if (err) return reject(err);
            if (result.status !== 'success') {
                return reject(new Error(`iyzico: ${result.errorCode || ''} ${result.errorMessage || 'başlatılamadı'}`));
            }
            resolve({ token: result.token, paymentPageUrl: result.paymentPageUrl });
        });
    });
}

export function retrieve(token) {
    return new Promise((resolve, reject) => {
        iyzico().checkoutForm.retrieve({ locale: Iyzipay.LOCALE.TR, token }, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
}

/** iyzico sonucunu siparişle karşılaştırıp başarı/başarısızlık kararı verir. */
export function evaluate(result, order) {
    const ok = result?.status === 'success' && result?.paymentStatus === 'SUCCESS';
    if (!ok) return { ok: false, reason: result?.errorMessage || result?.mdStatus ? `3D/ödeme başarısız (${result.errorMessage || result.mdStatus})` : 'Ödeme tamamlanmadı' };
    if (result.basketId && result.basketId !== order.orderNumber) return { ok: false, reason: 'Sepet kimliği uyuşmuyor' };
    if (Math.abs(Number(result.price) - order.totalAmount) > 0.01) return { ok: false, reason: 'Tutar uyuşmuyor' };
    return { ok: true, transactionId: String(result.paymentId) };
}
