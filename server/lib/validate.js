import mongoose from 'mongoose';

/** İstemciye gösterilebilir (güvenli) hata. */
export class HttpError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.expose = true;
        this.details = details;
    }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const notFound = (msg = 'Bulunamadı') => new HttpError(404, msg);
export const unauthorized = (msg = 'Bu işlem için giriş yapmalısınız') => new HttpError(401, msg);
export const forbidden = (msg = 'Bu işlem için yetkiniz yok') => new HttpError(403, msg);
export const conflict = (msg) => new HttpError(409, msg);

/** async route'larda try/catch tekrarını kaldırır (Express 5 zaten promise yakalar; açık olsun diye). */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function email(v) {
    const e = str(v, 254).toLowerCase();
    return EMAIL_RE.test(e) ? e : null;
}

/** TR telefon: 05XXXXXXXXX / +905XXXXXXXXX / 5XXXXXXXXX -> +905XXXXXXXXX */
export function phoneTR(v) {
    let d = str(v, 30).replace(/[^0-9]/g, '');
    if (d.startsWith('90')) d = d.slice(2);
    if (d.startsWith('0')) d = d.slice(1);
    return /^5\d{9}$/.test(d) ? `+90${d}` : null;
}

/** T.C. kimlik no algoritma kontrolü */
export function tckn(v) {
    const s = str(v, 11);
    if (!/^[1-9]\d{10}$/.test(s)) return null;
    const d = s.split('').map(Number);
    const odd = d[0] + d[2] + d[4] + d[6] + d[8];
    const even = d[1] + d[3] + d[5] + d[7];
    if (((odd * 7 - even) % 10 + 10) % 10 !== d[9]) return null;
    if (d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 !== d[10]) return null;
    return s;
}

export const isObjectId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) && mongoose.isValidObjectId(v);

export function int(v, { min = 1, max = 99, def = 1 } = {}) {
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return def;
    return Math.min(max, Math.max(min, n));
}

export function password(v) {
    return typeof v === 'string' && v.length >= 8 && v.length <= 128 ? v : null;
}

/** Türkçe karakterleri sadeleştirip slug üretir */
export function slugify(s) {
    return String(s || '')
        .toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/&/g, '-and-')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Regex araması için kullanıcı girdisini kaçışlar (ReDoS/enjeksiyon önlemi) */
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** E-posta gibi kişisel veriyi loglarken maskele */
export const maskEmail = (e) => (e ? String(e).replace(/^(.{2}).*(@.*)$/, '$1***$2') : '');
