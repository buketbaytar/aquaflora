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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                Instagram
             </a>
             <a href="#" class="social-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
                YouTube
             </a>
             <a href="#" class="social-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
                TikTok
             </a>
             <a href="#" class="social-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                Facebook
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
           
           <div class="payment-methods" style="margin-top: 2rem; display: flex; gap: 10px;">
             <!-- Payment Icons (Simple Representations) -->
             <div class="pay-icon" title="Visa" style="border: 1px solid #ddd; padding: 2px 5px; border-radius: 4px; background: #fff; color: #1a1f71; font-weight: bold; font-size: 0.8rem;">VISA</div>
             <div class="pay-icon" title="Mastercard" style="border: 1px solid #ddd; padding: 2px 5px; border-radius: 4px; background: #fff; color: #eb001b; font-weight: bold; font-size: 0.8rem;">Mastercard</div>
             <div class="pay-icon" title="Troy" style="border: 1px solid #ddd; padding: 2px 5px; border-radius: 4px; background: #fff; color: #00afda; font-weight: bold; font-size: 0.8rem;">TROY</div>
           </div>
        </div>
      </div>
      
      <div class="footer-bottom container">
        <p>&copy; 2026 DeepDive Sports. Tüm hakları saklıdır.</p>
      </div>
    </footer>
  `;
}
