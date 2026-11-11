import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    order: { type: Number, default: 100 }, // Menüdeki sıra (küçük önce)
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export const Category = mongoose.model('Category', categorySchema);
