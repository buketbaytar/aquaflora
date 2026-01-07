import { products } from '../data/products.js';
import { ProductCard } from './ProductCard.js';

export function CategoryPage(categoryId, title) {
    // Filter products by category (simple matching for now)
    // Map categoryId (slug) to the real category string in data
    const categoryMap = {
        'scuba': 'Tüplü Dalış',
        'freedive': 'Serbest Dalış & Zıpkın',
        'swim': 'Yüzme',
        'outdoor': 'Kamp & Outdoor'
    };

    const dbCategory = categoryMap[categoryId] || '';
    const categoryProducts = products.filter(p => p.category === dbCategory);

    // Extract unique brands for filter
    const brands = [...new Set(categoryProducts.map(p => p.brand))];

    return `
    <div class="category-page container fade-in-up">
      <div class="category-header">
         <h1 class="page-title text-glow">${title}</h1>
         <div class="breadcrumbs">Anasayfa / ${title}</div>
      </div>

      <div class="category-layout">
        <!-- Sidebar Filters -->
        <aside class="filters glass-panel">
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
             <h3>Fiyat Aralığı</h3>
             <input type="range" min="0" max="50000" class="price-range">
          </div>
        </aside>

        <!-- Product Grid -->
        <div class="category-products">
           ${categoryProducts.length > 0
            ? `<div class="product-grid">${categoryProducts.map(p => ProductCard(p)).join('')}</div>`
            : `<p class="no-products">Bu kategoride henüz ürün bulunmuyor.</p>`
        }
        </div>
      </div>
    </div>
  `;
}
