import { ProductCard } from './ProductCard.js';
import { products } from '../data/products.js';

export function ProductList(items = products) {
  const content = items.length > 0
    ? items.map(product => ProductCard(product)).join('')
    : '<div class="no-results">Aradığınız kriterlere uygun ürün bulunamadı.</div>';

  return `
    <section class="products-section container">
      <div class="section-header fade-in-up">
        <h2 class="section-title">Öne Çıkan <span class="highlight">Ekipmanlar</span></h2>
        <a href="#" class="view-all" id="view-all-products">Tümünü Gör →</a>
      </div>
      
      <div class="product-grid">
        ${content}
      </div>
    </section>
  `;
}

export function setupProductInteractions() {
  const cards = document.querySelectorAll('.product-card');

  cards.forEach(card => {
    const video = card.querySelector('video');
    const image = card.querySelector('img');

    card.addEventListener('mouseenter', () => {
      image.style.opacity = '0';
      video.play().catch(e => console.log('Video play error:', e));
    });

    card.addEventListener('mouseleave', () => {
      image.style.opacity = '1';
      video.pause();
      video.currentTime = 0;
    });
  });
}
