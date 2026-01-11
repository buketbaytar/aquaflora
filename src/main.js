const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '' : 'https://aquaflora-backend.onrender.com';

async function fetchProductsFromAPI() {
  const res = await fetch(`${API_BASE}/api/products`, { cache: 'no-store' });
  return await res.json();
}



import './style.css'
import './products-page.css'
import { Auth } from './utils/auth.js'
import { Header, setupHeader } from './components/Header.js'
import { Footer } from './components/Footer.js'
import { Hero } from './components/Hero.js'
import { ProductList, setupProductInteractions } from './components/ProductList.js'
import { ProductDetail } from './components/ProductDetail.js'
import { AIAssistant, setupAIAssistant } from './components/AIAssistant.js'
import { CategoryPage } from './components/CategoryPage.js'
import { DivingMap, setupMapInteractions } from './components/DivingMap.js'


let products = [];
let categories = [];
// import { categories } from './data/products.js'; // REMOVED STATIC IMPORT


import { seo } from './utils/seo.js'
import { Cart } from './utils/cart.js'
import { CartPage, setupCartInteractions } from './components/CartPage.js'
import { PaymentResult } from './components/PaymentResult.js'
import { FilterSidebar, setupFilterInteractions } from './components/FilterSidebar.js'

const app = document.querySelector('#app');

// Internal router state
let currentRoute = { page: 'home', params: {} };

function navigate(page, params = {}) {
  currentRoute = { page, params };
  render();
  window.scrollTo(0, 0);
}

// Global click handler for links
document.addEventListener('click', (e) => {
  // Handle 'Ürünleri Gör' Navigation
  if (e.target.closest('#view-all-products') || e.target.id === 'view-all-products') {
    e.preventDefault();
    window.location.href = '/urunler.html';
    return;
  }

  const link = e.target.closest('a');
  const href = link?.getAttribute('href');
  if (link && href && href.startsWith('#')) {
    e.preventDefault();

    if (href === '#') return; // Ignore empty links
    if (href === '/' || href === '#home') {
      // If we are on urunler.html, we might want to go back to root index.html
      if (window.location.pathname.includes('urunler.html')) {
        window.location.href = '/';
        return;
      }
      navigate('home');
      return;
    }

    // ... existing logic ...

    if (href.startsWith('#category-')) {
      const catId = href.replace('#category-', '');
      navigate('category', { id: catId });
    }
  } else if (link && link.classList.contains('logo')) {
    e.preventDefault();
    if (window.location.pathname.includes('urunler.html')) {
      window.location.href = '/';
      return;
    }
    navigate('home');
  }

  // Cart Button Click
  if (e.target.closest('.cart-btn')) {
    navigate('cart');
  }

  // Add to Cart Button Click
  // Check if it is a button with class add-cart-btn
  if (e.target.closest('.add-cart-btn')) {
    const btn = e.target.closest('.add-cart-btn');

    let productToAdd = null;
    if (currentRoute.page === 'product') {
      productToAdd = products.find(p => p.id === parseInt(currentRoute.params.id));
    } else if (e.target.closest('.product-card')) {
      const id = parseInt(e.target.closest('.product-card').dataset.id);
      productToAdd = products.find(p => p.id === id);
      e.stopPropagation(); // prevent navigation
    }

    if (productToAdd) Cart.add(productToAdd);
  }
});

// Update Cart Count
Cart.subscribe((items) => {
  const counters = document.querySelectorAll('.cart-count');
  counters.forEach(c => c.textContent = items.length);
});

function render() {
  const commonUI = Header(Auth.user, categories) + AIAssistant();
  const footerUI = Footer();

  if (window.location.pathname.includes('urunler.html')) {
    // Products Page Logic with Filtering
    const renderProductsPage = (filtered = products) => {
      app.innerHTML = `
        ${commonUI}
        <div id="main-content" class="container" style="margin-top: 120px;">
          <div class="products-page-layout">
            ${FilterSidebar(categories, products)}
            <div class="products-container">
              ${ProductList(filtered)}
            </div>
          </div>
        </div>
        ${footerUI}
      `;
      setupCommonInteractions();

      // Pass handlers with closure to use latest 'products'
      setupFilterInteractions((filterData) => {
        const newFiltered = products.filter(p => {
          // Compatibility: p.category is always present (string) even if originating from DB relations due to server transform
          const matchesCategory = filterData.categories.length === 0 || filterData.categories.includes(p.category);
          const matchesBrand = filterData.brands.length === 0 || filterData.brands.includes(p.brand);

          let price = 0;
          if (typeof p.price === 'number') price = p.price;
          else if (typeof p.price === 'string') price = parseFloat(p.price.replace(' ₺', '').replace(/\./g, '').replace(',', '.'));

          const matchesPrice = price <= filterData.maxPrice;

          return matchesCategory && matchesBrand && matchesPrice;
        });

        const container = document.querySelector('.products-container');
        if (container) {
          container.innerHTML = ProductList(newFiltered);
          setupProductInteractions();
        }
      });
    };

    renderProductsPage();
  }
  else if (currentRoute.page === 'home') {
    seo.setDefaults();

    // Featured Products Logic
    const featuredProducts = products.filter(p => p.isFeatured === true);
    // If no featured products, maybe show 4 random ones or just none. Requirement says: "Featured products appear on homepage"
    // Let's fallback to first 4 if none marked, or just show them.
    const displayProducts = featuredProducts.length > 0 ? featuredProducts : products.slice(0, 4);

    // Modify ProductList to change title if needed or wrap it
    // ProductList component has hardcoded title "Öne Çıkan Ekipmanlar" which fits perfectly.

    app.innerHTML = `
      ${commonUI}
      <div id="main-content">
          ${Hero()}
          ${ProductList(displayProducts)}
          ${DivingMap()}
      </div>
      ${footerUI}
    `;
    setupHomePageInteractions();
  }
  else if (currentRoute.page === 'category') {
    const catId = currentRoute.params.id;
    // Categories now have mongodb _id, but we might be using string IDs or slugs from links.
    // The links in static data used string IDs like 'scuba'.
    // The new DB data has _id. 
    // We need to match robustly.
    const category = categories.find(c => c.id === catId || c.slug === catId || c._id === catId);
    const catTitle = category?.title || 'Kategori';

    seo.update(catTitle, `${catTitle} ekipmanlarında en iyi fiyatlar.`);

    app.innerHTML = `
      ${commonUI}
      <div id="main-content">
        ${CategoryPage(catId, catTitle, products)}
      </div>
      ${footerUI}
    `;
    setupCommonInteractions();
  }
  else if (currentRoute.page === 'product') {
    const product = products.find(p => p.id === parseInt(currentRoute.params.id));

    seo.update(product.name, `${product.name} - ${product.price}. Teknik özellikler ve detaylar.`);
    // Add Structured Data
    seo.setJsonLd({
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product.name,
      "image": product.image,
      "description": `Professional ${product.name} for underwater sports.`,
      "brand": {
        "@type": "Brand",
        "name": product.brand
      },
      "offers": {
        "@type": "Offer",
        "priceCurrency": "TRY",
        "price": typeof product.price === 'string' ? product.price.replace(' ₺', '').replace('.', '') : product.price,
        "availability": "https://schema.org/InStock"
      }
    });

    app.innerHTML = `
      ${commonUI}
      <div id="main-content">
          ${ProductDetail(product)}
      </div>
      ${footerUI}
    `;
    setupCommonInteractions();

    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.history.back();
      });
    }
  }
  else if (currentRoute.page === 'cart') {
    app.innerHTML = `
      ${commonUI}
      <div id="main-content" style="margin-top: 100px;">
          ${CartPage()}
      </div>
      ${footerUI}
    `;
    setupCommonInteractions();
    setupCartInteractions();
  }
  else if (currentRoute.page === 'payment-result') {
    // This page might be hit by redirection with query params ?status=success
    app.innerHTML = `
      ${commonUI}
      <div id="main-content" style="margin-top: 100px;">
          ${PaymentResult()}
      </div>
      ${footerUI}
    `;
    setupCommonInteractions();
  }

  // Setup Auth Interactions (Modal, etc)
  setupAuthInteractions();
}

function setupAuthInteractions() {
  if (window.__authInitialized) return;
  window.__authInitialized = true;

  console.log('🔧 setupAuthInteractions BAŞLADI');

  const getElements = () => ({
    modal: document.querySelector('#auth-modal'),
    loginForm: document.querySelector('#login-form'),
    registerForm: document.querySelector('#register-form'),
    closeBtn: document.querySelector('.close-modal'),
    modalOverlay: document.querySelector('.modal-overlay')
  });

  const closeModal = () => {
    const { modal, loginForm, registerForm } = getElements();
    if (!modal) return;

    console.log('❌ Modal kapatıldı');
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');

    if (loginForm) {
      loginForm.reset();
      const err = loginForm.querySelector('.error-msg');
      if (err) err.textContent = '';
    }
    if (registerForm) {
      registerForm.reset();
      const err = registerForm.querySelector('.error-msg');
      if (err) err.textContent = '';
    }
  };

  const openModal = (type = 'login') => {
    const { modal, loginForm, registerForm } = getElements();
    if (!modal || !loginForm || !registerForm) return;

    if (type === 'login') {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    }

    modal.classList.add('active');
    document.body.classList.add('modal-open');
  };

  // Global delegation for triggers and close
  document.addEventListener('click', async (e) => {
    const loginTrigger = e.target.closest('#login-trigger');
    const registerTrigger = e.target.closest('#register-trigger');
    const closeBtn = e.target.closest('.close-modal');
    const overlay = e.target.closest('.modal-overlay');
    const logoutBtn = e.target.closest('.logout-btn');
    const switchToRegister = e.target.closest('.switch-to-register');
    const switchToLogin = e.target.closest('.switch-to-login');
    const inlineRegister = e.target.closest('.inline-switch-register');

    if (loginTrigger) {
      e.preventDefault();
      openModal('login');
    } else if (registerTrigger) {
      e.preventDefault();
      openModal('register');
    } else if (closeBtn || overlay) {
      closeModal();
    } else if (logoutBtn) {
      e.preventDefault();
      await Auth.logout();
      Cart.items = [];
      Cart.notify();
    } else if (switchToRegister || inlineRegister) {
      e.preventDefault();
      openModal('register');
    } else if (switchToLogin) {
      e.preventDefault();
      openModal('login');
    }
  });

  // Form Submits - these need direct attachment or specific delegation
  // Since forms might be re-rendered, delegation on document is safer if Header(Auth.user) replaces them
  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'login-form') {
      e.preventDefault();
      const form = e.target;
      const res = await Auth.login(form.email.value, form.password.value);
      if (res.success) {
        closeModal();
        Cart.fetchCart();
      } else {
        const errorDiv = form.querySelector('.error-msg');
        if (errorDiv) {
          errorDiv.innerHTML = `${res.error || 'Giriş başarısız'}. <a href="#" class="inline-switch-register">Üye ol</a>`;
        }
      }
    } else if (e.target.id === 'register-form') {
      e.preventDefault();
      const form = e.target;
      // Fixed parameter order: email, password, name
      const res = await Auth.register(form.email.value, form.password.value, form.name.value);
      if (res.success) {
        closeModal();
        Cart.fetchCart();
      } else {
        const errorDiv = form.querySelector('.error-msg');
        if (errorDiv) errorDiv.textContent = res.error || 'Kayıt başarısız';
      }
    }
  });

  console.log('✅ setupAuthInteractions TAMAM');
}

function setupHomePageInteractions() {
  setupCommonInteractions();
  setupMapInteractions();
}

function setupCommonInteractions() {
  setupHeader();
  setupAIAssistant();
  setupProductInteractions(); // For cards in lists

  // Attach click listeners to all product cards rendered
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      navigate('product', { id });
    });
  });
}

// --- INITIALIZATION ---

async function fetchCategoriesFromAPI() {
  try {
    const res = await fetch(`${API_BASE}/api/categories`);
    return await res.json();
  } catch (e) {
    console.error('Kategoriler yüklenemedi', e);
    return [];
  }
}

// Initial render to show site immediately (even if backend is down)
// --- INITIALIZATION ---

(async () => {
  try {
    // Parallel fetch for speed
    const [prods, cats] = await Promise.all([
      fetchProductsFromAPI(),
      fetchCategoriesFromAPI()
    ]);
    products = prods;
    categories = cats;
    render();
  } catch (e) {
    console.error('Veri yüklenemedi', e);
    render();
  }
})();

// Background session check (non-blocking)
Auth.subscribe(() => {
  render();
});

// Non-blocking initialization
(async () => {
  try {
    await Auth.checkSession();
    // Cart.init() is internally async and non-blocking in its module
  } catch (e) {
    console.warn('Background check failed:', e);
  }
})();

// Global interactions
setupAuthInteractions();
