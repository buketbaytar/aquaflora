const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:10000';
console.log('🔗 API Base URL:', API_BASE_URL); // Debug için

export const Auth = {
    user: null, // Current user state
    listeners: [],

    async checkSession() {
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
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        try {
            await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => { });
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

