export function Hero() {
  return `
    <section class="hero-section">
      <div class="hero-bg"><div class="water-effect"></div></div>
      <div class="container hero-content">
        <h1 class="hero-title">
          <span class="block fade-in-up">Macera</span>
          <span class="block fade-in-up delay-1">Sizde,</span>
          <span class="block highlight text-glow fade-in-up delay-2">Ekipman Bizde</span>
        </h1>
        <p class="hero-slogan fade-in-up delay-3">Okyanusun derinliklerini keşfetmek için ihtiyacınız olan her şey.</p>
        <div class="hero-actions fade-in-up delay-4">
          <a href="/urunler" class="primary-btn pulse-glow">Ürünleri Gör <span class="arrow" aria-hidden="true">→</span></a>
          <button type="button" class="secondary-btn" data-open-chat data-chat-action="recommend">Bana ürün öner <span aria-hidden="true">✨</span></button>
        </div>
      </div>
    </section>`;
}
