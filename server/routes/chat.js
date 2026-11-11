import { Router } from 'express';
import crypto from 'crypto';
import { ChatConversation } from '../../src/models/ChatConversation.js';
import { limits } from '../middleware/security.js';
import { str } from '../lib/validate.js';
import { respond, welcomeMessage } from '../chat/engine.js';

const router = Router();
const MAX_STORED = 200;
const ALLOWED_ACTIONS = new Set(['menu', 'order_status', 'return_request', 'return_kind', 'return_reason', 'return_submit',
    'recommend', 'stock_query', 'faq_menu', 'faq', 'live_support']);

/** Oturumun konuşmasını bulur. Üyelerde son konuşma hesaba bağlıdır → cihazlar arası geçmiş korunur. */
async function getConversation(req, create = false) {
    let conv = null;
    if (req.user) conv = await ChatConversation.findOne({ userId: req.user._id, status: { $ne: 'closed' } }).sort({ lastMessageAt: -1 });
    if (!conv && req.session.chatKey) conv = await ChatConversation.findOne({ sessionKey: req.session.chatKey });
    if (!conv && create) {
        req.session.chatKey ||= crypto.randomBytes(16).toString('hex');
        conv = new ChatConversation({ sessionKey: req.session.chatKey, userId: req.user?._id, messages: [] });
    }
    if (conv && req.user && !conv.userId) conv.userId = req.user._id;
    if (conv) req.session.chatKey = conv.sessionKey;
    return conv;
}

const view = (m) => ({
    role: m.role, text: m.text, at: m.at,
    quickReplies: m.quickReplies || [], products: m.products || [], links: m.links || []
});

router.get('/chat/history', async (req, res) => {
    const conv = await getConversation(req, false);
    res.set('Cache-Control', 'no-store');
    if (!conv || !conv.messages.length) return res.json({ messages: [view({ ...welcomeMessage(req.user), at: new Date() })], status: 'bot' });
    res.json({ messages: conv.messages.slice(-60).map(view), status: conv.status });
});

router.post('/chat/message', limits.chat, async (req, res) => {
    const text = str(req.body.text, 500);
    const action = ALLOWED_ACTIONS.has(req.body.action) ? req.body.action : null;
    const payload = req.body.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
    const label = str(req.body.label, 100);
    if (!text && !action) return res.status(400).json({ error: 'Mesaj boş' });

    const conv = await getConversation(req, true);
    if (!conv.messages.length) conv.messages.push(welcomeMessage(req.user));
    conv.messages.push({ role: 'user', text: text || label || action });

    let replies;
    try {
        replies = await respond({ conv, user: req.user, sessionOrders: req.session.orders || [] }, { text, action, payload });
    } catch (e) {
        console.error('Chat hatası:', e);
        replies = [{ role: 'bot', text: 'Şu anda bir sorun yaşıyorum. Lütfen tekrar deneyin veya canlı desteğe bağlanın.', quickReplies: [{ label: '🎧 Canlı destek', action: 'live_support' }] }];
    }
    conv.messages.push(...replies);
    if (conv.messages.length > MAX_STORED) conv.messages = conv.messages.slice(-MAX_STORED);
    conv.lastMessageAt = new Date();
    await conv.save();

    res.set('Cache-Control', 'no-store').json({ messages: replies.map(r => view({ ...r, at: new Date() })), status: conv.status });
});

router.post('/chat/reset', async (req, res) => {
    const conv = await getConversation(req, false);
    if (conv) {
        conv.status = 'closed';
        conv.pending = null;
        await conv.save();
    }
    req.session.chatKey = crypto.randomBytes(16).toString('hex');
    res.json({ messages: [view({ ...welcomeMessage(req.user), at: new Date() })] });
});

export default router;
