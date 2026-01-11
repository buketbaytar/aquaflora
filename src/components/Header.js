import { escapeHTML } from '../utils/sanitize.js';

export function Header(user, categories = []) {
  // Define navItems
  // Define navItems
  const navItems = categories.map(cat => `
    <li class="nav-item group">
      <a href="/urunler.html?category=${cat.id}">${escapeHTML(cat.title)}</a>
      <div class="mega-menu glass-panel">
        <ul>
          ${cat.sub.map(sub => `<li><a href="/urunler.html?subCategory=${sub.slug}&category=${cat.id}">${escapeHTML(sub.name)}</a></li>`).join('')}
        </ul>
      </div>
    </li>
  `).join('');

  // Determine user display - now with separate buttons
  const userSection = user
    ? `
      <div class="user-profile">
        <span class="user-greeting">Merhaba, ${escapeHTML(user.name)}</span>
        <button class="action-btn logout-btn" title="Çıkış Yap">
           Çıkış Yap <span class="icon">🚪</span>
        </button>
      </div>`
    : `
      <div class="auth-buttons">
        <button class="auth-btn login-trigger" id="login-trigger">Giriş Yap</button>
        <button class="auth-btn register-trigger" id="register-trigger">Üye Ol</button>
      </div>`;

  return `
    <header class="site-header glass-panel">
      <div class="container header-inner">
        <!-- Logo -->
        <a href="/" class="logo">
          <span class="logo-icon">🌊</span>
          <span class="logo-text">AQUA<span class="highlight">FLORA</span></span>
        </a>

        <!-- Navigation -->
        <nav class="main-nav">
          <ul class="nav-list">
            ${navItems}
            <li class="nav-item"><a href="#blog">Blog</a></li>
          </ul>
        </nav>

        <!-- Search & User -->
        <div class="header-right">
             <!-- Search -->
            <div class="search-bar">
              <input type="text" placeholder="Ekipman ara..." aria-label="Search">
              <button class="search-btn">🔍</button>
            </div>

            <!-- User Actions -->
            <div class="user-actions">
              ${userSection}
              
              <button class="action-btn fav-header-btn" title="Favorilerim">
                  <span class="icon">❤️</span>
                  <span class="fav-count">0</span>
              </button>

              <button class="action-btn cart-btn">
                 <span class="icon">🛒</span>
                 <span class="cart-count">0</span>
              </button>
            </div>
        </div>
      </div>
      
    </header>

    <!-- Auth Modal moved outside to avoid header's stacking context/backdrop-filter -->
    <div id="auth-modal" class="modal">
      <div class="modal-overlay"></div>
      <div class="modal-content glass-panel">
          <span class="close-modal">&times;</span>
          
          <!-- Login Form -->
          <form id="login-form" class="auth-form">
              <h2>Hoşgeldiniz</h2>
              <p class="auth-subtitle">Hesabınıza giriş yapın</p>
              <input type="email" name="email" placeholder="E-Posta" required>
              <input type="password" name="password" placeholder="Şifre" required>
              <button type="submit" class="submit-btn">Giriş Yap</button>
              <div class="error-msg"></div>
              <div class="auth-switch">
                  Hesabınız yok mu? <a href="#" class="switch-to-register">Üye Ol</a>
              </div>
          </form>

          <!-- Register Form -->
          <form id="register-form" class="auth-form hidden">
              <h2>Hesap Oluştur</h2>
              <p class="auth-subtitle">Hemen ücretsiz üye olun</p>
              <input type="text" name="name" placeholder="Ad Soyad" required>
              <input type="email" name="email" placeholder="E-Posta" required>
              <input type="password" name="password" placeholder="Şifre (min. 6 karakter)" required minlength="6">
              <button type="submit" class="submit-btn register-submit">Üye Ol</button>
              <div class="error-msg"></div>
              <div class="auth-switch">
                  Zaten üye misiniz? <a href="#" class="switch-to-login">Giriş Yap</a>
              </div>
          </form>
      </div>
    </div>

    <style>
        /* Auth Buttons in Header */
        .auth-buttons { display: flex; gap: 10px; }
        .auth-btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: all 0.3s; }
        .auth-btn.login-trigger { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.3); }
        .auth-btn.login-trigger:hover { border-color: var(--primary-color); color: var(--primary-color); }
        .auth-btn.register-trigger { background: var(--primary-color); color: #fff; }
        .auth-btn.register-trigger:hover { background: var(--primary-color-dark, #3a56d4); transform: translateY(-1px); }
        
        /* Modal Styles */
        .modal {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999; /* Higher z-index to stay above everything */
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
          padding: 2.5rem;
        }

        .modal.active {
          opacity: 1;
          pointer-events: all;
        }

        .modal-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.85); /* Slightly darker */
          backdrop-filter: blur(8px);
        }

        .modal-content {
          position: relative;
          z-index: 100000;
          width: 100%;
          max-width: 440px;
          padding: 3rem;
          max-height: 90vh;
          overflow-y: auto;
          transform: translateY(30px);
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .modal.active .modal-content {
          transform: translateY(0);
        }

        .close-modal {
          position: absolute;
          top: 20px;
          right: 25px;
          font-size: 32px;
          cursor: pointer;
          color: #888;
          transition: all 0.2s;
          z-index: 100001;
          user-select: none;
          line-height: 1;
        }
        .close-modal:hover {
          color: #fff;
          transform: scale(1.1);
        }




        /* Auth Form Styles */
        .auth-form { display: flex; flex-direction: column; gap: 15px; }
        .auth-form.hidden { display: none; }
        .auth-form h2 { margin: 0 0 5px 0; font-size: 1.5rem; }
        .auth-subtitle { color: #888; margin: 0 0 10px 0; font-size: 0.9rem; }
        .auth-form input { padding: 14px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #fff; font-size: 1rem; transition: border-color 0.2s; }
        .auth-form input:focus { outline: none; border-color: var(--primary-color); }
        .auth-form input::placeholder { color: #666; }
        .submit-btn { padding: 14px; border-radius: 10px; border: none; background: var(--primary-color); color: #fff; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s; }
        .submit-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(67, 97, 238, 0.4); }
        .register-submit { background: linear-gradient(135deg, #2a9d8f, #21867a); }
        .register-submit:hover { box-shadow: 0 4px 15px rgba(42, 157, 143, 0.4); }
        .error-msg { color: #ff6b6b; font-size: 0.9rem; min-height: 20px; text-align: center; }
        .auth-switch { text-align: center; color: #888; font-size: 0.9rem; margin-top: 10px; }
        .auth-switch a { color: var(--primary-color); text-decoration: none; font-weight: 500; }
        .auth-switch a:hover { text-decoration: underline; }
        .user-greeting { margin-right: 15px; font-size: 0.9rem; color: #ccc; }
      </style>
    </header>
  `;
}

export function setupHeader() {
  // Sticky Header Logic or other interactivity
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}


