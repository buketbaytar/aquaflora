export function PaymentResult() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const message = params.get('message');

    if (status === 'success') {
        return `
            <div class="payment-result success glass-panel container" style="margin-top: 50px; text-align: center; padding: 40px;">
                <div class="icon-circle success-icon">✓</div>
                <h1>Ödeme Başarılı!</h1>
                <p>Siparişiniz alınmıştır. Teşekkür ederiz.</p>
                <a href="/" onclick="window.location.href='/'" class="btn primary-btn" style="margin-top: 20px;">Anasayfaya Dön</a>
            </div>
            <style>
                .success-icon { font-size: 60px; color: #4CAF50; margin-bottom: 20px; }
            </style>
        `;
    } else {
        return `
            <div class="payment-result error glass-panel container" style="margin-top: 50px; text-align: center; padding: 40px;">
                <div class="icon-circle error-icon">✕</div>
                <h1>Ödeme Başarısız</h1>
                <p>Maalesef işleminiz tamamlanamadı.</p>
                <p class="error-detail">${message || 'Bilinmeyen bir hata oluştu.'}</p>
                <a href="#cart" class="btn secondary-btn" style="margin-top: 20px;">Sepete Dön</a>
            </div>
            <style>
                .error-icon { font-size: 60px; color: #f44336; margin-bottom: 20px; }
            </style>
        `;
    }
}
