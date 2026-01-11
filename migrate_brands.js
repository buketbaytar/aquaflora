
import mongoose from 'mongoose';
import { Product } from './src/models/Product.js';
import { Brand } from './src/models/Brand.js';
import dotenv from 'dotenv';
import { categories } from './src/data/products.js'; // Just in case, but we use DB data

dotenv.config();

async function migrateBrands() {
    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI is missing. Cannot migrate.');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to DB');

        const products = await Product.find({ brandId: { $exists: false } });
        console.log(`Found ${products.length} products without brandId.`);

        for (const p of products) {
            let brandName = p.brand || "Generic"; // Fallback if legacy brand is missing
            if (!brandName.trim()) brandName = "Generic";

            let brandSlug = brandName.toLowerCase().replace(/\s+/g, '-');

            // Find or Create Brand
            let brand = await Brand.findOne({ slug: brandSlug });
            if (!brand) {
                // Try by name just in case slug differs
                brand = await Brand.findOne({ name: brandName });
            }

            if (!brand) {
                console.log(`Creating brand: ${brandName}`);
                brand = await Brand.create({
                    name: brandName,
                    slug: brandSlug,
                    description: 'Auto-created during migration'
                });
            }

            p.brandId = brand._id;
            // Ensure legacy field matches
            p.brand = brand.name;

            await p.save();
            console.log(`Updated product: ${p.name} -> Brand: ${brand.name}`);
        }

        console.log('✅ Migration complete.');
        process.exit(0);

    } catch (e) {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    }
}

migrateBrands();
