export function Hero() {
  return `
    <section class="hero-section">
      <div class="hero-bg">
        <!-- Placeholder for video or high-res image -->
        <div class="water-effect"></div>
      </div>
      
      <div class="container hero-content">
        <h1 class="hero-title">
          <span class="block fade-in-up">Macera</span>
          <span class="block fade-in-up delay-1">Sizde,</span>
          <span class="block highlight text-glow fade-in-up delay-2">Ekipman Bizde</span>
        </h1>
        
        <p class="hero-slogan fade-in-up delay-3">
          Okyanusun derinliklerini keşfetmek için ihtiyacınız olan her şey.
        </p>
        
        <div class="hero-actions fade-in-up delay-4">
          <a href="/urunler.html" class="primary-btn pulse-glow" id="view-all-products">
            Ürünleri Gör
            <span class="arrow">→</span>
          </a>
          <a href="#shop" class="secondary-btn">
            Koleksiyon
            <span class="play-icon">▶</span>
          </a>
        </div>
      </div>
      
      <!-- Scroll Indicator -->
      <div class="scroll-indicator">
        <div class="mouse">
          <div class="wheel"></div>
        </div>
      </div>
    </section>
  `;
}
