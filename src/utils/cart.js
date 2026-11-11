import { api } from './api.js';
import { Auth } from './auth.js';
import { toast } from './toast.js';

const LS_KEY = 'aq_cart_v1';

function readLocal() {
    try {
        const v = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        return Array.isArray(v) ? v.filter(i => i && i.productId) : [];
    } catch { return []; }
}
function writeLocal(items) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(items.map(i => ({ productId: i.productId, selectedVariant: i.selectedVariant || null, quantity: i.quantity }))));
    } catch { /* gizli sekme vb. */ }
}
const same = (a, productId, variant) => a.productId === productId && (a.selectedVariant || null) === (variant || null);

/**
 * Sepet:
 *  - Misafir: localStorage'da tutulur, fiyat/stok her seferinde sunucudan doğrulanır (/cart/quote)
 *  - Üye: sunucuda (MongoDB) tutulur → cihazlar arası senkron
 *  - Girişte misafir sepeti üye sepetiyle birleştirilir
 */
export const Cart = {
    items: [],
    loaded: false,
    listeners: new Set(),

    async load() {
        try {
            if (Auth.user) {
                this.items = (await api.get('/cart')).items;
            } else {
                const local = readLocal();
                this.items = local.length ? (await api.post('/cart/quote', { items: local })).items : [];
                writeLocal(this.items);
            }
        } catch (e) {
            console.warn('Sepet yüklenemedi:', e.message);
        }
        this.loaded = true;
        this.notify();
    },

    async onLogin() {
        const local = readLocal();
        try {
            if (local.length) {
                const d = await api.post('/cart/merge', { items: local });
                this.items = d.items;
                (d.notices || []).forEach(n => toast(n, 'warning'));
                localStorage.removeItem(LS_KEY);
            } else {
                this.items = (await api.get('/cart')).items;
            }
        } catch (e) {
            console.warn('Sepet birleştirilemedi:', e.message);
        }
        this.notify();
    },

    onLogout() {
        this.items = [];
        try { localStorage.removeItem(LS_KEY); } catch { /* */ }
        this.notify();
    },

    async add(product, selectedVariant = null, quantity = 1) {
        const productId = product.id;
        const hasVariants = (product.variants || []).length > 0;
        if (hasVariants && !selectedVariant) {
            toast('Lütfen önce beden/seçenek seçin', 'warning');
            return false;
        }
        try {
            if (Auth.user) {
                this.items = (await api.post('/cart/add', { productId, selectedVariant, quantity })).items;
            } else {
                const local = readLocal();
                const existing = local.find(i => same(i, productId, selectedVariant));
                const available = hasVariants ? (product.variants.find(v => v.size === selectedVariant)?.stock ?? 0) : product.stock;
                const wanted = (existing?.quantity || 0) + quantity;
                if (available !== undefined && wanted > available) {
                    toast(available > 0 ? `Bu üründen en fazla ${available} adet ekleyebilirsiniz` : 'Bu ürün stokta yok', 'warning');
                    return false;
                }
                if (existing) existing.quantity = wanted;
                else local.push({ productId, selectedVariant, quantity });
                this.items = (await api.post('/cart/quote', { items: local })).items;
                writeLocal(this.items);
            }
            this.notify();
            toast(`${product.name}${selectedVariant ? ` (${selectedVariant})` : ''} sepete eklendi`, 'success');
            return true;
        } catch (e) {
            toast(e.message, 'error');
            return false;
        }
    },

    async setQuantity(productId, selectedVariant, quantity) {
        try {
            if (Auth.user) {
                this.items = (await api.post('/cart/update', { productId, selectedVariant, quantity })).items;
            } else {
                let local = readLocal();
                if (quantity <= 0) local = local.filter(i => !same(i, productId, selectedVariant));
                else {
                    const line = this.items.find(i => same(i, productId, selectedVariant));
                    if (line && quantity > line.available) {
                        toast(`Stokta ${line.available} adet var`, 'warning');
                        return;
                    }
                    const it = local.find(i => same(i, productId, selectedVariant));
                    if (it) it.quantity = quantity;
                }
                this.items = local.length ? (await api.post('/cart/quote', { items: local })).items : [];
                writeLocal(this.items);
            }
            this.notify();
        } catch (e) {
            toast(e.message, 'error');
        }
    },

    async remove(productId, selectedVariant) {
        try {
            if (Auth.user) {
                this.items = (await api.post('/cart/remove', { productId, selectedVariant })).items;
            } else {
                const local = readLocal().filter(i => !same(i, productId, selectedVariant));
                this.items = local.length ? (await api.post('/cart/quote', { items: local })).items : [];
                writeLocal(this.items);
            }
            this.notify();
            toast('Ürün sepetten çıkarıldı');
        } catch (e) {
            toast(e.message, 'error');
        }
    },

    /** Sipariş sonrası */
    clear() {
        this.items = [];
        try { localStorage.removeItem(LS_KEY); } catch { /* */ }
        this.notify();
    },

    count() { return this.items.reduce((s, i) => s + i.quantity, 0); },
    subtotal() { return Math.round(this.items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100; },
    hasProblems() { return this.items.some(i => i.problem); },

    subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    notify() { this.listeners.forEach(fn => fn(this.items)); }
};
