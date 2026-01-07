import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    subCategory: { type: String },
    brand: { type: String },
    price: { type: Number, required: true },
    image: { type: String },
    video: { type: String },
    description: { type: String },
    specs: { type: mongoose.Schema.Types.Mixed },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

export const Product = mongoose.model('Product', productSchema);
