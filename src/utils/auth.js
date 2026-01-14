// Eğer .env dosyasında bir URL varsa onu kullan, yoksa direkt canlı domaini kullan
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://aqualora.shop';

console.log('🔗 API Base URL:', API_BASE_URL);

export const Auth = {
    user: null,
    listeners: [],
    csrfToken: null,

    // 1. ADIM: CSRF TOKEN ALMA
    async fetchCsrfToken() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/csrf-token`, {
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                this.csrfToken = data.csrfToken;
            }
        } catch (e) {
            console.warn('⚠️ Failed to fetch CSRF token:', e);
        }
    },

    // 2. ADIM: OTURUM KONTROLÜ (HATA BURADAYDI - DÜZELTİLDİ)
    async checkSession() {
        if (!this.csrfToken) await this.fetchCsrfToken();

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            }).catch(() => ({ ok: false }));

            if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
                const data = await res.json();

                // KRİTİK DÜZELTME:
                // Backend bazen { "user": null } dönüyor.
                // Eski kod bunu "dolu obje" sanıyordu. Bunu kontrol ediyoruz:
                if (data && data.user === null) {
                    this.user = null; // Gerçekten çıkış yapılmış
                } else {
                    this.user = data; // Kullanıcı verisi dolu
                }

                this.notify();
                return this.user;
            } else {
                this.user = null;
                this.notify();
                return null;
            }
        } catch (e) {
            console.warn('❌ Backend connection unavailable (checkSession)');
            this.user = null;
            this.notify();
            return null;
        }
    },

    // 3. ADIM: GİRİŞ YAPMA
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
                let errorMsg = 'Giriş başarısız';
                try {
                    const err = await res.json();
                    errorMsg = err.error || err.message;
                } catch (jsonErr) { }
                return { success: false, error: errorMsg };
            }
        } catch (e) {
            console.error('Login Network Error:', e);
            return { success: false, error: 'Sunucuya ulaşılamadı (Network Error)' };
        }
    },

    // 4. ADIM: KAYIT OLMA
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
                let errorMsg = 'Kayıt başarısız';
                try {
                    const err = await res.json();
                    errorMsg = err.error || err.message;
                } catch (e) { }
                return { success: false, error: errorMsg };
            }
        } catch (e) {
            return { success: false, error: 'Sunucuya ulaşılamadı' };
        }
    },

    // 5. ADIM: ÇIKIŞ YAPMA
    async logout() {
        if (!this.csrfToken) await this.fetchCsrfToken();

        try {
            await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                }
            });
        } catch (e) {
            console.warn('Logout fetch failed');
        }

        this.user = null;
        this.notify();
        window.location.href = '/';
    },

    subscribe(listener) {
        this.listeners.push(listener);
        if (this.user) listener(this.user);
    },

    notify() {
        this.listeners.forEach(fn => fn(this.user));
    }
};