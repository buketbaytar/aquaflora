export function CategoryPage(categoryId, title, products = []) {
  // Filter products by category
  // Robust matching: Match by Category Name (title) OR by categoryId
  const categoryProducts = products.filter(p => {
    // Match string name
    if (p.category === title) return true;

    // Match ObjectId (if populated or direct)
    const pCatId = p.categoryId?._id || p.categoryId;
    return pCatId === categoryId;
  });

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
