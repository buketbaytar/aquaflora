import { escapeHTML as e } from '../utils/sanitize.js';
import { SITE } from '../config.js';

/** Site başlığı + mobil menü. Sadece oturum/kategori değişince yeniden çizilir. */
export function Header(user, categories = [], { cartCount = 0, favCount = 0, query = '' } = {}) {
  // Masaüstü menüye sığması için ilk 6 kategori; tamamı mobil menüde ve ürünler sayfasında
  const navItems = categories.slice(0, 6).map(cat => `
    <li class="nav-item group">
      <a href="/urunler?category=${e(cat.id)}">${e(cat.title)}</a>
      ${cat.sub?.length ? `<div class="mega-menu glass-panel"><ul>
        ${cat.sub.map(sub => `<li><a href="/urunler?category=${e(cat.id)}&subCategory=${encodeURIComponent(sub.slug)}">${e(sub.name)}</a></li>`).join('')}
      </ul></div>` : ''}
    </li>`).join('');

  const mobileCats = categories.map(cat => `
    <details class="m-cat">
      <summary>${e(cat.title)}</summary>
      <a href="/urunler?category=${e(cat.id)}">Tümü</a>
      ${(cat.sub || []).map(sub => `<a href="/urunler?category=${e(cat.id)}&subCategory=${encodeURIComponent(sub.slug)}">${e(sub.name)}</a>`).join('')}
    </details>`).join('');

  const userSection = user
    ? `<div class="user-menu">
         <a href="/hesabim" class="action-btn account-link" title="Hesabım"><span class="icon" aria-hidden="true">👤</span><span class="btn-label">${e(user.name?.split(' ')[0] || 'Hesabım')}</span></a>
         ${user.isAdmin ? '<a href="/kaptan_kosku_881.html" class="action-btn" title="Yönetim paneli" data-external>⚙️</a>' : ''}
       </div>`
    : `<div class="auth-buttons">
         <button class="auth-btn login-trigger" data-auth="login">Giriş Yap</button>
         <button class="auth-btn register-trigger" data-auth="register">Üye Ol</button>
       </div>`;

  return `
    <header class="site-header glass-panel">
      <div class="container header-inner">
        <button class="hamburger" aria-label="Menüyü aç" aria-expanded="false" aria-controls="mobile-menu">☰</button>
        <a href="/" class="logo" aria-label="${e(SITE.name)} ana sayfa">
          <span class="logo-icon" aria-hidden="true">🌊</span>
          <span class="logo-text">${e(SITE.name.toUpperCase())}</span>
        </a>

        <nav class="main-nav" aria-label="Kategoriler">
          <ul class="nav-list">
            ${navItems}
            <li class="nav-item"><a href="/urunler">Tüm Ürünler</a></li>
          </ul>
        </nav>

        <div class="header-right">
          <form class="search-bar" role="search" data-search>
            <input type="search" name="q" placeholder="Ürün, marka ara..." aria-label="Ürün ara" value="${e(query)}" maxlength="100">
            <button class="search-btn" type="submit" aria-label="Ara">🔍</button>
          </form>

          <div class="user-actions">
            ${userSection}
            <a href="/favoriler" class="action-btn fav-header-btn" title="Favorilerim" aria-label="Favorilerim">
              <span class="icon" aria-hidden="true">❤️</span>
              <span class="fav-count badge-count" ${favCount ? '' : 'hidden'}>${favCount}</span>
            </a>
            <a href="/sepet" class="action-btn cart-btn" title="Sepetim" aria-label="Sepetim">
              <span class="icon" aria-hidden="true">🛒</span>
              <span class="cart-count badge-count" ${cartCount ? '' : 'hidden'}>${cartCount}</span>
            </a>
          </div>
        </div>
      </div>
    </header>

    <div id="mobile-menu" class="mobile-menu" hidden>
      <div class="mobile-menu-panel">
        <button class="mobile-menu-close" aria-label="Menüyü kapat">×</button>
        <form class="m-search" role="search" data-search>
          <input type="search" name="q" placeholder="Ürün, marka ara..." aria-label="Ürün ara" maxlength="100">
          <button type="submit" aria-label="Ara">🔍</button>
        </form>
        <nav aria-label="Mobil menü">
          <a href="/urunler" class="m-link">Tüm Ürünler</a>
          ${mobileCats}
          <hr>
          ${user
            ? `<a href="/hesabim" class="m-link">👤 Hesabım & Siparişlerim</a><button class="m-link logout-btn">🚪 Çıkış Yap</button>`
            : `<button class="m-link" data-auth="login">Giriş Yap</button><button class="m-link" data-auth="register">Üye Ol</button>`}
          <a href="/siparis-takip" class="m-link">📦 Sipariş Takibi</a>
          <a href="/favoriler" class="m-link">❤️ Favorilerim</a>
        </nav>
      </div>
    </div>`;
}

/** Giriş / Kayıt / Şifremi unuttum penceresi (bir kez çizilir) */
export function AuthModal() {
  return `
    <div id="auth-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" hidden>
      <div class="modal-overlay" data-close-modal></div>
      <div class="modal-content glass-panel">
        <button class="close-modal" aria-label="Kapat" data-close-modal>×</button>

        <form id="login-form" class="auth-form" data-view="login" novalidate>
          <h2 id="auth-title">Hoş geldiniz</h2>
          <p class="auth-subtitle">Hesabınıza giriş yapın</p>
          <label>E-posta<input type="email" name="email" autocomplete="email" required></label>
          <label>Şifre<input type="password" name="password" autocomplete="current-password" required></label>
          <button type="submit" class="submit-btn">Giriş Yap</button>
          <div class="error-msg" role="alert"></div>
          <div class="auth-switch">
            <a href="#" data-auth="forgot">Şifremi unuttum</a> ·
            Hesabınız yok mu? <a href="#" data-auth="register">Üye olun</a>
          </div>
        </form>

        <form id="register-form" class="auth-form" data-view="register" novalidate hidden>
          <h2>Hesap oluştur</h2>
          <p class="auth-subtitle">Siparişlerinizi takip edin, favorilerinizi kaydedin</p>
          <label>Ad Soyad<input type="text" name="name" autocomplete="name" required minlength="2" maxlength="80"></label>
          <label>E-posta<input type="email" name="email" autocomplete="email" required></label>
          <label>Şifre<input type="password" name="password" autocomplete="new-password" required minlength="8" placeholder="En az 8 karakter"></label>
          <label class="check"><input type="checkbox" name="kvkk" required>
            <span><a href="/kvkk.html" target="_blank" rel="noopener">KVKK Aydınlatma Metni</a>'ni okudum.</span></label>
          <label class="check"><input type="checkbox" name="marketing">
            <span>Kampanya ve fırsatlardan e-posta/SMS ile haberdar olmak istiyorum. (İsteğe bağlı)</span></label>
          <button type="submit" class="submit-btn register-submit">Üye Ol</button>
          <div class="error-msg" role="alert"></div>
          <div class="auth-switch">Zaten üye misiniz? <a href="#" data-auth="login">Giriş yapın</a></div>
        </form>

        <form id="forgot-form" class="auth-form" data-view="forgot" novalidate hidden>
          <h2>Şifremi unuttum</h2>
          <p class="auth-subtitle">E-posta adresinize sıfırlama bağlantısı gönderelim.</p>
          <label>E-posta<input type="email" name="email" autocomplete="email" required></label>
          <button type="submit" class="submit-btn">Bağlantı gönder</button>
          <div class="error-msg" role="alert"></div>
          <div class="auth-switch"><a href="#" data-auth="login">Girişe dön</a></div>
        </form>
      </div>
    </div>`;
}
