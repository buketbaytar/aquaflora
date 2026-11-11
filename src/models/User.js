import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    isAdmin: { type: Boolean, default: false },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

    // KVKK / İYS
    kvkkAcknowledgedAt: Date,
    marketingConsent: {
        granted: { type: Boolean, default: false },
        at: Date
    },

    resetPasswordTokenHash: String,
    resetPasswordExpires: Date,
    lastLoginAt: Date,
    createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);
