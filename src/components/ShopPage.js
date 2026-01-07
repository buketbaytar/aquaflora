import { products } from '../data/products.js';
import { ProductCard } from './ProductCard.js';

export function ShopPage({ mode = 'grid' } = {}) {
    // mode: 'grid' (All Products - No Filter), 'shop' (With Sidebar), 'featured' (List View)

    let displayedProducts = [...products];
    const brands = [...new Set(products.map(p => p.brand))];
    const categories = [...new Set(products.map(p => p.category))];

    // Title Logic
    let title = "Tüm Ürünler";
    if (mode === 'shop') title = "Mağaza & Koleksiyon";
    if (mode === 'featured') title = "Öne Çıkanlar";

    return `
    <div class="shop-page container fade-in-up">
      <div class="shop-header text-center">
         <h1 class="page-title text-glow">${title}</h1>
         <p class="section-desc">Profesyonel ekipmanlar, premium kalitede.</p>
      </div>

      <div class="shop-layout ${mode === 'shop' ? 'has-sidebar' : 'full-width'}">
        
        <!-- Sidebar (Only for 'shop' mode) -->
        ${mode === 'shop' ? `
          <aside class="shop-sidebar glass-panel">
            <div class="filter-group">
                <h3>Kategoriler</h3>
                ${categories.map(cat => `
                    <label class="filter-option">
                        <input type="checkbox" name="category" value="${cat}">
                        <span>${cat}</span>
                    </label>
                `).join('')}
            </div>
            <div class="filter-group">
                <h3>Markalar</h3>
                ${brands.map(brand => `
                    <label class="filter-option">
                        <input type="checkbox" name="brand" value="${brand}">
                        <span>${brand}</span>
                    </label>
                `).join('')}
            </div>
            <div class="filter-group">
                <h3>Fiyat</h3>
                <input type="range" class="price-range" min="0" max="50000">
            </div>
          </aside>
        ` : ''}

        <!-- Product Grid -->
        <div class="shop-products">
             <div class="product-grid ${mode === 'featured' ? 'list-view' : ''}">
                ${displayedProducts.map(p => ProductCard(p)).join('')}
             </div>
        </div>

      </div>
    </div>
  `;
}
