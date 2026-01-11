import mongoose from 'mongoose';

const subCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound unique index to ensure name is unique within a category
subCategorySchema.index({ name: 1, categoryId: 1 }, { unique: true });

export const SubCategory = mongoose.model('SubCategory', subCategorySchema);
