import { ProductCard } from './ProductCard.js';

export function ProductGrid(items = []) {
  return items.length
    ? `<div class="product-grid">${items.map(ProductCard).join('')}</div>`
    : '<div class="no-results">Aradığınız kriterlere uygun ürün bulunamadı.</div>';
}

export function ProductList(items = [], { title = 'Öne Çıkan <span class="highlight">Ekipmanlar</span>', showAll = true } = {}) {
  return `
    <section class="products-section container">
      <div class="section-header fade-in-up">
        <h2 class="section-title">${title}</h2>
        ${showAll ? '<a href="/urunler" class="view-all">Tümünü Gör →</a>' : ''}
      </div>
      ${ProductGrid(items)}
    </section>`;
}

/** Kartın üzerine gelince video önizleme (yalnızca fareli cihazlarda, video varsa) */
export function setupProductInteractions(root = document) {
  if (!window.matchMedia('(hover: hover)').matches) return;
  root.querySelectorAll('.product-card').forEach(card => {
    const video = card.querySelector('video[data-src]');
    if (!video) return;
    card.addEventListener('mouseenter', () => {
      if (!video.src) video.src = video.dataset.src;
      video.play().catch(() => { });
    });
    card.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0;
    });
  });
}
