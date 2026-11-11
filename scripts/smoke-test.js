/**
 * Uçtan uca duman testi — çalışan bir sunucuya karşı ana akışları dener.
 *   BASE_URL=http://localhost:3000 npm run test:smoke
 * Admin adımları için: ADMIN_EMAIL / ADMIN_PASSWORD
 * DİKKAT: Test kullanıcıları ve siparişler oluşturur, stok düşer. CANLI VERİTABANINA KARŞI ÇALIŞTIRMAYIN.
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000';
let failures = 0;

class Client {
    constructor() { this.cookies = new Map(); this.csrf = null; }
    async req(method, path, body) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
        if (method !== 'GET' && this.csrf) headers['X-CSRF-Token'] = this.csrf;
        const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
        for (const c of res.headers.getSetCookie?.() || []) {
            const [kv] = c.split(';');
            const i = kv.indexOf('=');
            this.cookies.set(kv.slice(0, i), kv.slice(i + 1));
        }
        const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
        if (data?.csrfToken) this.csrf = data.csrfToken;
        return { status: res.status, data, headers: res.headers };
    }
    get(p) { return this.req('GET', p); }
    post(p, b = {}) { return this.req('POST', p, b); }
    put(p, b = {}) { return this.req('PUT', p, b); }
    async init() { await this.get('/api/csrf-token'); return this; }
}

function check(name, cond, extra = '') {
    console.log(`${cond ? '✅' : '❌'} ${name}${!cond && extra ? ` → ${typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 300)}` : ''}`);
    if (!cond) failures++;
}

const checkout = (items, overrides = {}) => ({
    items,
    customer: { name: 'Test Müşteri', email: overrides.email || 'musteri@example.com', phone: '0532 123 45 67' },
    shippingAddress: { city: 'İzmir', district: 'Karşıyaka', addressLine: 'Örnek Mah. Deneme Sok. No:1 D:2', zipCode: '35500' },
    billing: { type: 'individual', sameAsShipping: true },
    paymentMethod: overrides.paymentMethod || 'bank_transfer',
    consents: { preInfo: true, distanceSales: true, kvkk: true, marketing: false }
});

async function main() {
    console.log(`🔎 ${BASE}\n`);
    const anon = await new Client().init();

    // --- Sağlık, SEO ---
    check('health', (await anon.get('/health')).status === 200);
    const robots = await anon.get('/robots.txt');
    check('robots.txt', robots.status === 200 && robots.data.includes('Sitemap:'));
    const sitemap = await anon.get('/sitemap.xml');
    check('sitemap.xml', sitemap.status === 200 && sitemap.data.includes('/urun/'));
    const sec = await anon.get('/');
    check('güvenlik başlıkları', !!sec.headers.get('content-security-policy') && sec.headers.get('x-frame-options') === 'DENY');
    check('/urunler.html → 301', (await anon.get('/urunler.html?q=x')).status === 301);

    // --- Katalog ---
    const products = (await anon.get('/api/products')).data;
    check('ürün listesi', Array.isArray(products) && products.length > 0, products);
    const variantP = products.find(p => p.variants.length && p.variants.some(v => v.stock > 1));
    const plainP = products.find(p => !p.variants.length && p.stock > 2);
    check('ürünlerde string id', /^[a-f0-9]{24}$/.test(products[0].id));
    const detail = await anon.get(`/api/products/${plainP.id}`);
    check('ürün detay API', detail.status === 200 && detail.data.id === plainP.id);
    const page = await anon.get(`/urun/${plainP.slug}-${plainP.id}`);
    check('ürün sayfası SSR meta', page.status === 200 && page.data.includes('og:title') && page.data.includes(plainP.name.split(' ')[0]));
    check('olmayan ürün 404', (await anon.get('/urun/olmayan-urun-aaaaaaaaaaaaaaaaaaaaaaaa')).status === 404);
    const search = (await anon.get(`/api/products?q=${encodeURIComponent(plainP.name.split(' ')[0])}`)).data;
    check('arama', search.some(p => p.id === plainP.id));

    // --- CSRF ---
    const noCsrf = new Client();
    check('CSRF tokensız POST reddedilir', (await noCsrf.post('/api/auth/login', { email: 'a@b.co', password: 'x' })).status === 403);

    // --- Misafir sepeti (quote) ---
    const quote = await anon.post('/api/cart/quote', { items: [{ productId: plainP.id, quantity: 999 }] });
    check('misafir sepet fiyat/stok doğrulama', quote.status === 200 && quote.data.items[0]?.problem === 'insufficient_stock', quote.data);

    // --- Kayıt / giriş ---
    const email = `test${Date.now()}@example.com`;
    const u = await new Client().init();
    const weak = await u.post('/api/auth/register', { name: 'Test', email, password: '123', kvkk: true });
    check('zayıf şifre reddedilir', weak.status === 400);
    const noKvkk = await u.post('/api/auth/register', { name: 'Test Kullanıcı', email, password: 'GucluSifre123' });
    check('KVKK onayı zorunlu', noKvkk.status === 400);
    const reg = await u.post('/api/auth/register', { name: 'Test Kullanıcı', email: email.toUpperCase(), password: 'GucluSifre123', kvkk: true });
    check('kayıt (e-posta küçük harfe çevrilir)', reg.status === 201 && reg.data.user.email === email, reg.data);
    check('me', (await u.get('/api/auth/me')).data.user?.email === email);

    // --- Üye sepeti ---
    const noVariant = await u.post('/api/cart/add', { productId: variantP.id, quantity: 1 });
    check('varyantlı ürün beden seçmeden eklenmez', noVariant.status === 400);
    const size = variantP.variants.find(v => v.stock > 1).size;
    let cart = await u.post('/api/cart/add', { productId: variantP.id, selectedVariant: size, quantity: 1 });
    check('sepete ekle (varyant)', cart.status === 200 && cart.data.items.length === 1, cart.data);
    cart = await u.post('/api/cart/add', { productId: plainP.id, quantity: 2 });
    cart = await u.post('/api/cart/update', { productId: plainP.id, quantity: 1 });
    check('adet güncelle', cart.data.items.find(i => i.productId === plainP.id)?.quantity === 1);
    const tooMany = await u.post('/api/cart/add', { productId: plainP.id, quantity: 99 });
    check('stok üstü ekleme reddedilir', tooMany.status === 409);
    const merged = await u.post('/api/cart/merge', { items: [{ productId: plainP.id, quantity: 2 }] });
    check('misafir sepeti birleştirme', merged.data.items.find(i => i.productId === plainP.id)?.quantity === 2);

    // --- Sipariş (havale) ---
    const before = (await anon.get(`/api/products/${plainP.id}`)).data.stock;
    const badCheckout = await u.post('/api/orders', { ...checkout(cart.data.items), consents: {} });
    check('sözleşme onayı olmadan sipariş reddedilir', badCheckout.status === 400 && badCheckout.data.details?.['consents.distanceSales']);
    const items = (await u.get('/api/cart')).data.items.map(i => ({ productId: i.productId, selectedVariant: i.selectedVariant, quantity: i.quantity }));
    const order = await u.post('/api/orders', checkout(items, { email }));
    check('sipariş oluştu (havale)', order.status === 201 && /^AQ-\d{6}-[A-Z0-9]{5}$/.test(order.data.orderNumber), order.data);
    check('havale IBAN bilgisi döner', !!order.data.order?.bank?.iban);
    const after = (await anon.get(`/api/products/${plainP.id}`)).data.stock;
    check('stok düştü', after === before - 2, { before, after });
    check('sepet temizlendi', (await u.get('/api/cart')).data.items.length === 0);
    check('siparişlerim', (await u.get('/api/orders')).data.some(o => o.orderNumber === order.data.orderNumber));
    check('başkası siparişi göremez', (await anon.get(`/api/orders/${order.data.orderNumber}`)).status === 404);
    check('e-posta ile misafir takibi', (await anon.get(`/api/orders/${order.data.orderNumber}?email=${encodeURIComponent(email)}`)).status === 200);

    // --- Fiyat manipülasyonu: istemci fiyatı yok sayılır ---
    const guest = await new Client().init();
    const g = await guest.post('/api/orders', checkout([{ productId: plainP.id, quantity: 1, price: 1 }], { email: 'misafir@example.com' }));
    check('misafir siparişi + sunucu fiyatı', g.status === 201 && g.data.order.totalAmount >= plainP.price, g.data);
    const cancel = await guest.post(`/api/orders/${g.data.orderNumber}/cancel`);
    check('ödeme bekleyen sipariş iptali', cancel.status === 200 && cancel.data.status === 'cancelled', cancel.data);
    check('iptalde stok iade', (await anon.get(`/api/products/${plainP.id}`)).data.stock === after);

    // --- Eşzamanlı sipariş: son stok tek kişiye satılır ---
    const last = products.find(p => !p.variants.length && p.id !== plainP.id && p.stock >= 1);
    if (last && process.env.ADMIN_EMAIL) {
        const adm = await new Client().init();
        await adm.post('/api/auth/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
        await adm.put(`/api/admin/products/${last.id}`, { stock: 2 }); // sipariş rate limit'ine takılmamak için küçük stok
        const cur = (await anon.get(`/api/products/${last.id}`)).data.stock;
        const buyers = await Promise.all(Array.from({ length: cur + 3 }, async (_, i) => (await new Client().init())));
        const results = await Promise.all(buyers.map((b, i) => b.post('/api/orders', checkout([{ productId: last.id, quantity: 1 }], { email: `yaris${i}@example.com` }))));
        const ok = results.filter(r => r.status === 201).length;
        const finalStock = (await anon.get(`/api/products/${last.id}`)).data.stock;
        check(`yarış durumu: ${cur} stok için ${buyers.length} eşzamanlı sipariş → ${ok} başarılı`, ok === cur && finalStock === 0, { ok, cur, finalStock });
    }

    // --- Kart (test sağlayıcı) ---
    const cfg = (await anon.get('/api/config')).data;
    if (cfg.paymentMethods.includes('card')) {
        const c = await new Client().init();
        const r = await c.post('/api/orders', checkout([{ productId: plainP.id, quantity: 1 }], { paymentMethod: 'card', email: 'kart@example.com' }));
        check('kart siparişi yönlendirme döner', r.status === 201 && r.data.next === 'redirect', r.data);
        if (r.data.redirectUrl?.startsWith('/')) {
            const st = await c.get(`/api/orders/${r.data.orderNumber}`);
            check('test ödemesi → paid', st.data.status === 'paid', st.data);
        }
    }

    // --- Chat ---
    const chat = await new Client().init();
    const hist = await chat.get('/api/chat/history');
    check('chat karşılama + hızlı aksiyonlar', hist.data.messages[0]?.quickReplies?.length >= 5);
    let m = await chat.post('/api/chat/message', { text: 'kargo ücreti ne kadar' });
    check('SSS: kargo', /kargo/i.test(m.data.messages[0]?.text), m.data);
    m = await chat.post('/api/chat/message', { text: `${plainP.name.split(' ')[0]} stokta var mı` });
    check('stok/fiyat sorgusu ürün kartı döner', m.data.messages[0]?.products?.length > 0, m.data);
    m = await chat.post('/api/chat/message', { text: `siparişim ${order.data.orderNumber} nerede` });
    check('sipariş no ile sorgu e-posta ister', /e-posta/i.test(m.data.messages[0]?.text), m.data);
    m = await chat.post('/api/chat/message', { text: 'yanlis@example.com' });
    check('yanlış e-posta reddedilir', /bulamadım/i.test(m.data.messages[0]?.text), m.data);
    m = await chat.post('/api/chat/message', { text: email });
    check('doğru e-posta ile sipariş durumu', m.data.messages[0]?.text?.includes(order.data.orderNumber), m.data);
    m = await chat.post('/api/chat/message', { action: 'order_status' });
    m = await chat.post('/api/chat/message', { text: 'kargo ücreti ne kadar' });
    check('akış ortasında konu değiştirilebilir', /kargo/i.test(m.data.messages[0]?.text) && !/sipariş numarası/i.test(m.data.messages[0]?.text), m.data);
    m = await chat.post('/api/chat/message', { action: 'recommend' });
    check('ürün önerisi kategori sorar', m.data.messages[0]?.quickReplies?.length > 0);
    m = await chat.post('/api/chat/message', { action: 'recommend', payload: m.data.messages[0].quickReplies[0].payload });
    check('kategoriye göre öneri', m.data.messages[0]?.products?.length > 0, m.data);
    m = await chat.post('/api/chat/message', { text: 'canlı desteğe bağlan' });
    check('canlı destek iletişim ister (misafir)', /e-posta|telefon/i.test(m.data.messages[0]?.text));
    m = await chat.post('/api/chat/message', { text: '0532 111 22 33' });
    check('canlı destek talebi oluştu', /TK-/.test(m.data.messages[0]?.text), m.data);
    const hist2 = await chat.get('/api/chat/history');
    check('konuşma geçmişi saklanıyor', hist2.data.messages.length >= 10, hist2.data.messages.length);

    // Üye iade akışı (sipariş ödenmiş olmalı → admin ile onaylanır)
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        const admin = await new Client().init();
        const login = await admin.post('/api/auth/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
        check('admin giriş', login.status === 200 && login.data.user.isAdmin);
        const list = (await admin.get(`/api/admin/orders?q=${order.data.orderNumber}`)).data;
        const id = list[0]?._id;
        let r = await admin.put(`/api/admin/orders/${id}/status`, { status: 'paid', notify: false });
        check('admin havale onayı → paid', r.data.status === 'paid', r.data);
        r = await admin.put(`/api/admin/orders/${id}/status`, { status: 'shipped', notify: false });
        check('takip no olmadan kargoya verilemez', r.status === 400);
        r = await admin.put(`/api/admin/orders/${id}/status`, { status: 'shipped', carrier: 'Yurtiçi', trackingNumber: '123456', notify: false });
        check('kargoya verildi', r.data.status === 'shipped');
        check('admin istatistik', (await admin.get('/api/admin/stats')).status === 200);
        check('normal kullanıcı admin API\'ye erişemez', (await u.get('/api/admin/orders')).status === 403);

        m = await u.post('/api/chat/message', { action: 'return_request' });
        check('üye iade: sipariş listesi', m.data.messages[0]?.quickReplies?.some(q => q.payload?.orderNumber === order.data.orderNumber), m.data);
        m = await u.post('/api/chat/message', { action: 'return_request', payload: { orderNumber: order.data.orderNumber } });
        m = await u.post('/api/chat/message', { action: 'return_kind', payload: { kind: 'exchange' } });
        m = await u.post('/api/chat/message', { action: 'return_reason', payload: { reason: 'Beden uymadı' } });
        m = await u.post('/api/chat/message', { text: 'M beden istiyorum' });
        check('iade/değişim talebi oluştu', /TK-/.test(m.data.messages[0]?.text), m.data);
        const tickets = (await admin.get('/api/admin/tickets')).data;
        check('talepler admin panelinde', tickets.some(t => t.type === 'exchange' && t.orderNumber === order.data.orderNumber));
    }

    // --- Şifre sıfırlama (bilgi sızdırmaz) ---
    const fp = await anon.post('/api/auth/forgot-password', { email: 'yok@example.com' });
    check('şifremi unuttum her durumda aynı yanıt', fp.status === 200 && fp.data.success);

    console.log(`\n${failures ? `❌ ${failures} kontrol başarısız` : '✅ Tüm kontroller geçti'}`);
    process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error('Test çöktü:', e); process.exit(1); });
