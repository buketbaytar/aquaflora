import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    // Deprecated string fields kept for compatibility
    category: { type: String, required: true },
    subCategory: { type: String },

    // New Relational Fields
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
    isFeatured: { type: Boolean, default: false },

    brand: { type: String }, // Legacy/Display fallback
    price: { type: Number, required: true },
    image: { type: String },
    video: { type: String },
    description: { type: String },
    specs: { type: mongoose.Schema.Types.Mixed },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

export const Product = mongoose.model('Product', productSchema);
