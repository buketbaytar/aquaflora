export function AuthModal() {
  return `
    <div id="auth-modal" class="modal-overlay hidden">
      <div class="modal-content glass-panel fade-in-up">
        <button class="close-modal">&times;</button>
        
        <div class="auth-tabs">
          <button class="tab-btn active" data-tab="login">Giriş Yap</button>
          <button class="tab-btn" data-tab="register">Üye Ol</button>
        </div>

        <div class="auth-forms">
          <!-- Login Form -->
          <form id="login-form" class="auth-form active">
            <div class="form-group">
              <label>E-posta</label>
              <input type="email" name="email" required placeholder="ornek@email.com">
            </div>
            <div class="form-group">
              <label>Şifre</label>
              <input type="password" name="password" required placeholder="********">
            </div>
            <button type="submit" class="submit-btn primary-btn full-width">Giriş Yap</button>
            <a href="#" class="forgot-pass">Şifremi Unuttum</a>
          </form>

          <!-- Register Form -->
          <form id="register-form" class="auth-form">
            <div class="form-group">
              <label>Ad Soyad</label>
              <input type="text" name="name" required placeholder="Adınız Soyadınız">
            </div>
            <div class="form-group">
              <label>E-posta</label>
              <input type="email" name="email" required placeholder="ornek@email.com">
            </div>
            <div class="form-group">
              <label>Şifre</label>
              <input type="password" name="password" required placeholder="********">
            </div>
            <button type="submit" class="submit-btn primary-btn full-width">Üye Ol</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

import { Auth } from '../utils/auth.js';

export function setupAuthInteractions() {
  const modal = document.querySelector('#auth-modal');
  const userBtn = document.querySelector('.user-btn');
  const closeBtn = document.querySelector('.close-modal');
  const tabs = document.querySelectorAll('.tab-btn');
  const forms = document.querySelectorAll('.auth-form');

  // Initialization
  Auth.init();

  // Open Modal (if not logged in)
  userBtn.addEventListener('click', () => {
    if (Auth.user) {
      alert("Zaten giriş yapıldı. Hesap sayfasına yönlendiriliyorsunuz (Demo).");
    } else {
      modal.classList.remove('hidden');
    }
  });

  // Close Modal
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Tab Switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      forms.forEach(f => f.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById(`${target}-form`).classList.add('active');
    });
  });

  // Login Logic
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const pass = e.target.password.value;

    try {
      await Auth.login(email, pass);
      modal.classList.add('hidden');
      showToast(`Hoşgeldin, ${Auth.user.name}`);
    } catch (err) {
      showToast(err); // Simple error show for now
    }
  });

  // Register Logic
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const email = e.target.email.value;
    const pass = e.target.password.value;

    try {
      await Auth.register(email, pass, name);
      modal.classList.add('hidden');
      showToast(`Kayıt başarılı! Hoşgeldin, ${name}`);
    } catch (err) {
      showToast(err);
    }
  });

  // Listen for auth changes to update Header UI
  Auth.subscribe((user) => {
    const btnText = document.querySelector('.user-btn .btn-text');
    if (user) {
      btnText.textContent = "Hesabım";
    } else {
      btnText.textContent = "Giriş / Üye Ol";
    }
  });
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification glass-panel slide-in-right';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
