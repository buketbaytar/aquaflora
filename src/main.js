import './style.css';
import './products-page.css';
import './app.css';

import { SITE, runtime } from './config.js';
import { api } from './utils/api.js';
import { Auth } from './utils/auth.js';
import { Cart } from './utils/cart.js';
import { Favorites } from './utils/favorites.js';
import { toast } from './utils/toast.js';
import { seo } from './utils/seo.js';
import { escapeHTML as e } from './utils/sanitize.js';

import { Header, AuthModal } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { Hero } from './components/Hero.js';
import { ProductList, ProductGrid, setupProductInteractions } from './components/ProductList.js';
import { productUrl } from './components/ProductCard.js';
import { ProductDetail } from './components/ProductDetail.js';
import { FilterSidebar, SortBar } from './components/FilterSidebar.js';
import { DivingMap, setupMapInteractions } from './components/DivingMap.js';
import { CartPage } from './components/CartPage.js';
import { CheckoutPage, mountCheckout } from './components/CheckoutPage.js';
import {
  OrderResultPage, mountOrderResult, OrderTrackPage, mountOrderTrack,
  AccountPage, mountAccount, ResetPasswordPage, mountResetPassword
} from './components/OrderPages.js';
import { ChatWidget, setupChatWidget } from './components/AIAssistant.js';

/* =============================== Durum =============================== */
const state = { products: [], categories: [], productsLoaded: false };
const app = document.querySelector('#app');

app.innerHTML = `
  <a href="#main-content" class="skip-link">İçeriğe geç</a>
  <div id="header-root"></div>
  <main id="main-content" tabindex="-1"></main>
  <div id="footer-root"></div>`;
document.body.insertAdjacentHTML('beforeend', AuthModal() + ChatWidget());

const headerRoot = document.getElementById('header-root');
const main = document.getElementById('main-content');
const footerRoot = document.getElementById('footer-root');

/* =============================== Router =============================== */
const ROUTES = [
  { path: /^\/$/, page: 'home' },
  { path: /^\/(urunler|urunler\.html)$/, page: 'products' },
  { path: /^\/urun\/(.+)$/, page: 'product' },
  { path: /^\/sepet$/, page: 'cart' },
  { path: /^\/odeme$/, page: 'checkout' },
  { path: /^\/odeme-sonuc$/, page: 'orderResult' },
  { path: /^\/favoriler$/, page: 'favorites' },
  { path: /^\/hesabim$/, page: 'account' },
  { path: /^\/siparis-takip$/, page: 'track' },
  { path: /^\/sifre-sifirla$/, page: 'reset' }
];

let current = { page: 'home', params: [] };

function resolve(pathname) {
  for (const r of ROUTES) {
    const m = pathname.match(r.path);
    if (m) return { page: r.page, params: m.slice(1) };
  }
  return { page: 'notFound', params: [] };
}

export function navigate(href, { replace = false } = {}) {
  const url = new URL(href, location.origin);
  if (url.origin !== location.origin) { location.assign(href); return; }
  const samePage = url.pathname === location.pathname;
  history[replace ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search + url.hash);
  renderPage({ scroll: !samePage || !replace });
  closeMobileMenu();
}

window.addEventListener('popstate', () => renderPage({ scroll: false }));

/* =============================== Layout =============================== */
function renderHeader() {
  const q = current.page === 'products' ? new URLSearchParams(location.search).get('q') || '' : '';
  headerRoot.innerHTML = Header(Auth.user, state.categories, { cartCount: Cart.count(), favCount: Favorites.ids.size, query: q });
  updateBadges();
}
function renderFooter() { footerRoot.innerHTML = Footer(state.categories); }

function updateBadges() {
  const set = (sel, n) => document.querySelectorAll(sel).forEach(el => { el.textContent = n; el.hidden = !n; });
  set('.cart-count', Cart.count());
  set('.fav-count', Favorites.ids.size);
}

window.addEventListener('scroll', () => {
  document.querySelector('.site-header')?.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

/* =============================== Sayfalar =============================== */
const loadingHTML = '<div class="container page-pad"><p class="loading">Yükleniyor…</p></div>';

function readFilters() {
  const p = new URLSearchParams(location.search);
  return {
    q: (p.get('q') || '').trim(),
    category: p.get('category') || '',
    subCategory: p.get('subCategory') || '',
    brands: (p.get('brand') || '').split(',').filter(Boolean),
    maxPrice: Number(p.get('maxPrice')) || 0,
    inStock: p.get('inStock') === '1',
    sort: p.get('sort') || ''
  };
}

const normTR = (s) => String(s || '').toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');

function applyFilters(list, f) {
  const cat = state.categories.find(c => c.id === f.category || c.slug === f.category);
  const sub = cat?.sub?.find(s => s.slug === f.subCategory);
  const tokens = normTR(f.q).split(/\s+/).filter(t => t.length > 1);
  let out = list.filter(p => {
    if (cat && p.categoryId !== cat.id && p.category !== cat.title) return false;
    if (f.subCategory && sub && p.subCategoryId !== sub.id && p.subCategory !== sub.name) return false;
    if (f.brands.length && !f.brands.includes(p.brand)) return false;
    if (f.maxPrice && p.price > f.maxPrice) return false;
    if (f.inStock && !p.inStock) return false;
    if (tokens.length) {
      const hay = normTR(`${p.name} ${p.brand} ${p.category} ${p.subCategory} ${p.description}`);
      if (!tokens.every(t => hay.includes(t))) return false;
    }
    return true;
  });
  const sorters = {
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    popular: (a, b) => b.views - a.views
  };
  if (sorters[f.sort]) out = [...out].sort(sorters[f.sort]);
  return out;
}

function productsPage() {
  const f = readFilters();
  const list = applyFilters(state.products, f);
  const cat = state.categories.find(c => c.id === f.category);
  seo.set({
    title: f.q ? `"${f.q}" arama sonuçları` : (cat ? cat.title : 'Tüm Ürünler'),
    description: `${cat ? cat.title : 'Dalış, yüzme ve outdoor'} ürünlerinde en uygun fiyatlar.`,
    noindex: !!f.q
  });
  return `
    <div class="container page-pad">
      <h1 class="page-title">${f.q ? `Arama: "${e(f.q)}"` : e(cat?.title || 'Tüm Ürünler')}</h1>
      <div class="products-page-layout" id="filters">
        ${FilterSidebar(state.categories, state.products, f)}
        <div class="products-container">
          ${SortBar(list.length, f)}
          ${ProductGrid(list)}
        </div>
      </div>
    </div>`;
}

function updateFilterUrl(mutator) {
  const p = new URLSearchParams(location.search);
  mutator(p);
  [...p.keys()].forEach(k => { if (!p.get(k)) p.delete(k); });
  const qs = p.toString();
  navigate(`/urunler${qs ? `?${qs}` : ''}`, { replace: true });
}

function mountProducts(root) {
  const sidebar = root.querySelector('.filter-sidebar');
  sidebar?.addEventListener('change', (ev) => {
    const t = ev.target;
    updateFilterUrl(p => {
      if (t.name === 'category') { p.set('category', t.value); p.delete('subCategory'); }
      if (t.name === 'subCategory') p.set('subCategory', t.value);
      if (t.name === 'brand') p.set('brand', [...sidebar.querySelectorAll('input[name=brand]:checked')].map(x => x.value).join(','));
      if (t.name === 'maxPrice') p.set('maxPrice', t.value === t.max ? '' : t.value);
      if (t.name === 'inStock') p.set('inStock', t.checked ? '1' : '');
    });
  });
  sidebar?.querySelector('#price-range')?.addEventListener('input', (ev) => {
    sidebar.querySelector('#price-value').textContent = `${Number(ev.target.value).toLocaleString('tr-TR')} ₺`;
  });
  sidebar?.querySelector('#clear-filters')?.addEventListener('click', () => {
    const q = new URLSearchParams(location.search).get('q');
    navigate(q ? `/urunler?q=${encodeURIComponent(q)}` : '/urunler', { replace: true });
  });
  root.querySelector('#sort-select')?.addEventListener('change', (ev) => updateFilterUrl(p => p.set('sort', ev.target.value)));
  root.querySelector('.filter-toggle')?.addEventListener('click', () => root.querySelector('.products-page-layout')?.classList.toggle('show-filters'));
}

async function productPage(root) {
  const key = current.params[0] || '';
  const id = key.match(/([a-f0-9]{24})$/i)?.[1] || decodeURIComponent(key);
  let product = state.products.find(p => p.id === id || String(p.legacyId) === id || p.slug === id);
  if (!product) {
    try { product = await api.get(`/products/${encodeURIComponent(id)}`); } catch { product = null; }
  }
  if (!product) {
    root.innerHTML = notFoundHTML('Ürün bulunamadı veya satıştan kaldırıldı.');
    seo.set({ title: 'Ürün bulunamadı', noindex: true });
    return;
  }
  // Eski/eksik URL'yi kanonik adrese çevir
  const canonical = productUrl(product);
  if (location.pathname !== canonical) history.replaceState({}, '', canonical);

  seo.set({
    title: product.name,
    description: (product.description || `${product.brand} ${product.name} — ${product.category}`).slice(0, 160),
    image: product.image,
    jsonLd: {
      '@context': 'https://schema.org/', '@type': 'Product', name: product.name, image: product.image ? [product.image] : undefined,
      sku: product.id, brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
      offers: {
        '@type': 'Offer', priceCurrency: 'TRY', price: product.price.toFixed(2), url: location.href,
        availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
      }
    }
  });
  root.innerHTML = ProductDetail(product);
  root.dataset.productId = product.id;
  api.post(`/products/${product.id}/view`).catch(() => { });

  const related = state.products.filter(p => p.id !== product.id && p.categoryId === product.categoryId && p.inStock).slice(0, 4);
  if (related.length) {
    root.insertAdjacentHTML('beforeend', ProductList(related, { title: 'Benzer <span class="highlight">Ürünler</span>', showAll: false }));
    setupProductInteractions(root);
  }
}

function notFoundHTML(msg = 'Aradığınız sayfa bulunamadı.') {
  return `<div class="container page-pad"><div class="glass-panel result-hero error"><h1>404</h1><p>${e(msg)}</p>
    <a href="/" class="btn primary-btn">Ana sayfa</a> <a href="/urunler" class="btn secondary-btn">Ürünler</a></div></div>`;
}

async function renderPage({ scroll = true } = {}) {
  current = resolve(location.pathname);
  const root = main;
  delete root.dataset.productId;
  const needsProducts = ['home', 'products', 'favorites'].includes(current.page);
  if (needsProducts && !state.productsLoaded) { root.innerHTML = loadingHTML; return; }

  switch (current.page) {
    case 'home': {
      seo.set({ description: `${SITE.name}: tüplü dalış, serbest dalış, yüzme ve outdoor ekipmanları. Güvenli ödeme, hızlı kargo, kolay iade.` });
      const featured = state.products.filter(p => p.isFeatured && p.inStock);
      const show = (featured.length ? featured : state.products.filter(p => p.inStock)).slice(0, 8);
      root.innerHTML = Hero() + ProductList(show) + DivingMap();
      setupProductInteractions(root);
      setupMapInteractions();
      break;
    }
    case 'products':
      root.innerHTML = productsPage();
      mountProducts(root);
      setupProductInteractions(root);
      break;
    case 'product':
      root.innerHTML = loadingHTML;
      await productPage(root);
      break;
    case 'cart':
      seo.set({ title: 'Sepetim', noindex: true });
      root.innerHTML = CartPage();
      break;
    case 'checkout':
      seo.set({ title: 'Ödeme', noindex: true });
      root.innerHTML = CheckoutPage();
      mountCheckout(root, navigate);
      break;
    case 'orderResult':
      seo.set({ title: 'Sipariş durumu', noindex: true });
      root.innerHTML = OrderResultPage();
      mountOrderResult(root);
      break;
    case 'favorites': {
      seo.set({ title: 'Favorilerim', noindex: true });
      const favs = state.products.filter(p => Favorites.has(p.id));
      root.innerHTML = `<div class="container page-pad"><h1 class="page-title">Favorilerim (${favs.length})</h1>
        ${!Auth.user ? '<p>Favorilerinizi kaydetmek için <button class="link-btn" data-auth="login">giriş yapın</button>.</p>'
          : (favs.length ? ProductGrid(favs) : '<p class="no-results">Henüz favori ürününüz yok.</p>')}</div>`;
      setupProductInteractions(root);
      break;
    }
    case 'account':
      seo.set({ title: 'Hesabım', noindex: true });
      root.innerHTML = AccountPage();
      mountAccount(root);
      break;
    case 'track':
      seo.set({ title: 'Sipariş Takibi', noindex: true });
      root.innerHTML = OrderTrackPage();
      mountOrderTrack(root);
      break;
    case 'reset':
      seo.set({ title: 'Şifre sıfırlama', noindex: true });
      root.innerHTML = ResetPasswordPage();
      mountResetPassword(root, navigate);
      break;
    default:
      seo.set({ title: 'Sayfa bulunamadı', noindex: true });
      root.innerHTML = notFoundHTML();
  }
  // Header arama kutusunu güncel tut
  const q = current.page === 'products' ? new URLSearchParams(location.search).get('q') || '' : '';
  document.querySelectorAll('[data-search] input[name=q]').forEach(i => { if (document.activeElement !== i) i.value = q; });
  if (scroll) window.scrollTo(0, 0);
}

/* =============================== Giriş penceresi =============================== */
const modal = document.getElementById('auth-modal');
let lastFocus = null;

function openAuth(view = 'login') {
  lastFocus = document.activeElement;
  modal.hidden = false;
  modal.classList.add('active');
  document.body.classList.add('modal-open');
  modal.querySelectorAll('.auth-form').forEach(f => { f.hidden = f.dataset.view !== view; });
  modal.querySelector(`.auth-form[data-view="${view}"] input`)?.focus();
  closeMobileMenu();
}
function closeAuth() {
  modal.classList.remove('active');
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  modal.querySelectorAll('form').forEach(f => { f.reset(); f.querySelector('.error-msg').textContent = ''; });
  lastFocus?.focus?.();
}
modal.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeAuth(); });

async function handleAuthSubmit(form) {
  const err = form.querySelector('.error-msg');
  const btn = form.querySelector('button[type=submit]');
  err.textContent = '';
  btn.disabled = true;
  try {
    if (form.id === 'login-form') {
      const u = await Auth.login(form.email.value, form.password.value);
      toast(`Hoş geldin, ${u.name?.split(' ')[0] || ''}`, 'success');
      closeAuth();
    } else if (form.id === 'register-form') {
      if (!form.kvkk.checked) throw new Error('Devam etmek için KVKK Aydınlatma Metni\'ni onaylayın');
      await Auth.register({ name: form.name.value, email: form.email.value, password: form.password.value, kvkk: true, marketing: form.marketing.checked });
      toast('Üyeliğiniz oluşturuldu 🎉', 'success');
      closeAuth();
    } else if (form.id === 'forgot-form') {
      const d = await Auth.forgotPassword(form.email.value);
      err.textContent = d.message;
      err.classList.add('ok');
    }
  } catch (ex) {
    err.classList.remove('ok');
    err.textContent = ex.details ? Object.values(ex.details).join(' · ') : ex.message;
  } finally {
    btn.disabled = false;
  }
}

/* =============================== Mobil menü =============================== */
function openMobileMenu() {
  const m = document.getElementById('mobile-menu');
  if (!m) return;
  m.hidden = false;
  document.querySelector('.hamburger')?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('modal-open');
}
function closeMobileMenu() {
  const m = document.getElementById('mobile-menu');
  if (!m || m.hidden) return;
  m.hidden = true;
  document.querySelector('.hamburger')?.setAttribute('aria-expanded', 'false');
  if (!modal.classList.contains('active')) document.body.classList.remove('modal-open');
}

/* =============================== Olay delegasyonu =============================== */
function isInternalLink(a) {
  if (!a || a.target || a.hasAttribute('download') || a.hasAttribute('data-external')) return false;
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false;
  const path = href.split(/[?#]/)[0];
  return !path.startsWith('/api') && !/\.[a-z0-9]+$/i.test(path);
}

document.addEventListener('click', async (ev) => {
  const t = ev.target;
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;

  const authBtn = t.closest('[data-auth]');
  if (authBtn) { ev.preventDefault(); openAuth(authBtn.dataset.auth); return; }
  if (t.closest('[data-close-modal]')) { closeAuth(); return; }
  if (t.closest('.hamburger')) { openMobileMenu(); return; }
  if (t.closest('.mobile-menu-close') || t === document.getElementById('mobile-menu')) { closeMobileMenu(); return; }
  if (t.closest('.logout-btn')) {
    ev.preventDefault();
    await Auth.logout();
    toast('Çıkış yapıldı');
    navigate('/');
    return;
  }

  const favBtn = t.closest('[data-fav]');
  if (favBtn) {
    ev.preventDefault();
    if (!(await Favorites.toggle(favBtn.dataset.fav))) { toast('Favorilere eklemek için giriş yapın'); openAuth('login'); }
    return;
  }

  const addBtn = t.closest('[data-add]');
  if (addBtn) {
    ev.preventDefault();
    const p = state.products.find(x => x.id === addBtn.dataset.add);
    if (!p) return;
    if (p.variants.length) { navigate(productUrl(p)); return; }
    addBtn.disabled = true;
    await Cart.add(p);
    addBtn.disabled = false;
    return;
  }

  const thumb = t.closest('[data-gallery]');
  if (thumb) {
    const main = document.getElementById('pdp-main-image');
    if (main) main.src = thumb.dataset.gallery;
    document.querySelectorAll('.pdp-thumb').forEach(b => b.classList.toggle('active', b === thumb));
    return;
  }

  const sizeBtn = t.closest('.size-btn');
  if (sizeBtn && !sizeBtn.disabled) {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.toggle('active', b === sizeBtn));
    const add = document.querySelector('[data-add-detail]');
    const qty = document.querySelector('.qty-input');
    if (qty) { qty.max = Math.min(99, Number(sizeBtn.dataset.stock)); qty.value = Math.min(Number(qty.value) || 1, qty.max); }
    if (add) { add.disabled = false; add.textContent = 'SEPETE EKLE'; }
    return;
  }

  const qtyBtn = t.closest('[data-qty]');
  if (qtyBtn) {
    const input = qtyBtn.parentElement.querySelector('.qty-input');
    input.value = Math.max(1, Math.min(Number(input.max) || 99, (Number(input.value) || 1) + Number(qtyBtn.dataset.qty)));
    return;
  }

  const addDetail = t.closest('[data-add-detail]');
  if (addDetail) {
    const id = addDetail.dataset.addDetail;
    const p = state.products.find(x => x.id === id) || await api.get(`/products/${id}`).catch(() => null);
    if (!p) return;
    const size = document.querySelector('.size-btn.active')?.dataset.size || null;
    const qty = Number(document.querySelector('.qty-input')?.value) || 1;
    addDetail.disabled = true;
    await Cart.add(p, size, qty);
    addDetail.disabled = false;
    return;
  }

  const cartQty = t.closest('[data-cart-qty]');
  const cartRemove = t.closest('[data-cart-remove]');
  if (cartQty || cartRemove) {
    const row = t.closest('.cart-item');
    const pid = row.dataset.pid;
    const variant = row.dataset.variant || null;
    if (cartRemove) await Cart.remove(pid, variant);
    else {
      const line = Cart.items.find(i => i.productId === pid && (i.selectedVariant || null) === variant);
      await Cart.setQuantity(pid, variant, (line?.quantity || 1) + Number(cartQty.dataset.cartQty));
    }
    return;
  }

  const copy = t.closest('[data-copy]');
  if (copy) {
    navigator.clipboard?.writeText(copy.dataset.copy).then(() => toast('IBAN kopyalandı', 'success'));
    return;
  }

  const cancel = t.closest('[data-cancel-order]');
  if (cancel) {
    if (!confirm('Siparişi iptal etmek istediğinize emin misiniz?')) return;
    try {
      await api.post(`/orders/${encodeURIComponent(cancel.dataset.cancelOrder)}/cancel`);
      toast('Sipariş iptal edildi', 'success');
      renderPage({ scroll: false });
      loadProducts(); // stoklar güncellendi
    } catch (ex) { toast(ex.message, 'error'); }
    return;
  }

  const a = t.closest('a');
  if (a?.classList.contains('disabled')) { ev.preventDefault(); return; }
  if (isInternalLink(a)) {
    ev.preventDefault();
    navigate(a.getAttribute('href'));
  }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target;
  if (form.matches('#login-form, #register-form, #forgot-form')) {
    ev.preventDefault();
    handleAuthSubmit(form);
  } else if (form.matches('[data-search]')) {
    ev.preventDefault();
    const q = form.q.value.trim();
    navigate(q ? `/urunler?q=${encodeURIComponent(q)}` : '/urunler');
  }
});

/* =============================== Abonelikler =============================== */
Auth.subscribe(async (user, event) => {
  renderHeader();
  if (event === 'login') {
    await Promise.all([Cart.onLogin(), Favorites.load()]);
  } else if (event === 'logout') {
    Cart.onLogout();
    Favorites.load();
  }
  if (['account', 'favorites', 'checkout', 'cart'].includes(current.page)) renderPage({ scroll: false });
});

Cart.subscribe(() => {
  updateBadges();
  if (current.page === 'cart') renderPage({ scroll: false });
  if (current.page === 'checkout' && !document.getElementById('checkout-form')) renderPage({ scroll: false });
});

Favorites.subscribe((ids) => {
  updateBadges();
  document.querySelectorAll('[data-fav]').forEach(b => {
    const on = ids.has(b.dataset.fav);
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
    b.querySelector('svg')?.setAttribute('fill', on ? 'currentColor' : 'none');
  });
  if (current.page === 'favorites') renderPage({ scroll: false });
});

/* =============================== Çerez bildirimi =============================== */
function cookieBanner() {
  try { if (localStorage.getItem('aq_cookie_ok')) return; } catch { return; }
  document.body.insertAdjacentHTML('beforeend', `
    <div class="cookie-banner glass-panel" role="region" aria-label="Çerez bildirimi">
      <p>Sitemiz yalnızca oturum ve sepetinizin çalışması için zorunlu çerezler kullanır; reklam/izleme çerezi kullanılmaz.
        <a href="/kvkk.html#cerez">Çerez politikası</a></p>
      <button class="btn primary-btn small" type="button">Anladım</button>
    </div>`);
  const b = document.querySelector('.cookie-banner');
  b.querySelector('button').addEventListener('click', () => {
    try { localStorage.setItem('aq_cookie_ok', '1'); } catch { /* */ }
    b.remove();
  });
}

/* =============================== Başlatma =============================== */
async function loadProducts() {
  try {
    state.products = await api.get('/products');
  } catch (ex) {
    toast('Ürünler yüklenemedi. Lütfen sayfayı yenileyin.', 'error');
    state.products = [];
  }
  state.productsLoaded = true;
}

(async function boot() {
  current = resolve(location.pathname);
  renderHeader();
  renderFooter();
  renderPage({ scroll: false });
  setupChatWidget({ navigate, openAuth });
  cookieBanner();

  const [cfg, cats] = await Promise.all([
    api.get('/config').catch(() => null),
    api.get('/categories').catch(() => []),
    Auth.init(),
    loadProducts()
  ]);
  if (cfg) Object.assign(runtime, cfg);
  state.categories = cats;
  if (runtime.storeMode === 'preview') {
    document.body.classList.add('store-preview');
    document.body.insertAdjacentHTML('afterbegin', `<div class="preview-banner" role="status">🌊 Mağazamız çok yakında satışa açılıyor — şu an ürünlerimizi inceleyebilirsiniz, siparişler henüz alınmıyor.</div>`);
    const setH = () => document.body.style.setProperty('--banner-h', `${document.querySelector('.preview-banner')?.offsetHeight || 0}px`);
    setH();
    window.addEventListener('resize', setH, { passive: true });
    if (current.page === 'checkout') renderPage({ scroll: false });
  }

  await Promise.all([Cart.load(), Favorites.load()]);
  renderHeader();
  renderFooter();
  renderPage({ scroll: false });

  // Ödeme dönüşünde veya bağlantıdan gelince giriş penceresini aç: /?giris=1
  if (new URLSearchParams(location.search).get('giris') === '1' && !Auth.user) openAuth('login');
})();
