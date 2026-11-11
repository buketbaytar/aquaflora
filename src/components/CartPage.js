import { Cart } from '../utils/cart.js';
import { runtime } from '../config.js';
import { formatPriceTR } from '../utils/formatPrice.js';
import { escapeHTML as e } from '../utils/sanitize.js';
import { img } from '../utils/img.js';

export function shippingFor(subtotal) {
  const { flatFee, freeThreshold } = runtime.shipping;
  if (!flatFee) return 0;
  if (freeThreshold && subtotal >= freeThreshold) return 0;
  return flatFee;
}

export function OrderSummary(subtotal, { extra = '' } = {}) {
  const ship = shippingFor(subtotal);
  const { freeThreshold, flatFee } = runtime.shipping;
  const remaining = flatFee && freeThreshold ? freeThreshold - subtotal : 0;
  return `
    <div class="summary-row"><span>Ara toplam</span><span>${formatPriceTR(subtotal)}</span></div>
    <div class="summary-row"><span>Kargo</span><span>${ship ? formatPriceTR(ship) : 'Ücretsiz'}</span></div>
    ${remaining > 0 ? `<div class="free-ship-hint">🚚 ${formatPriceTR(remaining)} daha ekleyin, kargo ücretsiz olsun!
       <div class="progress"><span style="width:${Math.min(100, (subtotal / freeThreshold) * 100)}%"></span></div></div>` : ''}
    ${extra}
    <div class="summary-total"><span>Toplam <small>(KDV dahil)</small></span><span>${formatPriceTR(subtotal + ship)}</span></div>`;
}

export function CartPage() {
  if (!Cart.loaded) return '<div class="container page-pad"><p class="loading">Sepet yükleniyor…</p></div>';
  const items = Cart.items;
  if (!items.length) {
    return `
      <div class="container page-pad">
        <div class="cart-empty-state glass-panel">
          <h1>Sepetiniz boş</h1>
          <p>Henüz sepetinize ürün eklemediniz.</p>
          <a href="/urunler" class="btn primary-btn">Alışverişe Başla</a>
        </div>
      </div>`;
  }
  const problems = Cart.hasProblems();

  return `
    <div class="cart-page container page-pad">
      <h1>Alışveriş Sepeti <small>(${Cart.count()} ürün)</small></h1>
      <div class="cart-layout">
        <div class="cart-items glass-panel">
          ${items.map(i => `
            <div class="cart-item ${i.problem ? 'has-problem' : ''}" data-pid="${e(i.productId)}" data-variant="${e(i.selectedVariant || '')}">
              ${i.image ? `<img src="${e(img(i.image, 200))}" alt="" class="cart-item-img" loading="lazy" width="96" height="96">` : '<div class="cart-item-img"></div>'}
              <div class="cart-item-details">
                <h3>${e(i.name)}</h3>
                ${i.selectedVariant ? `<p class="variant">Beden: ${e(i.selectedVariant)}</p>` : ''}
                <p class="price">${formatPriceTR(i.price)}</p>
                ${i.problem === 'out_of_stock' ? '<p class="text-danger">Bu ürün tükendi, lütfen sepetten çıkarın.</p>' : ''}
                ${i.problem === 'insufficient_stock' ? `<p class="text-danger">Stokta ${i.available} adet kaldı, adedi güncelleyin.</p>` : ''}
              </div>
              <div class="qty-control" aria-label="Adet">
                <button type="button" data-cart-qty="-1" aria-label="Azalt">−</button>
                <span class="qty">${i.quantity}</span>
                <button type="button" data-cart-qty="1" aria-label="Arttır" ${i.quantity >= i.available ? 'disabled' : ''}>+</button>
              </div>
              <div class="line-total">${formatPriceTR(i.price * i.quantity)}</div>
              <button class="remove-btn" data-cart-remove aria-label="${e(i.name)} ürününü sepetten çıkar">🗑️</button>
            </div>`).join('')}
        </div>

        <aside class="cart-summary glass-panel">
          <h2>Sipariş Özeti</h2>
          ${OrderSummary(Cart.subtotal())}
          ${problems ? '<p class="text-danger small">Devam etmek için stok uyarısı olan ürünleri düzenleyin.</p>' : ''}
          <a href="/odeme" class="btn checkout-btn ${problems ? 'disabled' : ''}" ${problems ? 'aria-disabled="true" tabindex="-1"' : ''}>Ödemeye Geç</a>
          <p class="small-hint">Üye olmadan da sipariş verebilirsiniz.</p>
        </aside>
      </div>
    </div>`;
}
