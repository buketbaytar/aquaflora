import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    productId: { type: Number, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    selectedVariant: { type: String }, // Track size/variant ordered
    quantity: { type: Number, default: 1 }
});

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paymentId: { type: String, required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'failed', 'pending'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

export const Order = mongoose.model('Order', orderSchema);
