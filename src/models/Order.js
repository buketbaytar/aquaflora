import mongoose from 'mongoose';

export const ORDER_STATUSES = [
    'pending_payment', // Ödeme bekleniyor (stok rezerve)
    'paid',            // Ödeme alındı
    'preparing',       // Hazırlanıyor
    'shipped',         // Kargoya verildi
    'delivered',       // Teslim edildi
    'cancelled',       // İptal (stok iade edildi)
    'payment_failed',  // Ödeme başarısız (stok iade edildi)
    'refund_requested',// İade talebi
    'refunded'         // İade edildi
];

export const STATUS_LABELS_TR = {
    pending_payment: 'Ödeme bekleniyor',
    paid: 'Ödeme alındı',
    preparing: 'Hazırlanıyor',
    shipped: 'Kargoya verildi',
    delivered: 'Teslim edildi',
    cancelled: 'İptal edildi',
    payment_failed: 'Ödeme başarısız',
    refund_requested: 'İade talebi alındı',
    refunded: 'İade edildi',
    // Eski kayıtlar
    pending: 'Ödeme bekleniyor',
    failed: 'Ödeme başarısız'
};

const addressSchema = new mongoose.Schema({
    fullName: String,
    phone: String,
    city: String,
    district: String,
    addressLine: String,
    zipCode: String,
    country: { type: String, default: 'Turkey' }
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productId: { type: Number }, // eski kayıtlar
    name: { type: String, required: true },
    image: String,
    category: String,
    price: { type: Number, required: true },
    selectedVariant: { type: String },
    quantity: { type: Number, default: 1 },
    lineTotal: Number
}, { _id: false });

const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true, sparse: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // misafirde boş
    paymentId: { type: String }, // eski alan

    customer: {
        name: String,
        email: { type: String, lowercase: true, trim: true, index: true },
        phone: String
    },
    shippingAddress: addressSchema,
    billing: {
        type: { type: String, enum: ['individual', 'corporate'], default: 'individual' },
        address: addressSchema,
        identityNumber: String,
        companyName: String,
        taxOffice: String,
        taxNumber: String
    },

    items: [orderItemSchema],
    subtotal: Number,
    shippingFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'TRY' },

    paymentMethod: { type: String, enum: ['card', 'bank_transfer'], default: 'card' },
    payment: {
        provider: String,
        token: { type: String, index: true },
        conversationId: String,
        transactionId: String,
        paidAt: Date,
        failureReason: String
    },

    status: { type: String, enum: [...ORDER_STATUSES, 'pending', 'failed'], default: 'pending_payment', index: true },
    statusHistory: [{ status: String, at: { type: Date, default: Date.now }, note: String, _id: false }],

    shipment: {
        carrier: String,
        trackingNumber: String,
        trackingUrl: String,
        shippedAt: Date
    },

    // Yasal onayların ispatı (Mesafeli Sözleşmeler Yönetmeliği)
    consents: {
        preInfoAcceptedAt: Date,
        distanceSalesAcceptedAt: Date,
        kvkkAcknowledgedAt: Date,
        marketingOptIn: { type: Boolean, default: false },
        ip: String,
        userAgent: String
    },

    reservationExpiresAt: { type: Date, index: true },
    stockReleased: { type: Boolean, default: false },
    customerNote: String,
    adminNote: String,
    createdAt: { type: Date, default: Date.now }
}, { timestamps: { createdAt: false, updatedAt: true } });

export const Order = mongoose.model('Order', orderSchema);
