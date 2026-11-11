/** Katalog CSV yardımcıları (Excel uyumlu: noktalı virgül ayraç, UTF-8 BOM) */
export const COLUMNS = ['sku', 'kategori', 'alt_kategori', 'urun_adi', 'marka', 'fiyat', 'stok', 'bedenler', 'gorseller', 'video', 'aciklama', 'ozellikler', 'one_cikan', 'aktif'];

export function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    const delim = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') q = false;
            else cell += c;
        } else if (c === '"') q = true;
        else if (c === delim) { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.some(v => v.trim() !== '')) rows.push(row);
            row = [];
        } else cell += c;
    }
    row.push(cell);
    if (row.some(v => v.trim() !== '')) rows.push(row);

    const header = rows.shift().map(h => h.trim().toLowerCase());
    return rows.map((r, idx) => {
        const o = { _line: idx + 2 };
        header.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
        return o;
    });
}

export function toCsv(objects) {
    const esc = (v) => {
        const s = v === undefined || v === null ? '' : String(v);
        return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return '﻿' + [COLUMNS.join(';'), ...objects.map(o => COLUMNS.map(c => esc(o[c])).join(';'))].join('\r\n') + '\r\n';
}

/** "1.299,90" / "1299.90" / "1299" → 1299.9 */
export function parsePrice(v) {
    if (!v) return null;
    let s = String(v).replace(/[^\d.,]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** "S:5|M:3|L" → [{size:'S',stock:5},{size:'M',stock:3},{size:'L',stock:0}] */
export function parseVariants(v) {
    if (!v) return null;
    return v.split('|').map(x => x.trim()).filter(Boolean).map(x => {
        const [size, stock] = x.split(':');
        return { size: size.trim(), stock: Math.max(0, parseInt(stock, 10) || 0) };
    });
}
export const formatVariants = (vs = []) => vs.map(v => `${v.size}:${v.stock}`).join('|');

/** "Kalınlık=5mm|Cinsiyet=Erkek" → { Kalınlık: '5mm', Cinsiyet: 'Erkek' } */
export function parseSpecs(v) {
    if (!v) return null;
    const o = {};
    v.split('|').forEach(p => {
        const i = p.indexOf('=');
        if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim();
    });
    return Object.keys(o).length ? o : null;
}
export const formatSpecs = (o) => (o && typeof o === 'object' ? Object.entries(o).map(([k, v]) => `${k}=${v}`).join('|') : '');

export const parseImages = (v) => (v ? v.split(/[|\s]+/).map(s => s.trim()).filter(s => /^https:\/\//.test(s)) : null);
export const yes = (v) => /^(evet|e|yes|true|1|x)$/i.test(String(v || '').trim());
