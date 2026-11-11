const fmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 18500 → "₺18.500", 1299.9 → "₺1.299,9" */
export function formatPriceTR(value) {
    if (value === undefined || value === null || value === '') return '';
    let n = value;
    if (typeof value === 'string') n = parseFloat(value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
    if (Number.isNaN(n)) return String(value);
    return fmt.format(n);
}
