import { escapeHTML as e } from '../utils/sanitize.js';

/** Ürün listesi filtreleri. Durum URL'de tutulur → paylaşılabilir/geri tuşu uyumlu. */
export function FilterSidebar(categories, products, f) {
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const maxPrice = Math.max(1000, Math.ceil(Math.max(0, ...products.map(p => p.price)) / 500) * 500);
  const current = f.maxPrice ? Math.min(f.maxPrice, maxPrice) : maxPrice;
  const cat = categories.find(c => c.id === f.category);

  return `
    <aside class="filter-sidebar glass-panel" aria-label="Filtreler">
      <div class="filter-group">
        <h3>Kategori</h3>
        <div class="filter-options">
          <label class="filter-label"><input type="radio" name="category" value="" ${!f.category ? 'checked' : ''}><span>Tümü</span></label>
          ${categories.map(c => `<label class="filter-label"><input type="radio" name="category" value="${e(c.id)}" ${f.category === c.id ? 'checked' : ''}><span>${e(c.title)}</span></label>`).join('')}
        </div>
      </div>

      ${cat?.sub?.length ? `
      <div class="filter-group">
        <h3>Alt Kategori</h3>
        <div class="filter-options">
          <label class="filter-label"><input type="radio" name="subCategory" value="" ${!f.subCategory ? 'checked' : ''}><span>Tümü</span></label>
          ${cat.sub.map(s => `<label class="filter-label"><input type="radio" name="subCategory" value="${e(s.slug)}" ${f.subCategory === s.slug ? 'checked' : ''}><span>${e(s.name)}</span></label>`).join('')}
        </div>
      </div>` : ''}

      ${brands.length ? `
      <div class="filter-group">
        <h3>Marka</h3>
        <div class="filter-options">
          ${brands.map(b => `<label class="filter-label"><input type="checkbox" name="brand" value="${e(b)}" ${f.brands.includes(b) ? 'checked' : ''}><span>${e(b)}</span></label>`).join('')}
        </div>
      </div>` : ''}

      <div class="filter-group">
        <h3>Fiyat</h3>
        <div class="price-slider-container">
          <input type="range" name="maxPrice" id="price-range" min="0" max="${maxPrice}" step="250" value="${current}" aria-label="En yüksek fiyat">
          <div class="price-values"><span>0 ₺</span><output id="price-value">${current.toLocaleString('tr-TR')} ₺</output></div>
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-label"><input type="checkbox" name="inStock" ${f.inStock ? 'checked' : ''}><span>Sadece stoktakiler</span></label>
      </div>

      <button type="button" id="clear-filters" class="btn secondary-btn small">Filtreleri Temizle</button>
    </aside>`;
}

export function SortBar(count, f) {
  const opt = (v, l) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`;
  return `
    <div class="sort-bar">
      <span>${f.q ? `"${e(f.q)}" için ` : ''}${count} ürün</span>
      <button type="button" class="btn secondary-btn small filter-toggle" aria-controls="filters">Filtrele</button>
      <label>Sırala:
        <select name="sort" id="sort-select">
          ${opt('', 'Önerilen')}${opt('price_asc', 'Fiyat (artan)')}${opt('price_desc', 'Fiyat (azalan)')}${opt('newest', 'En yeniler')}${opt('popular', 'En popüler')}
        </select>
      </label>
    </div>`;
}
