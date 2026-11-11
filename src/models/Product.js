import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
    size: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, default: 0, min: 0 }
});

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    id: { type: Number, unique: true, sparse: true }, // Eski (seed) sayısal ID desteği
    slug: { type: String, trim: true, index: true },
    sku: { type: String, trim: true, unique: true, sparse: true }, // Stok kodu (toplu içe aktarmada eşleştirme anahtarı)

    // Eski string alanlar (geriye dönük uyumluluk için tutuluyor)
    category: { type: String, required: true },
    subCategory: { type: String },

    // İlişkisel alanlar
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
    subCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
    isFeatured: { type: Boolean, default: false },

    brand: { type: String },
    price: { type: Number, required: true, min: 0 },
    image: { type: String },           // Ana görsel (images[0] ile aynı tutulur)
    images: [{ type: String }],        // Galeri
    video: { type: String },
    description: { type: String },
    specs: { type: mongoose.Schema.Types.Mixed },
    views: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },

    // Stok: varyantsız ürünlerde `stock`, varyantlı ürünlerde `variants[].stock` esas alınır
    stock: { type: Number, default: 0, min: 0 },
    variants: [variantSchema],

    createdAt: { type: Date, default: Date.now }
});

productSchema.index(
    { name: 'text', brand: 'text', description: 'text', category: 'text', subCategory: 'text' },
    { default_language: 'none', weights: { name: 5, brand: 3 } }
);

export const Product = mongoose.model('Product', productSchema);
