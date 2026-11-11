import { formatPriceTR } from '../utils/formatPrice.js';
import { escapeHTML as e } from '../utils/sanitize.js';
import { Favorites } from '../utils/favorites.js';
import { img } from '../utils/img.js';

export const productUrl = (p) => `/urun/${encodeURIComponent(p.slug || 'urun')}-${p.id}`;

export function ProductCard(product) {
  const fav = Favorites.has(product.id);
  const lowStock = product.inStock && product.stock <= 3;
  return `
    <article class="product-card glass-panel" data-id="${e(product.id)}">
      <button class="fav-btn ${fav ? 'active' : ''}" data-fav="${e(product.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      </button>

      <a href="${productUrl(product)}" class="media-container" aria-label="${e(product.name)}">
        ${product.image ? `<img src="${e(img(product.image, 600))}" loading="lazy" decoding="async" width="400" height="300" alt="${e(product.name)}" class="product-img">` : '<div class="product-img placeholder"></div>'}
        ${product.video ? `<video data-src="${e(product.video)}" class="product-video" muted loop playsinline preload="none"></video>` : ''}
        ${product.isFeatured ? '<span class="badge">Öne Çıkan</span>' : ''}
        ${!product.inStock ? '<span class="badge badge-out">Tükendi</span>' : (lowStock ? `<span class="badge badge-low">Son ${product.stock} ürün</span>` : '')}
      </a>

      <div class="card-content">
        <div class="category">${e(product.brand || product.category)}</div>
        <h3 class="product-name"><a href="${productUrl(product)}">${e(product.name)}</a></h3>
        <div class="price">${formatPriceTR(product.price)}</div>
        <button class="add-cart-btn" data-add="${e(product.id)}" ${product.inStock ? '' : 'disabled'}>
          <span>${!product.inStock ? 'Tükendi' : (product.variants?.length ? 'Beden Seç' : 'Sepete Ekle')}</span>
          <span class="icon" aria-hidden="true">${product.variants?.length ? '›' : '+'}</span>
        </button>
      </div>
    </article>`;
}
