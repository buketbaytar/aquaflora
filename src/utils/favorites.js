import { api } from './api.js';
import { Auth } from './auth.js';
import { toast } from './toast.js';

export const Favorites = {
    ids: new Set(),
    listeners: new Set(),

    async load() {
        if (!Auth.user) { this.ids = new Set(); this.notify(); return; }
        try {
            const list = await api.get('/favorites');
            this.ids = new Set(list.map(p => p.id));
        } catch { this.ids = new Set(); }
        this.notify();
    },

    has(id) { return this.ids.has(id); },

    /** Giriş yapılmadıysa false döner (çağıran giriş penceresini açar) */
    async toggle(id) {
        if (!Auth.user) return false;
        const wasFav = this.ids.has(id);
        // İyimser güncelleme
        wasFav ? this.ids.delete(id) : this.ids.add(id);
        this.notify();
        try {
            if (wasFav) await api.del(`/favorites/${id}`);
            else await api.post(`/favorites/${id}`);
            toast(wasFav ? 'Favorilerden çıkarıldı' : 'Favorilere eklendi', 'success');
        } catch (e) {
            wasFav ? this.ids.add(id) : this.ids.delete(id);
            this.notify();
            toast(e.message, 'error');
        }
        return true;
    },

    subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    notify() { this.listeners.forEach(fn => fn(this.ids)); }
};
