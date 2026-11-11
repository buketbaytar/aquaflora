/**
 * Cloudinary görsellerini istenen genişliğe küçültüp WebP/AVIF olarak sunar (otomatik format + kalite).
 * Diğer adresler (ör. Unsplash) olduğu gibi döner.
 *   img('https://res.cloudinary.com/demo/image/upload/v1/a.jpg', 600)
 *   → https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_600/v1/a.jpg
 */
export function img(url, width = 800) {
    if (!url || typeof url !== 'string') return '';
    if (url.includes('res.cloudinary.com') && url.includes('/image/upload/') && !/\/upload\/[^/]*[fqw]_/.test(url)) {
        return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
    }
    return url;
}
