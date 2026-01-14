import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    id: { type: Number, unique: true }, // Legacy ID support
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
    views: { type: Number, default: 0 },
    active: { type: Boolean, default: true },

    // Stock Management
    stock: { type: Number, default: 0 }, // Main stock for non-variant products
    variants: [{
        size: { type: String, required: true },
        stock: { type: Number, required: true, default: 0 }
    }], // Variant-based stock (e.g., S, M, L with individual stock counts)

    createdAt: { type: Date, default: Date.now }
});

export const Product = mongoose.model('Product', productSchema);
