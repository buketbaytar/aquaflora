import { Cart } from '../utils/cart.js';
import { Auth } from '../utils/auth.js';
import { api } from '../utils/api.js';
import { runtime } from '../config.js';
import { toast } from '../utils/toast.js';
import { formatPriceTR } from '../utils/formatPrice.js';
import { escapeHTML as e } from '../utils/sanitize.js';
import { OrderSummary } from './CartPage.js';

const CITIES = ['Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Siirt', 'Sinop', 'Şırnak', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'];

const field = (name, label, { type = 'text', value = '', attrs = '', full = false } = {}) => `
  <label class="field ${full ? 'full' : ''}" data-field="${name}">
    <span>${label}</span>
    <input type="${type}" name="${name}" value="${e(value)}" ${attrs}>
    <small class="field-error" role="alert"></small>
  </label>`;

export function CheckoutPage() {
  if (!Cart.loaded) return '<div class="container page-pad"><p class="loading">Yükleniyor…</p></div>';
  if (!Cart.items.length) {
    return `<div class="container page-pad"><div class="cart-empty-state glass-panel"><h1>Sepetiniz boş</h1><a href="/urunler" class="btn primary-btn">Alışverişe Başla</a></div></div>`;
  }
  const u = Auth.user || {};
  const methods = runtime.storeMode === 'preview' ? [] : (runtime.paymentMethods || []);
  if (runtime.storeMode === 'preview') {
    return `<div class="container page-pad narrow"><div class="glass-panel result-hero">
      <div class="icon-circle" aria-hidden="true">🌊</div><h1>Çok yakında satıştayız!</h1>
      <p>Mağazamız şu anda hazırlık aşamasında; sipariş henüz alınmıyor. Sepetiniz saklanır, satış açıldığında kaldığınız yerden devam edebilirsiniz.</p>
      <a href="/urunler" class="btn primary-btn">Ürünleri incelemeye devam et</a></div></div>`;
  }

  return `
    <div class="checkout-page container page-pad">
      <h1>Ödeme</h1>
      ${!Auth.user ? `<p class="guest-hint glass-panel">Üye misiniz? <button type="button" class="link-btn" data-auth="login">Giriş yapın</button> — veya üye olmadan devam edin.</p>` : ''}
      <form id="checkout-form" class="checkout-layout" novalidate>
        <div class="checkout-main">
          <section class="glass-panel checkout-section">
            <h2>1. İletişim bilgileri</h2>
            <div class="grid-2">
              ${field('customer.name', 'Ad Soyad *', { value: u.name || '', attrs: 'autocomplete="name" required maxlength="100"' })}
              ${field('customer.email', 'E-posta *', { type: 'email', value: u.email || '', attrs: 'autocomplete="email" required' })}
              ${field('customer.phone', 'Cep telefonu *', { type: 'tel', value: u.phone || '', attrs: 'autocomplete="tel" required placeholder="5XX XXX XX XX" inputmode="tel"' })}
            </div>
          </section>

          <section class="glass-panel checkout-section">
            <h2>2. Teslimat adresi</h2>
            <div class="grid-2">
              <label class="field" data-field="shippingAddress.city"><span>İl *</span>
                <select name="shippingAddress.city" required autocomplete="address-level1">
                  <option value="">Seçiniz</option>${CITIES.map(c => `<option>${c}</option>`).join('')}
                </select><small class="field-error" role="alert"></small></label>
              ${field('shippingAddress.district', 'İlçe *', { attrs: 'required autocomplete="address-level2" maxlength="50"' })}
              ${field('shippingAddress.addressLine', 'Açık adres *', { full: true, attrs: 'required autocomplete="street-address" maxlength="300" placeholder="Mahalle, sokak, bina no, daire"' })}
              ${field('shippingAddress.zipCode', 'Posta kodu', { attrs: 'autocomplete="postal-code" inputmode="numeric" maxlength="5"' })}
            </div>
          </section>

          <section class="glass-panel checkout-section">
            <h2>3. Fatura bilgileri</h2>
            <div class="radio-row">
              <label><input type="radio" name="billing.type" value="individual" checked> Bireysel</label>
              <label><input type="radio" name="billing.type" value="corporate"> Kurumsal</label>
            </div>
            <div class="grid-2">
              ${field('billing.identityNumber', 'T.C. kimlik no (isteğe bağlı)', { attrs: 'inputmode="numeric" maxlength="11"' })}
            </div>
            <div class="grid-2 corporate-fields" hidden>
              ${field('billing.companyName', 'Firma ünvanı *', { full: true, attrs: 'maxlength="150"' })}
              ${field('billing.taxOffice', 'Vergi dairesi *', { attrs: 'maxlength="80"' })}
              ${field('billing.taxNumber', 'Vergi no *', { attrs: 'inputmode="numeric" maxlength="10"' })}
            </div>
            <label class="check"><input type="checkbox" name="billing.sameAsShipping" checked> Fatura adresi teslimat adresiyle aynı</label>
            <div class="grid-2 billing-address" hidden>
              ${field('billing.address.fullName', 'Fatura adı', {})}
              <label class="field"><span>İl</span><select name="billing.address.city"><option value="">Seçiniz</option>${CITIES.map(c => `<option>${c}</option>`).join('')}</select></label>
              ${field('billing.address.district', 'İlçe', {})}
              ${field('billing.address.addressLine', 'Fatura adresi', { full: true })}
            </div>
          </section>

          <section class="glass-panel checkout-section">
            <h2>4. Ödeme yöntemi</h2>
            <div class="pay-methods" data-field="paymentMethod">
              ${methods.includes('card') ? `<label class="pay-option"><input type="radio" name="paymentMethod" value="card" ${methods[0] === 'card' ? 'checked' : ''}>
                <span><b>Kredi / Banka Kartı</b><small>iyzico güvenli ödeme sayfasına yönlendirilirsiniz · 3D Secure · Taksit imkânı</small></span></label>` : ''}
              ${methods.includes('bank_transfer') ? `<label class="pay-option"><input type="radio" name="paymentMethod" value="bank_transfer" ${methods[0] === 'bank_transfer' ? 'checked' : ''}>
                <span><b>Havale / EFT</b><small>Sipariş sonrası IBAN bilgisi gösterilir ve e-posta ile gönderilir</small></span></label>` : ''}
              ${!methods.length ? '<p class="text-danger">Şu anda ödeme alınamıyor. Lütfen daha sonra tekrar deneyin.</p>' : ''}
              <small class="field-error" role="alert"></small>
            </div>
            <label class="field full"><span>Sipariş notu (isteğe bağlı)</span><textarea name="note" maxlength="500" rows="2"></textarea></label>
          </section>
        </div>

        <aside class="cart-summary glass-panel checkout-summary">
          <h2>Sipariş Özeti</h2>
          <ul class="mini-lines">
            ${Cart.items.map(i => `<li><span>${e(i.name)}${i.selectedVariant ? ` (${e(i.selectedVariant)})` : ''} × ${i.quantity}</span><span>${formatPriceTR(i.price * i.quantity)}</span></li>`).join('')}
          </ul>
          ${OrderSummary(Cart.subtotal())}

          <div class="consents">
            <label class="check" data-field="consents.preInfo"><input type="checkbox" name="consents.preInfo">
              <span><a href="/on-bilgilendirme.html" target="_blank" rel="noopener">Ön Bilgilendirme Formu</a>'nu okudum ve onaylıyorum. *</span></label>
            <label class="check" data-field="consents.distanceSales"><input type="checkbox" name="consents.distanceSales">
              <span><a href="/sozlesme.html" target="_blank" rel="noopener">Mesafeli Satış Sözleşmesi</a>'ni okudum ve onaylıyorum. *</span></label>
            <label class="check" data-field="consents.kvkk"><input type="checkbox" name="consents.kvkk">
              <span>Kişisel verilerimin <a href="/kvkk.html" target="_blank" rel="noopener">KVKK Aydınlatma Metni</a> kapsamında işlenmesine ilişkin bilgilendirildim. *</span></label>
            <label class="check"><input type="checkbox" name="consents.marketing">
              <span>Kampanyalardan e-posta/SMS ile haberdar olmak istiyorum. (İsteğe bağlı)</span></label>
          </div>
          <div class="form-error text-danger" role="alert"></div>
          <button type="submit" class="btn checkout-btn" ${!methods.length ? 'disabled' : ''}>Siparişi Onayla ve Öde</button>
          <p class="small-hint">🔒 Kart bilgileriniz sitemizde saklanmaz.</p>
        </aside>
      </form>
    </div>`;
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  keys.slice(0, -1).forEach(k => { o = o[k] ||= {}; });
  o[keys.at(-1)] = value;
}

export function mountCheckout(root, navigate) {
  const form = root.querySelector('#checkout-form');
  if (!form) return;

  const corp = form.querySelector('.corporate-fields');
  const billAddr = form.querySelector('.billing-address');
  form.addEventListener('change', (ev) => {
    if (ev.target.name === 'billing.type') corp.hidden = ev.target.value !== 'corporate';
    if (ev.target.name === 'billing.sameAsShipping') billAddr.hidden = ev.target.checked;
    const f = ev.target.closest('[data-field]');
    if (f) { f.classList.remove('invalid'); const er = f.querySelector('.field-error'); if (er) er.textContent = ''; }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const errBox = form.querySelector('.form-error');
    form.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));
    form.querySelectorAll('.field-error').forEach(x => { x.textContent = ''; });
    errBox.textContent = '';

    const body = { items: Cart.items.map(i => ({ productId: i.productId, selectedVariant: i.selectedVariant, quantity: i.quantity })) };
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') setPath(body, el.name, el.checked);
      else if (el.type === 'radio') { if (el.checked) setPath(body, el.name, el.value); }
      else setPath(body, el.name, el.value.trim());
    }

    btn.disabled = true;
    btn.textContent = 'İşleniyor…';
    try {
      const res = await api.post('/orders', body);
      Cart.clear();
      if (res.next === 'redirect' && res.redirectUrl) {
        btn.textContent = 'Ödeme sayfasına yönlendiriliyorsunuz…';
        if (res.redirectUrl.startsWith('/')) navigate(res.redirectUrl);
        else window.location.assign(res.redirectUrl);
        return;
      }
      navigate(`/odeme-sonuc?no=${encodeURIComponent(res.orderNumber)}`);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Siparişi Onayla ve Öde';
      if (err.details) {
        let first = null;
        for (const [k, msg] of Object.entries(err.details)) {
          const f = form.querySelector(`[data-field="${k}"]`);
          if (f) {
            f.classList.add('invalid');
            const er = f.querySelector('.field-error');
            if (er) er.textContent = msg;
            first ||= f;
          }
        }
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      errBox.textContent = err.message;
      if (err.status === 409) { toast(err.message, 'error'); Cart.load(); }
    }
  });
}
