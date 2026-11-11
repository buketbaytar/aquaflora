import { config } from '../config.js';
import { STATUS_LABELS_TR } from '../../src/models/Order.js';

/**
 * E-posta gönderimi — Resend HTTP API (ek npm paketi gerektirmez).
 * RESEND_API_KEY ve MAIL_FROM tanımlı değilse e-postalar sadece loglanır; site çalışmaya devam eder.
 * Alternatif: Brevo/Mailgun/Postmark — sadece `send()` içini değiştirmek yeterli.
 */
export const mailEnabled = () => Boolean(config.mail.resendApiKey && config.mail.from);

export async function send({ to, subject, html, text }) {
    if (!to) return false;
    if (!mailEnabled()) {
        console.log(`✉️  [mail devre dışı] "${subject}"`);
        return false;
    }
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.mail.resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: config.mail.from,
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
                text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
                ...(config.mail.replyTo ? { reply_to: config.mail.replyTo } : {})
            }),
            signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) {
            console.error('✉️  Mail gönderilemedi:', res.status, (await res.text()).slice(0, 200));
            return false;
        }
        return true;
    } catch (e) {
        console.error('✉️  Mail hatası:', e.message);
        return false;
    }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tl = (n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n || 0);

function layout(title, body) {
    return `<!doctype html><html lang="tr"><body style="font-family:Arial,sans-serif;background:#f4f7fa;padding:24px;color:#1b2a3a">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:24px">
<h2 style="color:#006d8f;margin-top:0">${esc(config.siteName)}</h2>
<h3>${esc(title)}</h3>
${body}
<hr style="border:none;border-top:1px solid #e3e8ee;margin:24px 0">
<p style="font-size:12px;color:#6b7c8f">${esc(config.siteName)} · ${esc(config.publicUrl)}${config.support.email ? ` · ${esc(config.support.email)}` : ''}</p>
</div></body></html>`;
}

function itemsTable(order) {
    const rows = order.items.map(i => `<tr>
<td style="padding:6px 0">${esc(i.name)}${i.selectedVariant ? ` (${esc(i.selectedVariant)})` : ''} × ${i.quantity}</td>
<td style="text-align:right">${tl(i.lineTotal ?? i.price * i.quantity)}</td></tr>`).join('');
    return `<table style="width:100%;border-collapse:collapse">${rows}
<tr><td style="padding-top:8px">Kargo</td><td style="text-align:right">${order.shippingFee ? tl(order.shippingFee) : 'Ücretsiz'}</td></tr>
<tr><td style="font-weight:bold;padding-top:8px">Toplam</td><td style="text-align:right;font-weight:bold">${tl(order.totalAmount)}</td></tr></table>`;
}

const orderLink = (order) => `${config.publicUrl}/siparis-takip?no=${encodeURIComponent(order.orderNumber)}`;

export const mails = {
    orderReceived(order) {
        const bank = config.payment.bank;
        const bankInfo = order.paymentMethod === 'bank_transfer' ? `
<div style="background:#fff8e1;padding:12px;border-radius:6px">
<b>Havale/EFT bilgileri</b><br>Banka: ${esc(bank.name)}<br>Alıcı: ${esc(bank.accountHolder)}<br>IBAN: <b>${esc(bank.iban)}</b><br>
Açıklama: <b>${esc(order.orderNumber)}</b><br>
<small>Ödemeniz ${config.payment.bankReservationHours} saat içinde ulaşmazsa sipariş otomatik iptal edilir.</small></div>` : '';
        return send({
            to: order.customer.email,
            subject: `Siparişiniz alındı — ${order.orderNumber}`,
            html: layout('Siparişiniz alındı', `<p>Merhaba ${esc(order.customer.name)},</p>
<p><b>${esc(order.orderNumber)}</b> numaralı siparişiniz oluşturuldu.</p>${bankInfo}${itemsTable(order)}
<p><a href="${orderLink(order)}">Siparişimi takip et</a></p>`)
        });
    },
    orderPaid(order) {
        return send({
            to: order.customer.email,
            subject: `Ödemeniz alındı — ${order.orderNumber}`,
            html: layout('Siparişiniz onaylandı', `<p>Merhaba ${esc(order.customer.name)},</p>
<p>Ödemeniz başarıyla alındı. Siparişiniz ${esc(config.shipping.estimatedDays)} içinde kargoya verilecektir.</p>
${itemsTable(order)}<p><a href="${orderLink(order)}">Siparişimi takip et</a></p>`)
        });
    },
    orderStatusChanged(order) {
        const tracking = order.shipment?.trackingNumber
            ? `<p>Kargo: ${esc(order.shipment.carrier || '')} — Takip no: <b>${esc(order.shipment.trackingNumber)}</b>
${order.shipment.trackingUrl ? `<br><a href="${esc(order.shipment.trackingUrl)}">Kargonu takip et</a>` : ''}</p>` : '';
        return send({
            to: order.customer.email,
            subject: `Sipariş durumu: ${STATUS_LABELS_TR[order.status] || order.status} — ${order.orderNumber}`,
            html: layout('Sipariş durumunuz güncellendi', `<p>Merhaba ${esc(order.customer.name)},</p>
<p><b>${esc(order.orderNumber)}</b> numaralı siparişinizin yeni durumu: <b>${esc(STATUS_LABELS_TR[order.status] || order.status)}</b></p>
${tracking}<p><a href="${orderLink(order)}">Detayları gör</a></p>`)
        });
    },
    adminNewOrder(order) {
        if (!config.admin.notifyEmail) return false;
        return send({
            to: config.admin.notifyEmail,
            subject: `🛒 Yeni sipariş ${order.orderNumber} — ${tl(order.totalAmount)} (${order.paymentMethod === 'card' ? 'Kart' : 'Havale'})`,
            html: layout('Yeni sipariş', `<p>${esc(order.customer.name)} — ${esc(order.customer.phone)}</p>${itemsTable(order)}`)
        });
    },
    adminLowStock(lines) {
        if (!config.admin.notifyEmail || !lines.length) return false;
        return send({
            to: config.admin.notifyEmail,
            subject: `⚠️ Düşük stok uyarısı (${lines.length} ürün)`,
            html: layout('Düşük stok', `<ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`)
        });
    },
    adminNewTicket(ticket) {
        if (!config.admin.notifyEmail) return false;
        return send({
            to: config.admin.notifyEmail,
            subject: `💬 Yeni destek talebi ${ticket.ticketNumber} (${ticket.type})`,
            html: layout('Yeni destek talebi', `<p>${esc(ticket.name || '')} ${esc(ticket.email || '')} ${esc(ticket.phone || '')}</p>
<p>Sipariş: ${esc(ticket.orderNumber || '-')}</p><p>Neden: ${esc(ticket.reason || '-')}</p><p>${esc(ticket.message || '')}</p>`)
        });
    },
    passwordReset(user, link) {
        return send({
            to: user.email,
            subject: 'Şifre sıfırlama',
            html: layout('Şifrenizi sıfırlayın', `<p>Merhaba ${esc(user.name || '')},</p>
<p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın. Bağlantı 1 saat geçerlidir.</p>
<p><a href="${esc(link)}" style="background:#006d8f;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Şifremi sıfırla</a></p>
<p style="font-size:12px">Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>`)
        });
    },
    abandonedCart(user, lines) {
        return send({
            to: user.email,
            subject: 'Sepetinizde ürünler sizi bekliyor',
            html: layout('Sepetinizi unutmayın', `<p>Merhaba ${esc(user.name || '')},</p>
<p>Sepetinizde bıraktığınız ürünler stoklar tükenmeden sizi bekliyor:</p>
<ul>${lines.map(l => `<li>${esc(l.name)}${l.selectedVariant ? ` (${esc(l.selectedVariant)})` : ''} — ${tl(l.price)}</li>`).join('')}</ul>
<p><a href="${config.publicUrl}/sepet">Sepete git</a></p>
<p style="font-size:11px;color:#888">Bu e-postayı ticari ileti izniniz olduğu için aldınız. İzninizi hesabım sayfasından geri alabilirsiniz.</p>`)
        });
    }
};
