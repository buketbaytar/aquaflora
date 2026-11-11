import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../../src/models/User.js';
import { Cart } from '../../src/models/Cart.js';
import { ChatConversation } from '../../src/models/ChatConversation.js';
import { config } from '../config.js';
import { mails } from '../lib/mailer.js';
import { limits, requireUser } from '../middleware/security.js';
import { badRequest, conflict, unauthorized, email as vEmail, password as vPassword, phoneTR, str, isObjectId } from '../lib/validate.js';
import { toPublicProduct, populated } from '../services/catalog.js';
import { Product } from '../../src/models/Product.js';

const router = Router();
const BCRYPT_ROUNDS = 12;
// Zamanlama saldırısıyla e-posta tespitini zorlaştırmak için sahte hash
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

export const publicUser = (u) => u && ({
    id: String(u._id),
    email: u.email,
    name: u.name,
    phone: u.phone || '',
    isAdmin: !!u.isAdmin,
    marketingConsent: !!u.marketingConsent?.granted,
    favorites: (u.favorites || []).map(String)
});

/** Oturum sabitleme (session fixation) önlemi: girişte CSRF anahtarı yenilenir */
function startSession(req, user) {
    req.session.userId = String(user._id);
    req.session.csrf = crypto.randomBytes(24).toString('base64url');
    // Misafirken başlatılan chat konuşmasını kullanıcıya bağla
    if (req.session.chatKey) {
        ChatConversation.updateOne({ sessionKey: req.session.chatKey, userId: { $exists: false } }, { $set: { userId: user._id } }).catch(() => { });
    }
}

router.post('/auth/register', limits.auth, async (req, res) => {
    const em = vEmail(req.body.email);
    const pw = vPassword(req.body.password);
    const name = str(req.body.name, 80);
    const errors = {};
    if (!em) errors.email = 'Geçerli bir e-posta giriniz';
    if (!pw) errors.password = 'Şifre en az 8 karakter olmalı';
    if (name.length < 2) errors.name = 'Adınızı giriniz';
    if (req.body.kvkk !== true) errors.kvkk = 'KVKK Aydınlatma Metni onaylanmalı';
    if (Object.keys(errors).length) throw badRequest('Lütfen bilgileri kontrol edin', errors);

    if (await User.exists({ email: em })) throw conflict('Bu e-posta ile kayıtlı bir hesap var. Giriş yapmayı deneyin.');

    const now = new Date();
    const user = await User.create({
        email: em,
        name,
        passwordHash: await bcrypt.hash(pw, BCRYPT_ROUNDS),
        kvkkAcknowledgedAt: now,
        marketingConsent: { granted: req.body.marketing === true, at: req.body.marketing === true ? now : undefined },
        lastLoginAt: now
    });
    await Cart.create({ userId: user._id, items: [] });
    startSession(req, user);
    res.status(201).json({ user: publicUser(user), csrfToken: req.session.csrf });
});

router.post('/auth/login', limits.auth, async (req, res) => {
    const em = vEmail(req.body.email);
    const pw = typeof req.body.password === 'string' ? req.body.password : '';
    const user = em ? await User.findOne({ email: em }) : null;
    const ok = await bcrypt.compare(pw, user?.passwordHash || DUMMY_HASH);
    if (!user || !ok) throw unauthorized('E-posta veya şifre hatalı');

    user.lastLoginAt = new Date();
    await user.save();
    startSession(req, user);
    res.json({ user: publicUser(user), csrfToken: req.session.csrf });
});

router.post('/auth/logout', (req, res) => {
    req.session = null;
    res.json({ success: true });
});

router.get('/auth/me', (req, res) => {
    res.json({ user: req.user ? publicUser(req.user) : null });
});

/* --------- Şifre sıfırlama --------- */
router.post('/auth/forgot-password', limits.passwordReset, async (req, res) => {
    const em = vEmail(req.body.email);
    // Hesap var/yok bilgisini sızdırmamak için her durumda aynı yanıt
    const generic = { success: true, message: 'Bu e-posta ile kayıtlı bir hesap varsa sıfırlama bağlantısı gönderildi.' };
    if (!em) return res.json(generic);
    const user = await User.findOne({ email: em });
    if (user) {
        const token = crypto.randomBytes(32).toString('base64url');
        user.resetPasswordTokenHash = crypto.createHash('sha256').update(token).digest('hex');
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();
        await mails.passwordReset(user, `${config.publicUrl}/sifre-sifirla?token=${token}`);
    }
    res.json(generic);
});

router.post('/auth/reset-password', limits.passwordReset, async (req, res) => {
    const token = str(req.body.token, 100);
    const pw = vPassword(req.body.password);
    if (!pw) throw badRequest('Şifre en az 8 karakter olmalı');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = token && await User.findOne({ resetPasswordTokenHash: hash, resetPasswordExpires: { $gt: new Date() } });
    if (!user) throw badRequest('Bağlantı geçersiz veya süresi dolmuş. Lütfen yeniden şifre sıfırlama isteyin.');
    user.passwordHash = await bcrypt.hash(pw, BCRYPT_ROUNDS);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    startSession(req, user);
    res.json({ user: publicUser(user), csrfToken: req.session.csrf });
});

/* --------- Hesap --------- */
router.put('/account', requireUser, async (req, res) => {
    const upd = {};
    if (req.body.name !== undefined) {
        const n = str(req.body.name, 80);
        if (n.length < 2) throw badRequest('Adınızı giriniz');
        upd.name = n;
    }
    if (req.body.phone !== undefined) {
        const p = req.body.phone ? phoneTR(req.body.phone) : '';
        if (req.body.phone && !p) throw badRequest('Geçerli bir cep telefonu giriniz');
        upd.phone = p;
    }
    if (req.body.marketing !== undefined) upd.marketingConsent = { granted: req.body.marketing === true, at: new Date() };
    const user = await User.findByIdAndUpdate(req.user._id, { $set: upd }, { new: true });
    res.json({ user: publicUser(user) });
});

router.put('/account/password', requireUser, limits.auth, async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!(await bcrypt.compare(String(req.body.currentPassword || ''), user.passwordHash))) throw badRequest('Mevcut şifre hatalı');
    const pw = vPassword(req.body.newPassword);
    if (!pw) throw badRequest('Yeni şifre en az 8 karakter olmalı');
    user.passwordHash = await bcrypt.hash(pw, BCRYPT_ROUNDS);
    await user.save();
    res.json({ success: true });
});

/* --------- Favoriler --------- */
router.get('/favorites', async (req, res) => {
    if (!req.user) return res.json([]);
    const products = await populated(Product.find({ _id: { $in: req.user.favorites || [] }, active: true })).lean();
    res.json(products.map(toPublicProduct));
});

router.post('/favorites/:id', requireUser, async (req, res) => {
    if (!isObjectId(req.params.id)) throw badRequest('Geçersiz ürün');
    if (!(await Product.exists({ _id: req.params.id }))) throw badRequest('Ürün bulunamadı');
    await User.updateOne({ _id: req.user._id }, { $addToSet: { favorites: req.params.id } });
    res.json({ success: true });
});

router.delete('/favorites/:id', requireUser, async (req, res) => {
    if (!isObjectId(req.params.id)) throw badRequest('Geçersiz ürün');
    await User.updateOne({ _id: req.user._id }, { $pull: { favorites: req.params.id } });
    res.json({ success: true });
});

export default router;
