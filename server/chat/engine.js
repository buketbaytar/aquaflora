import crypto from 'crypto';
import { Order, STATUS_LABELS_TR } from '../../src/models/Order.js';
import { Category } from '../../src/models/Category.js';
import { SupportTicket } from '../../src/models/SupportTicket.js';
import { config } from '../config.js';
import { mails } from '../lib/mailer.js';
import { email as vEmail, phoneTR, str } from '../lib/validate.js';
import { searchProducts, normalizeTR } from '../services/catalog.js';
import { ORDER_NO_RE } from '../services/orders.js';
import { faqEntries } from './faq.js';

/**
 * Kural tabanlı, çözüm ve satış odaklı müşteri asistanı.
 * - Ücretsiz ve öngörülebilir: yanlış ticari taahhütte bulunmaz, LLM maliyeti yoktur.
 * - Her yanıt hızlı aksiyon butonları (quickReplies), ürün kartları ve linkler içerebilir.
 * - Çok adımlı akışlar `conv.pending` alanında tutulur (iade talebi, sipariş sorgulama...).
 */

const tl = (n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n || 0);
const dateTR = (d) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

export const MAIN_MENU = [
    { label: '📦 Siparişim nerede?', action: 'order_status' },
    { label: '↩️ İade / Değişim', action: 'return_request' },
    { label: '✨ Ürün önerisi', action: 'recommend' },
    { label: '🔎 Stok & fiyat sorgula', action: 'stock_query' },
    { label: '❓ Sık sorulanlar', action: 'faq_menu' },
    { label: '🎧 Canlı desteğe bağlan', action: 'live_support' }
];

const bot = (text, extra = {}) => ({ role: 'bot', text, ...extra });

export function welcomeMessage(user) {
    return bot(`Merhaba${user?.name ? ` ${user.name.split(' ')[0]}` : ''}! 👋 Ben ${config.siteName} asistanı. Siparişinizi takip edebilir, iade talebi oluşturabilir, ürün önerebilir ve stok/fiyat bilgisi verebilirim. Nasıl yardımcı olayım?`,
        { quickReplies: MAIN_MENU });
}

/* ---------------- Niyet tespiti ---------------- */
const INTENTS = [
    { intent: 'live_support', words: ['canli destek', 'temsilci', 'yetkili', 'insanla', 'musteri hizmet', 'gercek kisi', 'operator', 'baglan'] },
    { intent: 'return_request', words: ['iade', 'degisim', 'degistir', 'geri gonder', 'cayma', 'iptal'] },
    { intent: 'order_status', words: ['siparis', 'kargom', 'kargo nerede', 'takip', 'nerede kaldi', 'gelmedi', 'ulasmadi'] },
    { intent: 'stock_query', words: ['stok', 'fiyat', 'kac para', 'kac tl', 'ne kadar', 'var mi', 'varmi', 'mevcut mu', 'kalmis mi'] },
    { intent: 'recommend', words: ['oner', 'tavsiye', 'ne almali', 'hangisi', 'hangi urun', 'yeni basla', 'baslangic', 'hediye'] },
    { intent: 'greeting', words: ['merhaba', 'selam', 'iyi gunler', 'gunaydin', 'iyi aksamlar', 'hey'] },
    { intent: 'thanks', words: ['tesekkur', 'sagol', 'sag ol', 'eyvallah', 'tamamdir', 'super'] },
    { intent: 'menu', words: ['menu', 'basa don', 'ana menu', 'yardim'] }
];

// Ürün aramasında anlamsız kelimeler
const STOPWORDS = new Set(['stok', 'stokta', 'stoklarda', 'var', 'mi', 'mu', 'fiyat', 'fiyati', 'fiyatı', 'kac', 'para', 'tl', 'lira', 'ne', 'kadar',
    'urun', 'urunu', 'icin', 'bir', 'bu', 'su', 'sizde', 'varmi', 'mevcut', 'kalmis', 'acaba', 'merhaba', 'selam', 'lutfen', 'ben', 'bana',
    'istiyorum', 'arıyorum', 'ariyorum', 've', 'ile', 'de', 'da', 'oner', 'onerir', 'misiniz', 'tavsiye', 'en', 'iyi', 'hangi', 'hangisi']);

function detectIntent(norm) {
    let best = null, bestScore = 0;
    for (const { intent, words } of INTENTS) {
        const score = words.reduce((s, w) => s + (norm.includes(w) ? w.length : 0), 0);
        if (score > bestScore) { best = intent; bestScore = score; }
    }
    return best;
}

function matchFaq(norm) {
    let best = null, bestScore = 0;
    for (const f of faqEntries()) {
        const score = f.keywords.reduce((s, k) => s + (norm.includes(k) ? k.length : 0), 0);
        if (score > bestScore) { best = f; bestScore = score; }
    }
    return bestScore >= 4 ? best : null;
}

const productQuery = (norm) => norm.split(' ').filter(t => t.length > 1 && !STOPWORDS.has(t)).join(' ');

/* ---------------- Yardımcılar ---------------- */
function productCards(list) {
    return list.slice(0, 4).map(p => ({
        id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image, inStock: p.inStock, hasVariants: p.variants.length > 0,
        stockText: p.variants.length
            ? p.variants.map(v => `${v.size}: ${v.stock > 0 ? (v.stock <= 3 ? `son ${v.stock}` : 'var') : 'yok'}`).join(' · ')
            : (p.stock > 0 ? (p.stock <= 3 ? `Son ${p.stock} adet` : 'Stokta') : 'Tükendi')
    }));
}

function orderSummaryText(o) {
    const label = STATUS_LABELS_TR[o.status] || o.status;
    let t = `📦 ${o.orderNumber} — ${dateTR(o.createdAt)}\nDurum: ${label}\nTutar: ${tl(o.totalAmount)}`;
    if (o.status === 'shipped' && o.shipment?.trackingNumber) {
        t += `\nKargo: ${o.shipment.carrier || ''} · Takip no: ${o.shipment.trackingNumber}`;
    } else if (o.status === 'paid' || o.status === 'preparing') {
        t += `\nTahmini kargoya veriliş: ${config.shipping.estimatedDays}`;
    } else if (o.status === 'pending_payment' && o.paymentMethod === 'bank_transfer') {
        t += `\nHavale/EFT ödemeniz bekleniyor. Açıklamaya sipariş numaranızı yazmayı unutmayın.`;
    }
    return t;
}

function orderLinks(o) {
    const links = [{ label: 'Sipariş detayı', href: `/siparis-takip?no=${encodeURIComponent(o.orderNumber)}` }];
    if (o.shipment?.trackingUrl) links.push({ label: 'Kargo takibi', href: o.shipment.trackingUrl });
    return links;
}

async function newTicketNumber() {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `TK-${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function supportChannels(ticketNumber) {
    const links = [];
    if (config.support.whatsapp) {
        const msg = encodeURIComponent(`Merhaba, destek talep numaram: ${ticketNumber}`);
        links.push({ label: '💬 WhatsApp ile yaz', href: `https://wa.me/${config.support.whatsapp}?text=${msg}` });
    }
    if (config.support.phone) links.push({ label: `📞 ${config.support.phone}`, href: `tel:${config.support.phone.replace(/\s/g, '')}` });
    if (config.support.email) links.push({ label: `✉️ ${config.support.email}`, href: `mailto:${config.support.email}?subject=${encodeURIComponent(ticketNumber)}` });
    return links;
}

async function findOrderForUser(user, orderNumber) {
    return Order.findOne({ orderNumber: orderNumber.toUpperCase(), userId: user._id }).lean();
}

async function findOrderForGuest(orderNumber, em) {
    return Order.findOne({ orderNumber: orderNumber.toUpperCase(), 'customer.email': em }).lean();
}

/* ---------------- Akışlar ---------------- */
async function flowOrderStatus(ctx, { orderNumber } = {}) {
    const { user, conv } = ctx;
    if (orderNumber) {
        const o = user ? await findOrderForUser(user, orderNumber)
            : (ctx.sessionOrders?.includes(orderNumber.toUpperCase())
                ? await Order.findOne({ orderNumber: orderNumber.toUpperCase() }).lean()
                : (conv.verifiedEmail ? await findOrderForGuest(orderNumber, conv.verifiedEmail) : null));
        if (o) {
            conv.pending = null;
            return [bot(orderSummaryText(o), { links: orderLinks(o), quickReplies: [{ label: '↩️ Bu sipariş için iade', action: 'return_request', payload: { orderNumber: o.orderNumber } }, ...MAIN_MENU.slice(4)] })];
        }
        conv.pending = { type: 'order_lookup_email', orderNumber: orderNumber.toUpperCase(), attempts: 0 };
        return [bot(`${orderNumber.toUpperCase()} numaralı siparişi doğrulamam için siparişte kullandığınız e-posta adresini yazar mısınız?`)];
    }
    if (user) {
        const orders = await Order.find({ userId: user._id }).sort({ createdAt: -1 }).limit(3).lean();
        if (!orders.length) return [bot('Hesabınızda henüz sipariş görünmüyor. Üye olmadan sipariş verdiyseniz sipariş numaranızı (ör. AQ-250101-ABCDE) yazabilirsiniz.', { quickReplies: MAIN_MENU })];
        conv.pending = null;
        return orders.map(o => bot(orderSummaryText(o), { links: orderLinks(o) }))
            .concat([bot('Başka bir konuda yardımcı olabilir miyim?', { quickReplies: [{ label: '↩️ İade / Değişim', action: 'return_request' }, { label: '🎧 Canlı destek', action: 'live_support' }, { label: '🏠 Ana menü', action: 'menu' }] })]);
    }
    if (ctx.sessionOrders?.length) {
        // Bu tarayıcı oturumunda verilen siparişler doğrulama gerekmeden gösterilir
        const orders = await Order.find({ orderNumber: { $in: ctx.sessionOrders } }).sort({ createdAt: -1 }).limit(3).lean();
        if (orders.length) {
            conv.pending = null;
            return orders.map(o => bot(orderSummaryText(o), { links: orderLinks(o) }))
                .concat([bot('Başka bir siparişi sorgulamak için sipariş numarasını yazabilirsiniz.', { quickReplies: [{ label: '🎧 Canlı destek', action: 'live_support' }, { label: '🏠 Ana menü', action: 'menu' }] })]);
        }
    }
    conv.pending = { type: 'order_lookup_number', attempts: 0 };
    return [bot('Siparişinizi bulmam için sipariş numaranızı yazar mısınız? (Sipariş onay e-postanızda yer alır, ör. AQ-250101-ABCDE)', {
        quickReplies: [{ label: '🔑 Giriş yap', action: 'open_login' }, { label: '🏠 Ana menü', action: 'menu' }]
    })];
}

const RETURN_REASONS = ['Beden uymadı', 'Kusurlu / hasarlı ürün', 'Yanlış ürün gönderildi', 'Beklentimi karşılamadı', 'Fikrimi değiştirdim'];

async function flowReturn(ctx, { orderNumber, kind } = {}) {
    const { user, conv } = ctx;
    if (!orderNumber) {
        if (user) {
            const since = new Date(Date.now() - 60 * 24 * 3600 * 1000);
            const orders = await Order.find({ userId: user._id, status: { $in: ['paid', 'preparing', 'shipped', 'delivered'] }, createdAt: { $gte: since } })
                .sort({ createdAt: -1 }).limit(5).lean();
            if (!orders.length) {
                return [bot('Son 60 günde iade edilebilecek bir siparişiniz görünmüyor. Farklı bir konuda yardım için canlı desteğe bağlanabilirsiniz.', { quickReplies: [{ label: '🎧 Canlı destek', action: 'live_support' }, { label: '🏠 Ana menü', action: 'menu' }] })];
            }
            conv.pending = { type: 'return_order' };
            return [bot('Hangi siparişiniz için iade/değişim talebi oluşturmak istiyorsunuz?', {
                quickReplies: orders.map(o => ({ label: `${o.orderNumber} · ${tl(o.totalAmount)}`, action: 'return_request', payload: { orderNumber: o.orderNumber } }))
            })];
        }
        conv.pending = { type: 'return_order' };
        return [bot('İade/değişim talebi için sipariş numaranızı yazar mısınız? (ör. AQ-250101-ABCDE)', {
            links: [{ label: 'İade koşulları', href: '/iade-kosullari.html' }]
        })];
    }

    // Sipariş doğrulama
    let order = null;
    if (user) order = await findOrderForUser(user, orderNumber);
    if (!order && ctx.sessionOrders?.includes(orderNumber.toUpperCase())) order = await Order.findOne({ orderNumber: orderNumber.toUpperCase() }).lean();
    if (!order && conv.verifiedEmail) order = await findOrderForGuest(orderNumber, conv.verifiedEmail);
    if (!order) {
        conv.pending = { type: 'return_email', orderNumber: orderNumber.toUpperCase(), attempts: 0 };
        return [bot('Siparişi doğrulamak için siparişte kullandığınız e-posta adresini yazar mısınız?')];
    }
    if (!['paid', 'preparing', 'shipped', 'delivered'].includes(order.status)) {
        conv.pending = null;
        const txt = order.status === 'pending_payment'
            ? 'Bu siparişin ödemesi henüz tamamlanmadığı için iade gerekmez; ödeme yapılmazsa sipariş otomatik iptal olur.'
            : `Bu sipariş "${STATUS_LABELS_TR[order.status] || order.status}" durumunda olduğu için iade talebi oluşturulamıyor.`;
        return [bot(txt, { quickReplies: [{ label: '🎧 Canlı destek', action: 'live_support' }, { label: '🏠 Ana menü', action: 'menu' }] })];
    }

    if (!kind) {
        conv.pending = { type: 'return_kind', orderNumber: order.orderNumber, email: order.customer?.email };
        const deliveredAt = order.statusHistory?.find(h => h.status === 'delivered')?.at;
        let note = '';
        if (deliveredAt) {
            const days = Math.floor((Date.now() - new Date(deliveredAt)) / 86400000);
            note = days > 14 ? `\n⚠️ Teslimattan bu yana ${days} gün geçmiş; 14 günlük cayma süresi dolmuş olabilir. Kusurlu ürünlerde yine de talep oluşturabilirsiniz.` : `\nTeslimattan bu yana ${days} gün geçti, cayma süreniz devam ediyor.`;
        } else if (['paid', 'preparing'].includes(order.status)) {
            note = '\nSiparişiniz henüz kargoya verilmedi; isterseniz iptal talebi de oluşturabilirsiniz.';
        }
        return [bot(`${order.orderNumber} numaralı sipariş için ne yapmak istersiniz?${note}`, {
            quickReplies: [
                { label: '↩️ İade (para iadesi)', action: 'return_kind', payload: { kind: 'return' } },
                { label: '🔁 Değişim', action: 'return_kind', payload: { kind: 'exchange' } },
                ...(['paid', 'preparing'].includes(order.status) ? [{ label: '✖️ İptal talebi', action: 'return_kind', payload: { kind: 'order_issue' } }] : [])
            ]
        })];
    }
    return [];
}

async function createTicket(ctx, data) {
    const { user, conv } = ctx;
    const ticket = await SupportTicket.create({
        ticketNumber: await newTicketNumber(),
        userId: user?._id,
        name: user?.name || data.name,
        email: user?.email || data.email,
        phone: user?.phone || data.phone,
        conversationId: conv._id,
        ...data
    });
    mails.adminNewTicket(ticket);
    return ticket;
}

async function flowLiveSupport(ctx, { contact } = {}) {
    const { user, conv } = ctx;
    if (!user && !contact) {
        conv.pending = { type: 'support_contact', attempts: 0 };
        return [bot(`Sizi ekibimize aktarıyorum. Size dönebilmemiz için e-posta adresinizi veya cep telefonu numaranızı yazar mısınız? (Çalışma saatlerimiz: ${config.support.hours})`, {
            links: supportChannels('Yeni talep').slice(0, 1)
        })];
    }
    const lastUserMsgs = conv.messages.filter(m => m.role === 'user').slice(-5).map(m => m.text).join(' | ');
    const ticket = await createTicket(ctx, {
        type: 'live_support',
        message: str(lastUserMsgs, 1500),
        ...(contact || {})
    });
    conv.status = 'handoff';
    conv.pending = null;
    return [bot(`Talebiniz oluşturuldu ✅ Talep no: ${ticket.ticketNumber}\nEkibimiz ${config.support.hours} arasında en kısa sürede size dönecek. Daha hızlı yanıt için aşağıdaki kanallardan da ulaşabilirsiniz.`, {
        links: supportChannels(ticket.ticketNumber),
        quickReplies: [{ label: '🏠 Ana menü', action: 'menu' }]
    })];
}

async function flowRecommend(ctx, { category, max } = {}, norm = '') {
    const { conv } = ctx;
    const cats = await Category.find().sort({ name: 1 }).limit(8).lean();

    if (!category && norm) {
        const hit = cats.find(c => norm.includes(normalizeTR(c.name).split(' ')[0]));
        if (hit) category = String(hit._id);
    }
    if (!category && !norm) {
        conv.pending = { type: 'recommend_category' };
        return [bot('Hangi aktivite için ürün arıyorsunuz?', {
            quickReplies: [
                ...cats.map(c => ({ label: c.name, action: 'recommend', payload: { category: String(c._id) } })),
                { label: '⭐ Çok satanlar', action: 'recommend', payload: { category: 'all' } }
            ]
        })];
    }
    const q = norm ? productQuery(norm) : '';
    let list = await searchProducts({
        category: category && category !== 'all' ? category : undefined,
        q: category ? undefined : q,
        maxPrice: max,
        inStock: true,
        sort: 'popular'
    });
    const featured = list.filter(p => p.isFeatured);
    list = [...featured, ...list.filter(p => !p.isFeatured)];
    conv.pending = null;

    if (!list.length) {
        return [bot('Bu kriterlere uygun stokta ürün bulamadım. Bütçenizi veya kategoriyi değiştirelim mi?', {
            quickReplies: [{ label: '✨ Kategori seç', action: 'recommend' }, { label: '🎧 Uzmana sor', action: 'live_support' }]
        })];
    }
    const budgets = [1000, 5000, 15000];
    return [bot(`Sizin için seçtiğim ürünler${max ? ` (${tl(max)} altı)` : ''}:`, {
        products: productCards(list),
        quickReplies: [
            ...(!max && category ? budgets.map(b => ({ label: `💰 ${tl(b)} altı`, action: 'recommend', payload: { category, max: b } })) : []),
            { label: '🔎 Tüm ürünler', action: 'navigate', payload: { href: category && category !== 'all' ? `/urunler?category=${category}` : '/urunler' } },
            { label: '🎧 Uzmana sor', action: 'live_support' }
        ]
    })];
}

async function flowStock(ctx, norm) {
    const { conv } = ctx;
    const q = productQuery(norm || '');
    if (!q) {
        conv.pending = { type: 'stock_query' };
        return [bot('Hangi ürünün stok ve fiyat bilgisini öğrenmek istersiniz? Ürün adını veya markasını yazın.')];
    }
    const all = await searchProducts({ q });
    conv.pending = null;
    if (!all.length) {
        return [bot(`"${q}" ile eşleşen bir ürün bulamadım. Farklı bir kelimeyle tekrar dener misiniz?`, {
            quickReplies: [{ label: '🔎 Yeniden ara', action: 'stock_query' }, { label: '✨ Ürün önerisi', action: 'recommend' }, { label: '🎧 Canlı destek', action: 'live_support' }]
        })];
    }
    const top = all[0];
    let text;
    if (all.length === 1 || normalizeTR(top.name).includes(q)) {
        const stockLine = top.variants.length
            ? top.variants.map(v => `${v.size}: ${v.stock > 0 ? `${v.stock} adet` : 'tükendi'}`).join(', ')
            : (top.stock > 0 ? `${top.stock} adet stokta` : 'şu anda stokta yok');
        text = `${top.name}\nFiyat: ${tl(top.price)}\nStok: ${stockLine}`;
        if (!top.inStock) text += '\nStoğa girdiğinde haber almak için canlı destekten talep bırakabilirsiniz.';
    } else {
        text = `"${q}" için ${all.length} ürün buldum:`;
    }
    return [bot(text, { products: productCards(all), quickReplies: [{ label: '🔎 Başka ürün sor', action: 'stock_query' }, { label: '🏠 Ana menü', action: 'menu' }] })];
}

function faqMenu() {
    return [bot('Sık sorulan konular:', {
        quickReplies: faqEntries().map(f => ({ label: f.title, action: 'faq', payload: { key: f.key } }))
    })];
}

function faqAnswer(entry) {
    return [bot(entry.answer, {
        links: entry.links || [],
        quickReplies: [{ label: '❓ Diğer sorular', action: 'faq_menu' }, { label: '🎧 Canlı destek', action: 'live_support' }, { label: '🏠 Ana menü', action: 'menu' }]
    })];
}

/* ---------------- Bekleyen adıma gelen serbest metin ---------------- */
async function handlePending(ctx, text, norm) {
    const { conv } = ctx;
    const p = conv.pending;
    const orderNo = text.match(ORDER_NO_RE)?.[1];
    const tooMany = () => { conv.pending = null; return [bot('Bilgileri doğrulayamadım. Güvenliğiniz için canlı destekten yardım alabilirsiniz.', { quickReplies: [{ label: '🎧 Canlı destek', action: 'live_support' }, { label: '🏠 Ana menü', action: 'menu' }] })]; };

    switch (p.type) {
        case 'order_lookup_number':
            if (orderNo) return flowOrderStatus(ctx, { orderNumber: orderNo });
            if (++p.attempts >= 3) return tooMany();
            conv.markModified('pending');
            return [bot('Sipariş numarası "AQ-" ile başlar ve onay e-postanızda yer alır (ör. AQ-250101-ABCDE). Tekrar yazar mısınız?')];

        case 'order_lookup_email':
        case 'return_email': {
            const em = vEmail(text);
            if (!em) {
                if (++p.attempts >= 3) return tooMany();
                conv.markModified('pending');
                return [bot('Geçerli bir e-posta adresi yazar mısınız?')];
            }
            const o = await findOrderForGuest(p.orderNumber, em);
            if (!o) {
                if (++p.attempts >= 3) return tooMany();
                conv.markModified('pending');
                return [bot('Bu sipariş numarası ve e-posta ile eşleşen bir sipariş bulamadım. Bilgileri kontrol edip tekrar dener misiniz?')];
            }
            conv.verifiedEmail = em;
            if (p.type === 'order_lookup_email') {
                conv.pending = null;
                return [bot(orderSummaryText(o), { links: orderLinks(o), quickReplies: [{ label: '↩️ Bu sipariş için iade', action: 'return_request', payload: { orderNumber: o.orderNumber } }, { label: '🏠 Ana menü', action: 'menu' }] })];
            }
            conv.pending = null;
            return flowReturn(ctx, { orderNumber: o.orderNumber });
        }

        case 'return_order':
            if (orderNo) return flowReturn(ctx, { orderNumber: orderNo });
            return [bot('Lütfen sipariş numaranızı yazın (ör. AQ-250101-ABCDE).')];

        case 'return_kind':
            return [bot('Lütfen yukarıdaki seçeneklerden birini seçin.')];

        case 'return_reason':
            p.reason = str(text, 200);
            conv.pending = { ...p, type: 'return_note' };
            return [bot('Eklemek istediğiniz bir açıklama var mı? (Kusurlu ürünlerde fotoğrafı daha sonra e-posta ile isteyeceğiz)', { quickReplies: [{ label: 'Açıklama yok, gönder', action: 'return_submit' }] })];

        case 'return_note':
            return submitReturn(ctx, str(text, 1000));

        case 'support_contact': {
            const em = vEmail(text);
            const ph = phoneTR(text);
            if (!em && !ph) {
                if (++p.attempts >= 3) { conv.pending = null; return [bot('İletişim bilgisi alamadım. Aşağıdaki kanallardan doğrudan ulaşabilirsiniz.', { links: supportChannels('Yeni talep') })]; }
                conv.markModified('pending');
                return [bot('Geçerli bir e-posta adresi veya cep telefonu numarası (5XX XXX XX XX) yazar mısınız?')];
            }
            return flowLiveSupport(ctx, { contact: { email: em || undefined, phone: ph || undefined } });
        }

        case 'stock_query':
            return flowStock(ctx, norm);

        case 'recommend_category':
            return flowRecommend(ctx, {}, norm);

        default:
            conv.pending = null;
            return null;
    }
}

async function submitReturn(ctx, note) {
    const { conv } = ctx;
    const p = conv.pending || {};
    if (!p.orderNumber || !p.kind) { conv.pending = null; return [bot('Talep bilgileri eksik kaldı, baştan başlayalım.', { quickReplies: [{ label: '↩️ İade / Değişim', action: 'return_request' }] })]; }
    const ticket = await createTicket(ctx, {
        type: p.kind,
        orderNumber: p.orderNumber,
        email: p.email,
        reason: p.reason,
        message: note || ''
    });
    conv.pending = null;
    const kindTR = { return: 'İade', exchange: 'Değişim', order_issue: 'İptal' }[p.kind] || 'Destek';
    return [bot(`${kindTR} talebiniz alındı ✅\nTalep no: ${ticket.ticketNumber}\nSipariş: ${p.orderNumber}\n\nEkibimiz 1 iş günü içinde e-posta ile ${p.kind === 'order_issue' ? 'iptal onayını' : 'ücretsiz kargo kodunu ve gönderim talimatlarını'} iletecek.`, {
        links: [{ label: 'İade koşulları', href: '/iade-kosullari.html' }, ...supportChannels(ticket.ticketNumber).slice(0, 1)],
        quickReplies: [{ label: '🏠 Ana menü', action: 'menu' }]
    })];
}

/* ---------------- Ana giriş noktası ---------------- */
export async function respond(ctx, { text, action, payload = {} }) {
    const { conv } = ctx;

    if (action) {
        switch (action) {
            case 'menu': conv.pending = null; return [bot('Size nasıl yardımcı olabilirim?', { quickReplies: MAIN_MENU })];
            case 'order_status': return flowOrderStatus(ctx, { orderNumber: payload.orderNumber });
            case 'return_request': return flowReturn(ctx, { orderNumber: payload.orderNumber });
            case 'return_kind': {
                const p = conv.pending || {};
                if (!p.orderNumber) return flowReturn(ctx, {});
                const kind = ['return', 'exchange', 'order_issue'].includes(payload.kind) ? payload.kind : 'return';
                conv.pending = { ...p, type: 'return_reason', kind };
                return [bot(kind === 'order_issue' ? 'İptal nedeninizi seçer misiniz?' : 'Nedenini seçer misiniz?', {
                    quickReplies: (kind === 'order_issue' ? ['Fikrimi değiştirdim', 'Yanlış ürün sipariş ettim', 'Teslimat süresi uzun', 'Diğer'] : RETURN_REASONS)
                        .map(r => ({ label: r, action: 'return_reason', payload: { reason: r } }))
                })];
            }
            case 'return_reason': {
                const p = conv.pending || {};
                if (!p.orderNumber) return flowReturn(ctx, {});
                conv.pending = { ...p, type: 'return_note', reason: str(payload.reason, 200) };
                return [bot('Eklemek istediğiniz bir açıklama var mı? Yazabilir veya doğrudan gönderebilirsiniz.', { quickReplies: [{ label: 'Açıklama yok, gönder', action: 'return_submit' }] })];
            }
            case 'return_submit': return submitReturn(ctx, '');
            case 'recommend': return flowRecommend(ctx, { category: payload.category, max: Number(payload.max) || undefined });
            case 'stock_query': return flowStock(ctx, '');
            case 'faq_menu': return faqMenu();
            case 'faq': {
                const f = faqEntries().find(e => e.key === payload.key);
                return f ? faqAnswer(f) : faqMenu();
            }
            case 'live_support': return flowLiveSupport(ctx);
            default: return [bot('Size nasıl yardımcı olabilirim?', { quickReplies: MAIN_MENU })];
        }
    }

    const clean = str(text, 500);
    if (!clean) return [];
    const norm = normalizeTR(clean);

    // 1) Mesajda sipariş numarası varsa doğrudan sipariş akışı
    const orderNo = clean.match(ORDER_NO_RE)?.[1];
    if (orderNo && !conv.pending) return flowOrderStatus(ctx, { orderNumber: orderNo });

    // 2) Devam eden çok adımlı bir akış varsa
    if (conv.pending) {
        const intent = detectIntent(norm);
        // Kullanıcı akışı bırakıp başka bir şey istediyse bekleyen adımı iptal et.
        // Yapılandırılmış girdi (sipariş no / e-posta / telefon) bekleyen adımlarda, girdi beklenen biçimde
        // değilse ve mesaj başka bir niyet/SSS içeriyorsa konu değişikliği kabul edilir.
        const STRUCTURED = { order_lookup_number: 'order', return_order: 'order', order_lookup_email: 'email', return_email: 'email', support_contact: 'contact' };
        const expects = STRUCTURED[conv.pending.type];
        const satisfies = expects === 'order' ? !!orderNo
            : expects === 'email' ? !!vEmail(clean)
                : expects === 'contact' ? !!(vEmail(clean) || phoneTR(clean)) : true;
        const switchingAway = (intent && ['live_support', 'menu'].includes(intent))
            || (!satisfies && (intent || matchFaq(norm)));
        if (!switchingAway) {
            const res = await handlePending(ctx, clean, norm);
            if (res) return res;
        } else conv.pending = null;
    }

    // 3) Niyet / SSS
    const intent = detectIntent(norm);
    const faq = matchFaq(norm);

    switch (intent) {
        case 'live_support': return flowLiveSupport(ctx);
        case 'return_request':
            // "iade şartları nedir" gibi bilgi soruları SSS'e gider
            if (faq?.key === 'returns' && /(sart|kosul|nedir|kac gun|sure)/.test(norm)) return faqAnswer(faq);
            return flowReturn(ctx, {});
        case 'order_status':
            if (faq && faq.key !== 'shipping') return faqAnswer(faq);
            if (faq?.key === 'shipping' && /(ucret|kac gun|ne zaman|sure|bedava|ucretsiz)/.test(norm) && !/(siparisim|kargom)/.test(norm)) return faqAnswer(faq);
            return flowOrderStatus(ctx, {});
        case 'stock_query': return flowStock(ctx, norm);
        case 'recommend': return flowRecommend(ctx, {}, productQuery(norm) ? norm : '');
        case 'greeting': if (!faq) return [welcomeMessage(ctx.user)]; break;
        case 'thanks': return [bot('Rica ederim! 😊 Başka bir konuda yardımcı olabilir miyim?', { quickReplies: MAIN_MENU })];
        case 'menu': return [bot('Size nasıl yardımcı olabilirim?', { quickReplies: MAIN_MENU })];
        default: break;
    }
    if (faq) return faqAnswer(faq);

    // 4) Son çare: ürün araması
    const q = productQuery(norm);
    if (q.length >= 3) {
        const found = await searchProducts({ q, limit: 4 });
        if (found.length) return [bot('Bununla ilgili şu ürünleri buldum:', { products: productCards(found), quickReplies: [{ label: '🔎 Stok & fiyat sor', action: 'stock_query' }, { label: '🏠 Ana menü', action: 'menu' }] })];
    }
    return [bot('Tam olarak anlayamadım 🤔 Aşağıdaki konulardan birini seçebilir veya canlı desteğe bağlanabilirsiniz.', { quickReplies: MAIN_MENU })];
}
