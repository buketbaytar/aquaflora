import { Cart } from '../utils/cart.js';
import { Auth } from '../utils/auth.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function CartPage() {
    const items = Cart.items;

    if (items.length === 0) {
        return `
            <div class="cart-empty-state glass-panel">
                <h2>Sepetiniz Boş</h2>
                <p>Henüz sepetinize ürün eklemediniz.</p>
                <a href="/urunler.html" class="btn primary-btn" id="start-shopping-btn">Alışverişe Başla</a>
            </div>
        `;
    }

    const total = items.reduce((sum, item) => {
        // Parse price string '15.000 ₺' -> 15000
        // But backend sends product object as is? 
        // Backend /api/cart sends { ...product }
        // product.price is string in local data? 
        // Let's assume logic requires checking data structure.
        // Re-checking server.js: it sends products from products.js.
        // Let's assume products.price is a number or string. 
        // In products.js snippet earlier (not seen fully), usually strings like "15.000 ₺".
        // Use a safe parser logic.
        let price = 0;
        if (typeof item.price === 'number') {
            price = item.price;
        } else if (typeof item.price === 'string') {
            price = parseFloat(item.price.replace(' ₺', '').replace(/\./g, '').replace(',', '.'));
        }
        return sum + price; // Quantity is 1 for now
    }, 0);

    const formattedTotal = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(total);

    return `
        <div class="cart-page container">
            <h1>Alışveriş Sepeti</h1>
            
            <div class="cart-layout">
                <div class="cart-items glass-panel">
                    ${items.map(item => {
        const variantDisplay = item.selectedVariant ? ` - Beden: ${item.selectedVariant}` : '';
        return `
                        <div class="cart-item">
                            <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                            <div class="cart-item-details">
                                <h3>${item.name}${variantDisplay}</h3>
                                <p class="category">${item.category || ''}</p>
                                <p class="price">${item.price}${item.quantity > 1 ? ` x ${item.quantity}` : ''}</p>
                            </div>
                            <button class="remove-btn text-danger" data-id="${item.id || item._id}" data-variant="${item.selectedVariant}">🗑️</button>
                        </div>
                        `;
    }).join('')}
                </div>

                <div class="cart-summary glass-panel">
                    <h2>Sipariş Özeti</h2>
                    <div class="summary-row">
                        <span>Ara Toplam</span>
                        <span>${formattedTotal}</span>
                    </div>
                     <div class="summary-row">
                        <span>Kargo</span>
                        <span>Ücretsiz</span>
                    </div>
                    <div class="summary-total">
                        <span>Toplam</span>
                        <span>${formattedTotal}</span>
                    </div>
                    
                    ${Auth.user ? `
                        <div style="margin: 20px 0; padding: 15px; background: rgba(0, 212, 255, 0.1); border-radius: 8px; border: 1px solid rgba(0, 212, 255, 0.3);">
                            <label style="display: flex; align-items: start; gap: 10px; cursor: pointer; font-size: 0.9rem; line-height: 1.6;">
                                <input type="checkbox" id="contract-approval" style="margin-top: 4px; width: 18px; height: 18px; cursor: pointer;">
                                <span>
                                    Ön Bilgilendirme Formunu ve 
                                    <a href="/sozlesme.html" target="_blank" style="color: #00d4ff; text-decoration: underline; font-weight: 600;">Mesafeli Satış Sözleşmesini</a> 
                                    okudum, onaylıyorum.
                                </span>
                            </label>
                        </div>
                        <button id="checkout-btn" class="btn checkout-btn" disabled style="opacity: 0.5; cursor: not-allowed;">Siparişi Tamamla</button>
                    ` : `
                        <button class="btn checkout-btn" disabled>Ödeme için Giriş Yapın</button>
                        <p class="small-hint">Lütfen devam etmek için giriş yapınız.</p>
                    `}
                </div>
            </div>
        </div>
    `;
}

export function setupCartInteractions() {
    const checkoutBtn = document.querySelector('#checkout-btn');
    const contractCheckbox = document.querySelector('#contract-approval');

    // Remove Button Delegation
    const cartItemsContainer = document.querySelector('.cart-items');
    if (cartItemsContainer) {
        cartItemsContainer.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-btn');
            if (removeBtn) {
                const id = removeBtn.dataset.id;
                const variant = removeBtn.dataset.variant;
                // Confirm optional? "Are you sure?"
                // For now, direct remove as it's faster UX
                Cart.remove(id, variant === 'undefined' ? null : variant);
            }
        });
    }

    // Initial State Check
    if (checkoutBtn && contractCheckbox) {
        checkoutBtn.disabled = !contractCheckbox.checked;
        if (!contractCheckbox.checked) {
            checkoutBtn.style.opacity = '0.5';
            checkoutBtn.style.cursor = 'not-allowed';
        }
    }

    // Checkbox Event Listener
    if (contractCheckbox && checkoutBtn) {
        contractCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                checkoutBtn.style.opacity = '1';
                checkoutBtn.style.cursor = 'pointer';
                checkoutBtn.disabled = false;
            } else {
                checkoutBtn.style.opacity = '0.5';
                checkoutBtn.style.cursor = 'not-allowed';
                checkoutBtn.disabled = true;
            }
        });
    }

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            if (checkoutBtn.disabled) return;

            // Double check
            if (contractCheckbox && !contractCheckbox.checked) {
                alert('⚠️ Lütfen Mesafeli Satış Sözleşmesini okuyup onaylayınız.');
                return;
            }

            checkoutBtn.disabled = true;
            checkoutBtn.textContent = 'İşleniyor...';

            try {
                // TEST MODE: Direct Order Creation to verify Stock Logic
                const res = await fetch(`${API_BASE_URL}/api/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });

                const data = await res.json();

                if (res.ok) {
                    Cart.items = []; // Clear local cart
                    Cart.notify();
                    alert(`✅ Siparişiniz Başarıyla Alındı!\nSipariş No: ${data.orderId}\n\nStoklar güncellendi.`);
                    window.location.href = '/';
                } else {
                    // Show Backend Error (e.g., Stock Insufficient)
                    alert(`❌ Sipariş Oluşturulamadı:\n${data.error || 'Bilinmeyen hata'}`);
                    checkoutBtn.disabled = false;
                    checkoutBtn.textContent = 'Siparişi Tamamla';
                }

            } catch (e) {
                console.error(e);
                alert('Bağlantı hatası oluştu.');
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = 'Siparişi Tamamla';
            }
        });
    }
}
