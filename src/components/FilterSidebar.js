export function FilterSidebar(categories = [], products = []) {
    // Extract unique brands
    const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];

    return `
    <aside class="filter-sidebar glass-panel">
        <div class="filter-group">
            <h3>Kategoriler</h3>
            <div class="filter-options">
                ${categories.map(cat => `
                    <label class="filter-label">
                        <input type="checkbox" class="category-filter" value="${cat.title}">
                        <span>${cat.title}</span>
                    </label>
                `).join('')}
            </div>
        </div>

        <div class="filter-group">
            <h3>Markalar</h3>
            <div class="filter-options">
                ${brands.map(brand => `
                    <label class="filter-label">
                        <input type="checkbox" class="brand-filter" value="${brand}">
                        <span>${brand}</span>
                    </label>
                `).join('')}
            </div>
        </div>

        <div class="filter-group">
            <h3>Fiyat Aralığı</h3>
            <div class="price-slider-container">
                <input type="range" id="price-range" min="0" max="30000" step="500" value="30000">
                <div class="price-values">
                    <span>0 ₺</span>
                    <span id="price-value">30.000 ₺</span>
                </div>
            </div>
        </div>
        
        <button id="clear-filters" class="btn secondary-btn small">Filtreleri Temizle</button>
    </aside>
    `;
}

export function setupFilterInteractions(onFilterChange) {
    const sidebar = document.querySelector('.filter-sidebar');
    if (!sidebar) return;

    const priceSlider = sidebar.querySelector('#price-range');
    const priceDisplay = sidebar.querySelector('#price-value');
    const clearBtn = sidebar.querySelector('#clear-filters');

    if (!priceSlider || !priceDisplay || !clearBtn) {
        console.warn('FilterSidebar elements missing');
        return;
    }

    const updateFilters = () => {
        const selectedCategories = Array.from(sidebar.querySelectorAll('.category-filter:checked')).map(cb => cb.value);
        const selectedBrands = Array.from(sidebar.querySelectorAll('.brand-filter:checked')).map(cb => cb.value);
        const maxPrice = parseInt(priceSlider.value);

        priceDisplay.textContent = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(maxPrice);

        onFilterChange({
            categories: selectedCategories,
            brands: selectedBrands,
            maxPrice: maxPrice
        });
    };

    sidebar.addEventListener('change', (e) => {
        if (e.target.matches('input')) {
            updateFilters();
        }
    });

    priceSlider.addEventListener('input', () => {
        priceDisplay.textContent = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(priceSlider.value);
    });

    clearBtn.addEventListener('click', () => {
        sidebar.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        priceSlider.value = 30000;
        priceDisplay.textContent = '30.000 ₺';
        updateFilters();
    });
}
