export function formatPriceTR(value) {
    if (value === undefined || value === null) return '';

    // Normalize string/number
    let number = 0;
    if (typeof value === 'number') number = value;
    else if (typeof value === 'string') {
        // Try to parse existing format if it has TL etc. 
        // Or assume it's a raw number string.
        // If it's "25000", parseFloat works.
        // If it's "25.000 TL", we might want to return it as is or re-parse?
        // User said: From 25000 To 24.000 TL.
        // Safest: parse to float then format.
        number = parseFloat(value.toString().replace(/[^0-9.]/g, ''));
    }

    if (isNaN(number)) return value; // Fallback

    // Turkish locale format:
    // 1000 -> 1.000
    // 1000.50 -> 1.000,5
    // But requirement says "Thousands separator ." and Append " TL".

    // built-in toLocaleString('tr-TR') does exactly this for number formatting (dots for thousands, comma for decimals)
    const formatted = number.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    return `${formatted} TL`;
}
