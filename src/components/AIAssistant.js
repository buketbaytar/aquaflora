import { api } from '../utils/api.js';
import { Cart } from '../utils/cart.js';
import { SITE } from '../config.js';
import { formatPriceTR } from '../utils/formatPrice.js';
import { escapeHTML as e } from '../utils/sanitize.js';
import { productUrl } from './ProductCard.js';

/**
 * Müşteri asistanı arayüzü.
 * - Konuşma geçmişi sunucuda (MongoDB) saklanır; sayfa yenilense, sekme değişse de kaybolmaz.
 * - Hızlı aksiyonlar, ürün kartları (sepete ekle), link butonları.
 * - Bir kez DOM'a eklenir; sayfa geçişlerinde yeniden çizilmez.
 */
export function ChatWidget() {
  return `
    <div class="cw" id="chat-widget">
      <section class="cw-window" id="cw-window" role="dialog" aria-label="${e(SITE.name)} müşteri asistanı" hidden>
        <header class="cw-header">
          <div><b>${e(SITE.name)} Asistan</b><small class="cw-status">Genellikle anında yanıt verir</small></div>
          <div class="cw-head-actions">
            <button type="button" class="cw-icon" data-cw="reset" title="Yeni konuşma" aria-label="Yeni konuşma">↺</button>
            <button type="button" class="cw-icon" data-cw="close" aria-label="Kapat">×</button>
          </div>
        </header>
        <div class="cw-messages" id="cw-messages" aria-live="polite"></div>
        <div class="cw-quick" id="cw-quick"></div>
        <form class="cw-input" id="cw-form" autocomplete="off">
          <input type="text" id="cw-text" maxlength="500" placeholder="Mesajınızı yazın…" aria-label="Mesajınız">
          <button type="submit" aria-label="Gönder">➤</button>
        </form>
      </section>
      <button type="button" class="cw-toggle pulse-glow" id="cw-toggle" aria-controls="cw-window" aria-expanded="false" aria-label="Müşteri asistanını aç">
        <span aria-hidden="true">💬</span><span class="cw-dot" hidden></span>
      </button>
    </div>`;
}

export function setupChatWidget({ navigate, openAuth }) {
  const win = document.getElementById('cw-window');
  const toggle = document.getElementById('cw-toggle');
  const list = document.getElementById('cw-messages');
  const quick = document.getElementById('cw-quick');
  const form = document.getElementById('cw-form');
  const input = document.getElementById('cw-text');
  let loaded = false;
  let busy = false;
  const productCache = new Map();

  const scroll = () => { list.scrollTop = list.scrollHeight; };

  function renderMessage(m) {
    const el = document.createElement('div');
    el.className = `cw-msg cw-${m.role === 'user' ? 'user' : 'bot'}`;
    const text = document.createElement('div');
    text.className = 'cw-bubble';
    text.textContent = m.text || ''; // XSS güvenli
    el.appendChild(text);

    if (m.products?.length) {
      const wrap = document.createElement('div');
      wrap.className = 'cw-products';
      wrap.innerHTML = m.products.map(p => {
        productCache.set(p.id, p);
        const url = productUrl({ id: p.id, slug: p.slug });
        return `<div class="cw-product">
          ${p.image ? `<img src="${e(p.image)}" alt="" loading="lazy" width="56" height="56">` : ''}
          <div class="cw-p-info"><a href="${url}">${e(p.name)}</a><b>${formatPriceTR(p.price)}</b><small>${e(p.stockText || '')}</small></div>
          ${p.inStock ? (p.hasVariants
            ? `<a class="cw-p-btn" href="${url}">Beden seç</a>`
            : `<button type="button" class="cw-p-btn" data-cw-add="${e(p.id)}">Sepete ekle</button>`)
            : '<span class="cw-p-out">Tükendi</span>'}
        </div>`;
      }).join('');
      el.appendChild(wrap);
    }
    if (m.links?.length) {
      const links = document.createElement('div');
      links.className = 'cw-links';
      m.links.forEach(l => {
        const a = document.createElement('a');
        a.href = l.href;
        a.textContent = l.label;
        if (/^https?:/.test(l.href)) { a.target = '_blank'; a.rel = 'noopener'; }
        links.appendChild(a);
      });
      el.appendChild(links);
    }
    list.appendChild(el);
  }

  function renderQuick(replies = []) {
    quick.innerHTML = '';
    replies.forEach(q => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cw-chip';
      b.textContent = q.label;
      b.addEventListener('click', () => {
        if (q.action === 'open_login') { openAuth('login'); return; }
        if (q.action === 'navigate' && q.payload?.href) { navigate(q.payload.href); return; }
        send({ action: q.action, payload: q.payload, label: q.label });
      });
      quick.appendChild(b);
    });
  }

  function showTyping(on) {
    let t = list.querySelector('.cw-typing');
    if (on && !t) {
      t = document.createElement('div');
      t.className = 'cw-msg cw-bot cw-typing';
      t.innerHTML = '<div class="cw-bubble"><span></span><span></span><span></span></div>';
      list.appendChild(t);
      scroll();
    } else if (!on && t) t.remove();
  }

  async function loadHistory() {
    if (loaded) return;
    loaded = true;
    try {
      const d = await api.get('/chat/history');
      list.innerHTML = '';
      d.messages.forEach(renderMessage);
      renderQuick([...d.messages].reverse().find(m => m.role !== 'user')?.quickReplies || []);
      scroll();
    } catch {
      loaded = false;
      list.innerHTML = '<div class="cw-msg cw-bot"><div class="cw-bubble">Bağlantı kurulamadı. Lütfen sayfayı yenileyin.</div></div>';
    }
  }

  async function send({ text, action, payload, label }) {
    if (busy) return;
    busy = true;
    renderMessage({ role: 'user', text: text || label });
    renderQuick([]);
    showTyping(true);
    try {
      const d = await api.post('/chat/message', { text, action, payload, label });
      showTyping(false);
      d.messages.forEach(renderMessage);
      renderQuick(d.messages.at(-1)?.quickReplies || []);
    } catch (err) {
      showTyping(false);
      renderMessage({ role: 'bot', text: err.message || 'Mesaj gönderilemedi.' });
      renderQuick([{ label: '🏠 Ana menü', action: 'menu' }]);
    } finally {
      busy = false;
      scroll();
    }
  }

  async function open(initial) {
    win.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('cw-open');
    await loadHistory();
    if (initial?.action) send(initial);
    else input.focus({ preventScroll: true });
  }
  function close() {
    win.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('cw-open');
  }

  toggle.addEventListener('click', () => (win.hidden ? open() : close()));
  win.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    send({ text });
  });

  win.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-cw]');
    if (btn?.dataset.cw === 'close') close();
    if (btn?.dataset.cw === 'reset') {
      const d = await api.post('/chat/reset').catch(() => null);
      if (d) { list.innerHTML = ''; d.messages.forEach(renderMessage); renderQuick(d.messages.at(-1)?.quickReplies || []); }
    }
    const add = ev.target.closest('[data-cw-add]');
    if (add) {
      add.disabled = true;
      const p = productCache.get(add.dataset.cwAdd);
      // Asistandaki kart sadece özet içerir; stok kontrolü sunucuda yapılır
      await Cart.add({ id: p.id, name: p.name, variants: [], stock: undefined });
      add.disabled = false;
    }
    // Asistan içindeki site içi linkler: pencereyi küçük ekranda kapat
    const link = ev.target.closest('a[href^="/"]');
    if (link && window.innerWidth < 600) close();
  });

  // Sayfanın herhangi bir yerinden asistanı açma: <button data-open-chat data-chat-action="return_request" data-order="...">
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-open-chat]');
    if (!t) return;
    ev.preventDefault();
    const action = t.dataset.chatAction;
    open(action ? { action, label: t.textContent.trim(), payload: t.dataset.order ? { orderNumber: t.dataset.order } : {} } : null);
  });

  return { open, close };
}
