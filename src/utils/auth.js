import { api } from './api.js';

/** Oturum durumu (tek kaynak). Değişiklikler subscribe ile dinlenir. */
export const Auth = {
    user: null,
    ready: null,
    listeners: new Set(),

    init() {
        this.ready = api.get('/auth/me')
            .then(d => { this.user = d?.user || null; })
            .catch(() => { this.user = null; })
            .finally(() => this.notify());
        return this.ready;
    },

    async login(email, password) {
        const d = await api.post('/auth/login', { email, password });
        this.user = d.user;
        this.notify('login');
        return d.user;
    },

    async register({ name, email, password, kvkk, marketing }) {
        const d = await api.post('/auth/register', { name, email, password, kvkk, marketing });
        this.user = d.user;
        this.notify('login');
        return d.user;
    },

    async logout() {
        try { await api.post('/auth/logout'); } catch { /* yine de çıkış yap */ }
        this.user = null;
        this.notify('logout');
    },

    forgotPassword(email) {
        return api.post('/auth/forgot-password', { email });
    },

    async resetPassword(token, password) {
        const d = await api.post('/auth/reset-password', { token, password });
        this.user = d.user;
        this.notify('login');
        return d.user;
    },

    async updateAccount(data) {
        const d = await api.put('/account', data);
        this.user = d.user;
        this.notify();
        return d.user;
    },

    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    },

    notify(event) {
        this.listeners.forEach(fn => fn(this.user, event));
    }
};
