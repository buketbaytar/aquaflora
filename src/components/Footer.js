export function Footer() {
  return `
    <footer class="site-footer">
      <div class="container footer-grid">
        <!-- Brand & Geo -->
        <div class="footer-col">
          <div class="footer-logo">
            <span class="logo-icon">🌊</span>
            <span class="logo-text">AQUA<span class="highlight">FLORA</span></span>
          </div>
          <p class="footer-desc">
            Sualtı tutkunları için teknoloji ve performansı birleştiren yeni nesil ekipmanlar.
          </p>
          <div class="geo-info">
             <div class="geo-item">
               <span>📍</span>
               <span>DeepDive Flagship Store<br>Alsancak, İzmir, TR</span>
             </div>
             <div class="geo-item">
               <span>📞</span>
               <span>0850 123 45 67</span>
             </div>
          </div>
        </div>

        <!-- Sitemap -->
        <div class="footer-col">
          <h4>Kategoriler</h4>
          <ul>
            <li><a href="#category-scuba">Tüplü Dalış</a></li>
            <li><a href="#category-freedive">Serbest Dalış</a></li>
            <li><a href="#category-swim">Yüzme</a></li>
            <li><a href="#category-outdoor">Kamp & Outdoor</a></li>
          </ul>
        </div>

        <!-- Corporate -->
        <div class="footer-col">
          <h4>Kurumsal</h4>
          <ul>
            <li><a href="#">Hakkımızda</a></li>
            <li><a href="#">Mağazalarımız</a></li>
            <li><a href="#">Kariyer</a></li>
            <li><a href="#">İletişim</a></li>
          </ul>
        </div>

        <!-- Social & Newsletter -->
        <div class="footer-col">
           <h4>Takip Edin</h4>
           <div class="social-links">
             <a href="#" class="social-icon">Instagram</a>
             <a href="#" class="social-icon">YouTube</a>
             <a href="#" class="social-icon">TikTok</a>
           </div>
           
           <div class="newsletter">
             <input type="email" placeholder="E-bülten'e abone olun">
             <button>→</button>
           </div>
        </div>
      </div>
      
      <div class="footer-bottom container">
        <p>&copy; 2026 DeepDive Sports. Tüm hakları saklıdır.</p>
        <div class="payment-icons">
          <span>Visa</span><span>Mastercard</span><span>Troy</span>
        </div>
      </div>
    </footer>
  `;
}
