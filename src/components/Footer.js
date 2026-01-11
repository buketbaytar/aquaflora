export function Footer() {
  return `
    <footer class="site-footer">
      <div class="container footer-grid">
        <!-- Brand & Geo -->
        <div class="footer-section company-info">
          <div class="footer-logo">
            <span class="logo-icon">🌊</span>
            <span class="logo-text">AQUA<span class="highlight">FLORA</span></span>
          </div>
          <p class="footer-desc">
            Sualtı tutkunları için teknolojiyi ve performansı birleştiren yeni nesil ekipmanlar.
          </p>
          <div class="geo-info">
             <div class="geo-item">
               <span>📍</span>
               <span>DeepDive Flagship Store<br>Mersin, Türkiye</span>
             </div>
             <div class="geo-item">
               <span>📞</span>
               <span>0850 123 45 67</span>
             </div>
          </div>
        </div>

        <!-- Categories -->
        <div class="footer-section">
          <h4>Kategoriler</h4>
          <ul>
            <li><a href="/urunler.html?subCategory=tuplu-dalis">Tüplü Dalış</a></li>
            <li><a href="/urunler.html?subCategory=serbest-dalis">Serbest Dalış</a></li>
            <li><a href="/urunler.html?subCategory=yuzme">Yüzme</a></li>
            <li><a href="/urunler.html?category=kamp-and-outdoor">Kamp & Outdoor</a></li>
          </ul>
        </div>

        <!-- Corporate -->
        <div class="footer-section">
          <h4>Kurumsal</h4>
          <ul>
            <li><a href="#">Hakkımızda</a></li>
            <li><a href="#">Mağazalarımız</a></li>
            <li><a href="#">Kariyer</a></li>
            <li><a href="#">İletişim</a></li>
          </ul>
          
          <h4 style="margin-top: 1.5rem">Yasal</h4>
           <ul>
            <li><a href="#">KVKK Aydınlatma Metni</a></li>
            <li><a href="#">Gizlilik Politikası</a></li>
            <li><a href="#">Mesafeli Satış Sözleşmesi</a></li>
            <li><a href="#">İade & İptal Politikası</a></li>
          </ul>
        </div>

        <!-- Social -->
        <div class="footer-section">
           <h4>Takip Edin</h4>
           <div class="social-links">
             <a href="https://www.instagram.com/aquaaflora?igsh=MXB3ejRhdXh1NDY3Ng==" target="_blank" class="social-icon">
                <span>📷</span> Instagram
             </a>
             <a href="#" class="social-icon">
                <span>▶️</span> YouTube
             </a>
             <a href="#" class="social-icon">
                <span>🎵</span> TikTok
             </a>
             <a href="#" class="social-icon">
                <span>👍</span> Facebook
             </a>
           </div>
        </div>
        
        <!-- Newsletter -->
        <div class="footer-section">
           <h4>E-Bülten</h4>
           <div class="newsletter">
             <input type="email" placeholder="E-posta adresiniz">
             <button>Abone Ol</button>
           </div>
           
           <div class="payment-methods" style="margin-top: 2rem">
             <span class="pay-icon" style="opacity: 0.8; font-size: 1.5rem; margin-right: 10px;">💳 Visa</span>
             <span class="pay-icon" style="opacity: 0.8; font-size: 1.5rem; margin-right: 10px;">💳 MC</span>
             <span class="pay-icon" style="opacity: 0.8; font-size: 1.5rem;">💳 Troy</span>
           </div>
        </div>
      </div>
      
      <div class="footer-bottom container">
        <p>&copy; 2026 DeepDive Sports. Tüm hakları saklıdır.</p>
      </div>
    </footer>
  `;
}
