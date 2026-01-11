import { formatPriceTR } from '../utils/formatPrice.js';

export function ProductCard(product) {
  const isFavorite = window.userFavorites?.includes(product.id) ? 'active' : '';

  return `
    <div class="product-card glass-panel" data-id="${product.id}">
      <button class="fav-btn ${isFavorite}" data-id="${product.id}" title="Favorilere Ekle">
         <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      </button>

      <div class="media-container">
        <img src="${product.image}" alt="${product.name}" class="product-img">
        <video 
          src="${product.video}" 
          class="product-video" 
          muted 
          loop 
          playsinline 
          preload="none">
        </video>
        ${product.isFeatured ? '<div class="badge">Öne Çıkan</div>' : ''}
      </div>
      
      <div class="card-content">
        <div class="category">${product.brand || product.category}</div>
        <h3 class="product-name">${product.name}</h3>
        <div class="price">${formatPriceTR(product.price)}</div>
        
        <button class="add-cart-btn">
          <span>Sepete Ekle</span>
          <span class="icon">+</span>
        </button>
      </div>
    </div>
  `;
}
