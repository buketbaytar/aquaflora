import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productId: { type: Number }, // ESKİ: sayısal seed ID. Okunurken `product` alanına dönüştürülür.
    quantity: { type: Number, default: 1, min: 1, max: 99 },
    selectedVariant: { type: String },
    addedAt: { type: Date, default: Date.now }
}, { _id: false });

const cartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
    reminderSentAt: { type: Date } // Sepet hatırlatma e-postası gönderildi mi?
}, { timestamps: true });

cartSchema.index({ updatedAt: 1 });

export const Cart = mongoose.model('Cart', cartSchema);
