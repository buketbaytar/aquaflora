import { escapeHTML as e } from '../utils/sanitize.js';
import { formatPriceTR } from '../utils/formatPrice.js';
import { Favorites } from '../utils/favorites.js';
import { runtime } from '../config.js';
import { img } from '../utils/img.js';

export function ProductDetail(product) {
  const hasVariants = product.variants?.length > 0;
  const fav = Favorites.has(product.id);
  const s = runtime.shipping;
  const shippingNote = !s.flatFee ? 'Ücretsiz kargo' : (s.freeThreshold ? `${formatPriceTR(s.freeThreshold)} üzeri ücretsiz kargo` : `Kargo ${formatPriceTR(s.flatFee)}`);

  return `
    <div class="product-detail-page fade-in-up">
      <nav class="container breadcrumbs" aria-label="Sayfa yolu">
        <a href="/">Anasayfa</a> / <a href="/urunler${product.categoryId ? `?category=${e(product.categoryId)}` : ''}">${e(product.category || 'Ürünler')}</a> / <span>${e(product.name)}</span>
      </nav>
      <div class="container pdp-grid">
        <div class="pdp-visuals">
          <div class="main-visual glass-panel">
            ${product.image ? `<img src="${e(img(product.image, 1200))}" alt="${e(product.name)}" class="pdp-image" id="pdp-main-image" decoding="async">` : '<div class="pdp-image placeholder"></div>'}
          </div>
          ${(product.images || []).length > 1 ? `
          <div class="pdp-thumbs" role="list" aria-label="Ürün görselleri">
            ${product.images.map((u, i) => `<button type="button" class="pdp-thumb ${i === 0 ? 'active' : ''}" data-gallery="${e(img(u, 1200))}" aria-label="Görsel ${i + 1}">
              <img src="${e(img(u, 160))}" alt="" loading="lazy" width="72" height="72"></button>`).join('')}
          </div>` : ''}
          ${product.video ? `<video src="${e(product.video)}" muted loop playsinline controls preload="none" class="pdp-video" poster="${e(img(product.image, 1200))}"></video>` : ''}
        </div>

        <div class="pdp-info">
          <div class="pdp-header">
            <span class="pdp-category">${e(product.brand || product.category)}</span>
            <h1 class="pdp-title">${e(product.name)}</h1>
            <div class="pdp-price text-glow">${formatPriceTR(product.price)}</div>
            <p class="pdp-stock ${product.inStock ? 'in' : 'out'}">${product.inStock ? (product.stock <= 3 ? `⚡ Son ${product.stock} ürün` : '✓ Stokta') : '✕ Tükendi'}</p>
          </div>

          ${product.description ? `<div class="pdp-description"><p>${e(product.description)}</p></div>` : ''}

          ${hasVariants ? `
          <fieldset class="variant-selector">
            <legend>Beden seçin:</legend>
            <div class="size-buttons">
              ${product.variants.map(v => `
                <button type="button" class="size-btn" data-size="${e(v.size)}" data-stock="${v.stock}" ${v.stock === 0 ? 'disabled aria-disabled="true"' : ''}>
                  ${e(v.size)}${v.stock === 0 ? ' (Tükendi)' : (v.stock <= 3 ? ` (son ${v.stock})` : '')}
                </button>`).join('')}
            </div>
          </fieldset>` : ''}

          <div class="pdp-actions">
            <div class="qty-control" aria-label="Adet">
              <button type="button" data-qty="-1" aria-label="Azalt">−</button>
              <input type="number" class="qty-input" value="1" min="1" max="${Math.max(1, Math.min(99, product.stock))}" aria-label="Adet">
              <button type="button" data-qty="1" aria-label="Arttır">+</button>
            </div>
            <button class="add-cart-btn large" data-add-detail="${e(product.id)}" ${!product.inStock || hasVariants ? 'disabled' : ''}>
              ${!product.inStock ? 'TÜKENDİ' : (hasVariants ? 'ÖNCE BEDEN SEÇİN' : 'SEPETE EKLE')}
            </button>
            <button class="favorite-btn icon-btn ${fav ? 'active' : ''}" data-fav="${e(product.id)}" aria-pressed="${fav}" aria-label="Favorilere ekle">♥</button>
          </div>
          ${!product.inStock ? `<button class="btn secondary-btn small" data-open-chat data-chat-action="live_support">Stoğa girince haber ver</button>` : ''}

          <ul class="pdp-trust">
            <li>🚚 ${e(shippingNote)}${s.estimatedDays ? ` · ${e(s.estimatedDays)} içinde kargoda` : ''}</li>
            <li>↩️ 14 gün içinde kolay iade</li>
            <li>🔒 256-bit SSL ve 3D Secure ile güvenli ödeme</li>
          </ul>

          ${product.specs && Object.keys(product.specs).length ? `
          <div class="pdp-specs glass-panel">
            <h2>Teknik Özellikler</h2>
            <ul>${Object.entries(product.specs).map(([k, v]) => `<li><strong>${e(k)}:</strong> ${e(v)}</li>`).join('')}</ul>
          </div>` : ''}
        </div>
      </div>
    </div>`;
}
