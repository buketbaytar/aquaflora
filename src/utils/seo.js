import { SITE } from '../config.js';

/** İstemci tarafı gezinmede başlık/açıklama/canonical güncellemesi (ilk yükleme sunucuda yapılır) */
export const seo = {
    set({ title, description, image, noindex = false, jsonLd = null } = {}) {
        document.title = title ? `${title} | ${SITE.name}` : `${SITE.name} | ${SITE.tagline}`;
        if (description) meta('name', 'description', description);
        meta('property', 'og:title', document.title);
        if (description) meta('property', 'og:description', description);
        if (image) meta('property', 'og:image', image);
        meta('property', 'og:url', location.href);
        meta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.rel = 'canonical';
            document.head.appendChild(canonical);
        }
        canonical.href = location.origin + location.pathname + (location.pathname === '/urunler' ? location.search : '');

        let ld = document.getElementById('json-ld');
        if (jsonLd) {
            if (!ld) {
                ld = document.createElement('script');
                ld.id = 'json-ld';
                ld.type = 'application/ld+json';
                document.head.appendChild(ld);
            }
            ld.textContent = JSON.stringify(jsonLd);
        } else if (ld) ld.remove();
    }
};

function meta(attr, key, content) {
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}
