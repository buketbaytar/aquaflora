const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''; // Use proxy
console.log('🔗 API Base URL:', API_BASE_URL || 'Relative path via Proxy');

export const Auth = {
    user: null,
    listeners: [],
    csrfToken: null,

    async fetchCsrfToken() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/csrf-token`);
            if (res.ok) {
                const data = await res.json();
                this.csrfToken = data.csrfToken;
                console.log('🔒 CSRF Token fetched');
            }
        } catch (e) {
            console.warn('Failed to fetch CSRF token', e);
        }
    },

    async checkSession() {
        if (!this.csrfToken) await this.fetchCsrfToken();
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' }).catch(() => ({ ok: false }));
            if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
                this.user = await res.json();
                this.notify();
                return this.user;
            } else {
                this.user = null;
                this.notify();
                return null;
            }
        } catch (e) {
            console.warn('Backend connection unavailable (checkSession)');
            this.user = null;
            this.notify();
            return null;
        }
    },

    async login(email, password) {
        if (!this.csrfToken) await this.fetchCsrfToken();
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });
            if (res.ok) {
                this.user = await res.json();
                this.notify();
                return { success: true };
            } else {
                const err = await res.json();
                return { success: false, error: err.error };
            }
        } catch (e) {
            return { success: false, error: 'Network error' };
        }
    },

    async register(email, password, name) {
        if (!this.csrfToken) await this.fetchCsrfToken();
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({ email, password, name })
            });
            if (res.ok) {
                this.user = await res.json();
                this.notify();
                return { success: true };
            } else {
                const err = await res.json();
                return { success: false, error: err.error };
            }
        } catch (e) {
            return { success: false, error: 'Network error' };
        }
    },

    async logout() {
        if (!this.csrfToken) await this.fetchCsrfToken();
        try {
            await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'X-CSRF-Token': this.csrfToken }
            }).catch(() => { });
        } catch (e) {
            console.warn('Logout failed (backend offline)');
        }
        this.user = null;
        this.notify();
    },

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.user);
    },

    notify() {
        this.listeners.forEach(fn => fn(this.user));
    }
};

