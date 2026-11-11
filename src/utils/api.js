import { API_BASE } from '../config.js';

/**
 * Merkezi API istemcisi:
 *  - Çerez gönderimi (credentials)
 *  - Yazma isteklerine otomatik CSRF token
 *  - CSRF hatasında token yenileyip bir kez tekrar dener
 *  - Anlamlı Türkçe hata mesajı (ApiError)
 */
export class ApiError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

let csrfToken = null;
let csrfPromise = null;

export function setCsrfToken(t) { if (t) csrfToken = t; }

async function fetchCsrf() {
    if (!csrfPromise) {
        csrfPromise = fetch(`${API_BASE}/api/csrf-token`, { credentials: 'include' })
            .then(r => (r.ok ? r.json() : {}))
            .then(d => { csrfToken = d.csrfToken || null; return csrfToken; })
            .catch(() => null)
            .finally(() => { csrfPromise = null; });
    }
    return csrfPromise;
}

export async function api(path, { method = 'GET', body, retry = true, signal } = {}) {
    const headers = {};
    const write = method !== 'GET' && method !== 'HEAD';
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (write) {
        if (!csrfToken) await fetchCsrf();
        if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    }

    let res;
    try {
        res = await fetch(`${API_BASE}/api${path}`, {
            method,
            headers,
            credentials: 'include',
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal
        });
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        throw new ApiError(0, 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
    }

    let data = null;
    const isJson = res.headers.get('content-type')?.includes('application/json');
    if (isJson) data = await res.json().catch(() => null);

    if (!res.ok) {
        if (res.status === 403 && data?.code === 'EBADCSRFTOKEN' && retry) {
            csrfToken = null;
            await fetchCsrf();
            return api(path, { method, body, retry: false, signal });
        }
        throw new ApiError(res.status, data?.error || `İstek başarısız (${res.status})`, data?.details);
    }
    if (data?.csrfToken) setCsrfToken(data.csrfToken);
    return data;
}

api.get = (p, o) => api(p, { ...o, method: 'GET' });
api.post = (p, body, o) => api(p, { ...o, method: 'POST', body: body ?? {} });
api.put = (p, body, o) => api(p, { ...o, method: 'PUT', body: body ?? {} });
api.del = (p, o) => api(p, { ...o, method: 'DELETE' });
