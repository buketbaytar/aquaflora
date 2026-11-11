import { SITE, runtime } from '../config.js';
import { escapeHTML as e } from '../utils/sanitize.js';

export function Footer(categories = []) {
  const s = runtime.support || {};
  return `
    <footer class="site-footer">
      <div class="container footer-top">
        <div class="footer-logo">
          <span class="logo-icon" aria-hidden="true">🌊</span>
          <span class="logo-text">${e(SITE.name.toUpperCase())}</span>
        </div>
        <p class="footer-desc">Sualtı tutkunları için teknolojiyi ve performansı birleştiren yeni nesil ekipmanlar.</p>
        <div class="geo-info">
          ${s.phone ? `<div class="geo-item"><span aria-hidden="true">📞</span><a href="tel:${e(s.phone.replace(/\s/g, ''))}">${e(s.phone)}</a></div>` : ''}
          ${s.email ? `<div class="geo-item"><span aria-hidden="true">✉️</span><a href="mailto:${e(s.email)}">${e(s.email)}</a></div>` : ''}
          ${s.hours ? `<div class="geo-item"><span aria-hidden="true">🕘</span><span>${e(s.hours)}</span></div>` : ''}
        </div>
      </div>

      <div class="container footer-grid">
        <div class="footer-section">
          <h4>Kategoriler</h4>
          <ul>
            ${categories.slice(0, 6).map(c => `<li><a href="/urunler?category=${e(c.id)}">${e(c.title)}</a></li>`).join('')}
            <li><a href="/urunler">Tüm Ürünler</a></li>
          </ul>
        </div>

        <div class="footer-section">
          <h4>Müşteri Hizmetleri</h4>
          <ul>
            <li><a href="/siparis-takip">Sipariş Takibi</a></li>
            <li><a href="/hesabim">Hesabım</a></li>
            <li><a href="/iade-kosullari.html">İptal ve İade Koşulları</a></li>
            <li><a href="#" data-open-chat>Canlı Destek</a></li>
          </ul>
        </div>

        <div class="footer-section">
          <h4>Yasal</h4>
          <ul>
            <li><a href="/kvkk.html">KVKK Aydınlatma Metni</a></li>
            <li><a href="/on-bilgilendirme.html">Ön Bilgilendirme Formu</a></li>
            <li><a href="/sozlesme.html">Mesafeli Satış Sözleşmesi</a></li>
            <li><a href="/kvkk.html#cerez">Çerez Politikası</a></li>
          </ul>
        </div>

        <div class="footer-section">
          <h4>Takip Edin</h4>
          <div class="social-links">
            <a href="${e(SITE.instagram)}" target="_blank" rel="noopener" class="social-icon">Instagram</a>
          </div>
          <div class="payment-methods" aria-label="Kabul edilen ödeme yöntemleri">
            <span class="pay-icon">VISA</span><span class="pay-icon">Mastercard</span><span class="pay-icon">TROY</span>
            <span class="pay-icon">iyzico ile güvenli ödeme</span>
          </div>
        </div>
      </div>

      <div class="footer-bottom container">
        <p>&copy; ${new Date().getFullYear()} ${e(SITE.name)}. Tüm hakları saklıdır.</p>
      </div>
    </footer>`;
}
