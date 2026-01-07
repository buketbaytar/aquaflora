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
                <a href="#home" class="btn primary-btn" onclick="window.history.back()">Alışverişe Başla</a>
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
                    ${items.map(item => `
                        <div class="cart-item">
                            <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                            <div class="cart-item-details">
                                <h3>${item.name}</h3>
                                <p class="category">${item.category || ''}</p>
                                <p class="price">${item.price}</p>
                            </div>
                            <button class="remove-btn text-danger" onclick="alert('Not implemented yet')">🗑️</button>
                        </div>
                    `).join('')}
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
                        <button id="checkout-btn" class="btn checkout-btn" disabled>Ödemeye Geç (Bakımda)</button>
                        <p class="maintenance-hint" style="color: #ffcc00; font-size: 0.85rem; margin-top: 10px; text-align: center;">
                            ⚠️ Ödeme sistemi yakında aktif olacaktır.
                        </p>
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
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            checkoutBtn.disabled = true;
            checkoutBtn.textContent = 'İşleniyor...';

            try {
                const res = await fetch(`${API_BASE_URL}/api/payment/initialize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'success') {
                        // Render iyzico form
                        // iyzico returns HTML content to be embedded.
                        // Ideally we replace the body or a specific div.
                        document.querySelector('#main-content').innerHTML = data.htmlContent + '<div id="iyzipay-checkout-form" class="responsive"></div>';
                        // iyzico usually injects script tags. We might need to eval them or trust browser.
                        // Actually iyzico html content includes script tag.
                        // Inserting HTML with innerHTML usually DOES NOT execute scripts for security.
                        // We need to extract script and run it.
                        // But wait, standard iyzico checkout form is just a big script block or iframe logic?
                        // Let's check `data.htmlContent`.
                        // If it contains <script>, we need a helper.

                        // BUT for simplicity, we can try to write it to document.write (bad practice) or appendChild script.
                        // Let's presume we might need to handle this carefully.
                        // A common fix: create a range context.
                        const range = document.createRange();
                        range.setStart(document.body, 0);
                        const fragment = range.createContextualFragment(data.htmlContent);
                        document.querySelector('#main-content').innerHTML = ''; // clear
                        document.querySelector('#main-content').appendChild(fragment);
                    } else {
                        alert('Payment Init Failed: ' + data.errorMessage);
                        checkoutBtn.disabled = false;
                        checkoutBtn.textContent = 'Ödemeye Geç';
                    }
                } else {
                    const error = await res.json();
                    alert('Error: ' + error.error);
                    checkoutBtn.disabled = false;
                    checkoutBtn.textContent = 'Ödemeye Geç';
                }
            } catch (e) {
                console.error(e);
                alert('Connection error');
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = 'Ödemeye Geç';
            }
        });
    }
}
