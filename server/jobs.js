import { Cart } from '../src/models/Cart.js';
import { User } from '../src/models/User.js';
import { config } from './config.js';
import { expireStaleOrders } from './services/orders.js';
import { cartLines } from './services/cart.js';
import { mails, mailEnabled } from './lib/mailer.js';

/**
 * Basit zamanlanmış işler (ayrı cron servisi gerektirmez).
 * Render free planda servis uykuya geçerse işler uyanınca çalışır; ücretli planda sürekli çalışır.
 */
async function abandonedCartReminders() {
    if (!mailEnabled()) return 0;
    const olderThan = new Date(Date.now() - config.abandonedCartHours * 3600 * 1000);
    const notOlderThan = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const carts = await Cart.find({
        'items.0': { $exists: true },
        updatedAt: { $lt: olderThan, $gt: notOlderThan },
        reminderSentAt: { $exists: false }
    }).limit(50);

    let sent = 0;
    for (const cart of carts) {
        // Ticari elektronik ileti: sadece izin veren kullanıcılara (6563 sayılı Kanun / İYS)
        const user = await User.findOne({ _id: cart.userId, 'marketingConsent.granted': true }).lean();
        cart.reminderSentAt = new Date();
        await cart.save({ timestamps: false });
        if (!user) continue;
        const lines = (await cartLines(cart.items)).filter(l => l.available > 0);
        if (lines.length && await mails.abandonedCart(user, lines)) sent++;
    }
    return sent;
}

export function startJobs() {
    const safe = (name, fn) => async () => {
        try {
            const n = await fn();
            if (n) console.log(`⏱️  ${name}: ${n}`);
        } catch (e) {
            console.error(`⏱️  ${name} hatası:`, e.message);
        }
    };
    const expire = safe('Süresi dolan siparişler iptal edildi', expireStaleOrders);
    const remind = safe('Sepet hatırlatma gönderildi', abandonedCartReminders);

    setTimeout(expire, 10_000);
    setInterval(expire, 5 * 60 * 1000).unref();
    setInterval(remind, 60 * 60 * 1000).unref();
}
