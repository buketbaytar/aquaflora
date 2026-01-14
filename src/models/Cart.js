import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
    productId: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    selectedVariant: { type: String } // Stores selected size (e.g., "S", "M", "L")
});

const cartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
    updatedAt: { type: Date, default: Date.now }
});

export const Cart = mongoose.model('Cart', cartSchema);
