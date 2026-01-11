export function ProductDetail(product) {
  return `
    <div class="product-detail-page fade-in-up">
      <div class="container pdp-grid">
        <!-- Visuals -->
        <div class="pdp-visuals">
           <div class="main-visual glass-panel">
              <video src="${product.video}" autoplay muted loop class="pdp-video"></video>
           </div>
           <div class="thumbnails">
             <img src="${product.image}" class="thumb active glass-panel">
             <!-- Placeholders -->
             <div class="thumb glass-panel"></div> 
             <div class="thumb glass-panel"></div>
           </div>
        </div>

        <!-- Info -->
        <div class="pdp-info">
          <button class="back-btn">← Geri Dön</button>
          
          <div class="pdp-header">
            <span class="pdp-category">${product.brand || product.category}</span>
            <h1 class="pdp-title">${product.name}</h1>
            <div class="pdp-price text-glow">${typeof product.price === 'number' ? product.price.toLocaleString('tr-TR') + ' ₺' : product.price}</div>
          </div>

          <div class="pdp-description">
             <p>${product.description || 'Profesyonel su altı deneyimi için tasarlandı. Son teknoloji malzemeler ve üstün ergonomi ile performansınızı zirveye taşıyın.'}</p>
          </div>

          ${product.specs ? `
          <div class="pdp-specs glass-panel">
            <h3>Teknik Özellikler</h3>
            <ul>
              ${Object.entries(product.specs).map(([key, val]) => `<li><strong>${key}:</strong> ${val}</li>`).join('')}
            </ul>
          </div>` : ''}

          <div class="pdp-actions">
            <button class="add-cart-btn large pulse-glow">
              SEPETE EKLE
            </button>
            <button class="favorite-btn icon-btn">♥</button>
          </div>

        </div>
      </div>
    </div>
  `;
}
