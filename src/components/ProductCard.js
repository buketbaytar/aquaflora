export function ProductCard(product) {
    return `
    <div class="product-card glass-panel" data-id="${product.id}">
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
        <div class="badge">Yeni</div>
      </div>
      
      <div class="card-content">
        <div class="category">${product.category}</div>
        <h3 class="product-name">${product.name}</h3>
        <div class="price">${product.price}</div>
        
        <button class="add-cart-btn">
          <span>Sepete Ekle</span>
          <span class="icon">+</span>
        </button>
      </div>
    </div>
  `;
}
