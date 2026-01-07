import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    id: String,
    name: String,
    price: Number,
    category: String
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
