import { api } from '../utils/api.js';
import { Auth } from '../utils/auth.js';
import { toast } from '../utils/toast.js';
import { formatPriceTR } from '../utils/formatPrice.js';
import { escapeHTML as e } from '../utils/sanitize.js';

export const STATUS_TR = {
  pending_payment: 'Ödeme bekleniyor', paid: 'Ödeme alındı', preparing: 'Hazırlanıyor', shipped: 'Kargoya verildi',
  delivered: 'Teslim edildi', cancelled: 'İptal edildi', payment_failed: 'Ödeme başarısız',
  refund_requested: 'İade talebi alındı', refunded: 'İade edildi', pending: 'Ödeme bekleniyor', failed: 'Ödeme başarısız'
};
const STEPS = ['paid', 'preparing', 'shipped', 'delivered'];
const dateTR = (d) => (d ? new Date(d).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export function OrderCard(o, { full = false } = {}) {
  const stepIdx = STEPS.indexOf(o.status);
  return `
    <article class="order-card glass-panel">
      <header class="order-head">
        <div><b>${e(o.orderNumber)}</b><small>${dateTR(o.createdAt)}</small></div>
        <span class="status-badge status-${e(o.status)}">${e(STATUS_TR[o.status] || o.status)}</span>
      </header>
      ${stepIdx >= 0 ? `<ol class="order-steps">${STEPS.map((s, i) => `<li class="${i <= stepIdx ? 'done' : ''}">${STATUS_TR[s]}</li>`).join('')}</ol>` : ''}
      ${o.shipment?.trackingNumber ? `<p class="tracking">🚚 ${e(o.shipment.carrier || 'Kargo')} · Takip no: <b>${e(o.shipment.trackingNumber)}</b>
        ${o.shipment.trackingUrl ? ` · <a href="${e(o.shipment.trackingUrl)}" target="_blank" rel="noopener">Kargoyu takip et</a>` : ''}</p>` : ''}
      ${o.bank ? `<div class="bank-box"><b>Havale/EFT bilgileri</b><br>Banka: ${e(o.bank.name)}<br>Alıcı: ${e(o.bank.accountHolder)}<br>
        IBAN: <b class="iban">${e(o.bank.iban)}</b> <button type="button" class="link-btn" data-copy="${e(o.bank.iban)}">Kopyala</button><br>
        Açıklama: <b>${e(o.orderNumber)}</b><br><small>Son ödeme: ${dateTR(o.reservationExpiresAt)} — sonrasında sipariş otomatik iptal edilir.</small></div>` : ''}
      ${full ? `<ul class="mini-lines">${o.items.map(i => `<li><span>${e(i.name)}${i.selectedVariant ? ` (${e(i.selectedVariant)})` : ''} × ${i.quantity}</span><span>${formatPriceTR(i.lineTotal)}</span></li>`).join('')}</ul>
        <div class="summary-row"><span>Kargo</span><span>${o.shippingFee ? formatPriceTR(o.shippingFee) : 'Ücretsiz'}</span></div>` : `<p>${o.items.length} ürün</p>`}
      <div class="summary-total"><span>Toplam</span><span>${formatPriceTR(o.totalAmount)}</span></div>
      <footer class="order-actions">
        ${!full ? `<a href="/siparis-takip?no=${encodeURIComponent(o.orderNumber)}" class="btn secondary-btn small">Detay</a>` : ''}
        ${['paid', 'preparing', 'shipped', 'delivered'].includes(o.status) ? `<button type="button" class="btn secondary-btn small" data-open-chat data-chat-action="return_request" data-order="${e(o.orderNumber)}">İade / Değişim</button>` : ''}
        ${o.status === 'pending_payment' ? `<button type="button" class="btn secondary-btn small" data-cancel-order="${e(o.orderNumber)}">Siparişi iptal et</button>` : ''}
      </footer>
    </article>`;
}

/* ---------- Ödeme sonucu ---------- */
export function OrderResultPage() {
  return `<div class="container page-pad" id="order-result"><p class="loading">Sipariş bilgisi yükleniyor…</p></div>`;
}

export async function mountOrderResult(root) {
  const params = new URLSearchParams(location.search);
  const no = params.get('no');
  const box = root.querySelector('#order-result');
  if (!no) { box.innerHTML = '<p>Sipariş bulunamadı.</p>'; return; }
  try {
    const o = await api.get(`/orders/${encodeURIComponent(no)}`);
    const ok = ['paid', 'preparing', 'shipped', 'delivered'].includes(o.status);
    const waitingBank = o.status === 'pending_payment' && o.paymentMethod === 'bank_transfer';
    const failed = params.get('status') === 'failed' || o.status === 'payment_failed';
    box.innerHTML = `
      <div class="result-hero glass-panel ${ok || waitingBank ? 'success' : 'error'}">
        <div class="icon-circle" aria-hidden="true">${ok ? '✓' : waitingBank ? '⏳' : '✕'}</div>
        <h1>${ok ? 'Siparişiniz alındı!' : waitingBank ? 'Siparişiniz oluşturuldu' : 'Ödeme tamamlanamadı'}</h1>
        <p>${ok ? `Onay e-postası ${e(o.customer?.email || '')} adresine gönderildi.`
        : waitingBank ? 'Ödemeniz ulaştığında siparişiniz hazırlanmaya başlayacak.'
          : e(params.get('message') || 'Kartınızdan çekim yapılmadı. Tekrar deneyebilirsiniz.')}</p>
        ${failed ? '<a href="/sepet" class="btn primary-btn">Sepete dön</a>' : ''}
      </div>
      ${OrderCard(o, { full: true })}`;
  } catch (err) {
    box.innerHTML = `<div class="glass-panel result-hero error"><h1>Sipariş bulunamadı</h1><p>${e(err.message)}</p><a href="/siparis-takip" class="btn secondary-btn">Sipariş takibi</a></div>`;
  }
}

/* ---------- Misafir sipariş takibi ---------- */
export function OrderTrackPage() {
  const no = new URLSearchParams(location.search).get('no') || '';
  return `
    <div class="container page-pad narrow">
      <h1>Sipariş Takibi</h1>
      <form id="track-form" class="glass-panel form-card">
        <label class="field"><span>Sipariş numarası</span><input name="no" required value="${e(no)}" placeholder="AQ-250101-ABCDE" autocomplete="off"></label>
        <label class="field"><span>E-posta</span><input name="email" type="email" required autocomplete="email"></label>
        <button class="btn primary-btn" type="submit">Sorgula</button>
        <p class="small-hint">Üyeyseniz tüm siparişlerinizi <a href="/hesabim">Hesabım</a> sayfasında görebilirsiniz.</p>
      </form>
      <div id="track-result"></div>
    </div>`;
}

export async function mountOrderTrack(root) {
  const form = root.querySelector('#track-form');
  const out = root.querySelector('#track-result');
  const lookup = async (no, email) => {
    out.innerHTML = '<p class="loading">Sorgulanıyor…</p>';
    try {
      const o = await api.get(`/orders/${encodeURIComponent(no.trim().toUpperCase())}${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`);
      out.innerHTML = OrderCard(o, { full: true });
    } catch (err) {
      out.innerHTML = email ? `<p class="text-danger">${e(err.message)}</p>` : '';
    }
  };
  form.addEventListener('submit', (ev) => { ev.preventDefault(); lookup(form.no.value, form.email.value); });
  // Bu oturumda oluşturulan / sahibi olunan sipariş e-posta sormadan gösterilir
  if (form.no.value) lookup(form.no.value, '');
}

/* ---------- Hesabım ---------- */
export function AccountPage() {
  const u = Auth.user;
  if (!u) {
    return `<div class="container page-pad narrow"><div class="glass-panel form-card">
      <h1>Hesabım</h1><p>Siparişlerinizi görmek için giriş yapın.</p>
      <button class="btn primary-btn" data-auth="login">Giriş Yap</button>
      <p class="small-hint">Üye olmadan sipariş verdiyseniz <a href="/siparis-takip">sipariş takibi</a> sayfasını kullanın.</p></div></div>`;
  }
  return `
    <div class="container page-pad account-page">
      <h1>Merhaba, ${e(u.name || '')}</h1>
      <div class="account-layout">
        <section>
          <h2>Siparişlerim</h2>
          <div id="my-orders"><p class="loading">Yükleniyor…</p></div>
        </section>
        <aside class="glass-panel form-card">
          <h2>Bilgilerim</h2>
          <form id="profile-form">
            <label class="field"><span>Ad Soyad</span><input name="name" value="${e(u.name || '')}" maxlength="80"></label>
            <label class="field"><span>E-posta</span><input value="${e(u.email)}" disabled></label>
            <label class="field"><span>Cep telefonu</span><input name="phone" type="tel" value="${e(u.phone || '')}" placeholder="5XX XXX XX XX"></label>
            <label class="check"><input type="checkbox" name="marketing" ${u.marketingConsent ? 'checked' : ''}> Kampanya e-postaları/SMS almak istiyorum</label>
            <button class="btn secondary-btn small" type="submit">Kaydet</button>
          </form>
          <hr>
          <form id="password-form">
            <h3>Şifre değiştir</h3>
            <label class="field"><span>Mevcut şifre</span><input name="currentPassword" type="password" autocomplete="current-password" required></label>
            <label class="field"><span>Yeni şifre</span><input name="newPassword" type="password" autocomplete="new-password" minlength="8" required></label>
            <button class="btn secondary-btn small" type="submit">Şifreyi güncelle</button>
          </form>
          <hr>
          <button class="btn secondary-btn small logout-btn">Çıkış Yap</button>
        </aside>
      </div>
    </div>`;
}

export async function mountAccount(root) {
  const list = root.querySelector('#my-orders');
  if (!list) return;
  try {
    const orders = await api.get('/orders');
    list.innerHTML = orders.length ? orders.map(o => OrderCard(o)).join('') : '<p>Henüz siparişiniz yok. <a href="/urunler">Alışverişe başlayın</a></p>';
  } catch (err) {
    list.innerHTML = `<p class="text-danger">${e(err.message)}</p>`;
  }
  root.querySelector('#profile-form')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    try {
      await Auth.updateAccount({ name: f.name.value, phone: f.phone.value, marketing: f.marketing.checked });
      toast('Bilgileriniz kaydedildi', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
  root.querySelector('#password-form')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    try {
      await api.put('/account/password', { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value });
      f.reset();
      toast('Şifreniz güncellendi', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* ---------- Şifre sıfırlama ---------- */
export function ResetPasswordPage() {
  return `
    <div class="container page-pad narrow">
      <form id="reset-form" class="glass-panel form-card">
        <h1>Yeni şifre belirleyin</h1>
        <label class="field"><span>Yeni şifre</span><input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
        <label class="field"><span>Yeni şifre (tekrar)</span><input name="password2" type="password" minlength="8" required autocomplete="new-password"></label>
        <div class="error-msg text-danger" role="alert"></div>
        <button class="btn primary-btn" type="submit">Şifreyi kaydet</button>
      </form>
    </div>`;
}

export function mountResetPassword(root, navigate) {
  const form = root.querySelector('#reset-form');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = form.querySelector('.error-msg');
    if (form.password.value !== form.password2.value) { err.textContent = 'Şifreler eşleşmiyor'; return; }
    try {
      await Auth.resetPassword(new URLSearchParams(location.search).get('token') || '', form.password.value);
      toast('Şifreniz güncellendi, giriş yapıldı', 'success');
      navigate('/hesabim');
    } catch (e2) { err.textContent = e2.message; }
  });
}
