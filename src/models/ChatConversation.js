import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'bot', 'agent'], required: true },
    text: { type: String, maxlength: 2000 },
    intent: String,
    // Bot mesajlarında: hızlı yanıt butonları, ürün kartları, linkler
    quickReplies: [{ label: String, action: String, payload: mongoose.Schema.Types.Mixed, _id: false }],
    products: [{ id: String, slug: String, name: String, price: Number, image: String, inStock: Boolean, hasVariants: Boolean, stockText: String, _id: false }],
    links: [{ label: String, href: String, _id: false }],
    at: { type: Date, default: Date.now }
}, { _id: false });

const chatConversationSchema = new mongoose.Schema({
    sessionKey: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    status: { type: String, enum: ['bot', 'handoff', 'closed'], default: 'bot' },
    // Çok adımlı akışlar için (ör. iade talebi -> sipariş no -> neden)
    pending: { type: mongoose.Schema.Types.Mixed, default: null },
    // Misafirin sipariş no + e-posta ile doğruladığı e-posta (sonraki adımlarda tekrar sorulmaz)
    verifiedEmail: { type: String, lowercase: true, trim: true },
    messages: [chatMessageSchema],
    lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true, minimize: false });

// KVKK: saklama süresi dolan konuşmalar MongoDB tarafından otomatik silinir (TTL index)
const retentionDays = Number(process.env.CHAT_RETENTION_DAYS) || 180;
chatConversationSchema.index({ lastMessageAt: 1 }, { expireAfterSeconds: retentionDays * 24 * 3600 });

export const ChatConversation = mongoose.model('ChatConversation', chatConversationSchema);
