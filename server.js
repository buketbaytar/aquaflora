

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieSession from 'cookie-session';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { products as seedProducts, categories } from './src/data/products.js';
// import { initializePayment, retrievePaymentResult } from './server-payment.js'; // Ödeme sistemi geçici olarak devredışı
import { Category } from './src/models/Category.js';
import { SubCategory } from './src/models/SubCategory.js';
import { User } from './src/models/User.js';
import { Cart } from './src/models/Cart.js';
import { Order } from './src/models/Order.js';
import { Product } from './src/models/Product.js';
import { Brand } from './src/models/Brand.js';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const app = express();
app.get('/api/debug', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

app.set('trust proxy', 1);
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL || 'https://aquaflora.pages.dev';
const backendUrl = process.env.BACKEND_URL || `http://localhost:${port}`;

// CORS Ayarları - Production ve Local linkleri destekler
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://aqualora.shop',
    'https://www.aqualora.shop',
    'https://aquaflora.pages.dev',
    'https://aquaflora-api.onrender.com',
    process.env.FRONTEND_URL,
    process.env.CUSTOM_DOMAIN
].filter(Boolean);

// Database Connection
let isDbConnected = false;
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        family: 4
    })
        .then(() => {
            console.log('✅ MongoDB Connected');
            isDbConnected = true;
        })
        .catch(err => {
            console.error('❌ MongoDB Connection Error:', err.message);
            if (process.env.NODE_ENV === 'production') {
                console.error('❌ FATAL: Database required in production. Exiting.');
                process.exit(1);
            }
            console.warn('⚠️ Server running without database. Persistence disabled.');
        });
} else {
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ FATAL: MONGODB_URI not defined. Exiting.');
        process.exit(1);
    }
    console.warn('⚠️ MONGODB_URI not found. Server running in memory-only mode.');
}

// Rate Limiting for Auth Endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { error: 'Too many attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Serve ROOT for dev/validation purposes (allows /src imports)
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));


import csrf from 'csurf'; const csrfProtection = csrf({
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Must match session cookie settings
        // httpOnly: true // Default is false which allows JS to read. WE WANT httpOnly=true for security, but we need to pass token via headers.
        // Actually, csurf by default checks HEADERS. We can pass the token in a meta tag or specific endpoint.
        // Let's use a specific endpoint to get the token for SPA/Admin usage.
    }
});

// Apply CSRF to all non-GET requests or globally? 
// For this project, we want to protect mutation endpoints.
// We'll apply it globally but might need exclusion for some external callbacks (none implemented yet).
// Note: cookie-session is used, csurf supports it.

// API routes might be stateless (JWT)? No, this project uses cookie-session. So CSRF IS REQUIRED.

app.use(bodyParser.json());
app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
}));

// Apply CSRF after cookie-session
app.use(csrfProtection);

// CSRF Token Endpoint
app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Admin Seeder
async function seedAdminUser() {
    if (isDbConnected) {
        try {
            const email = process.env.ADMIN_EMAIL; // Use ENV
            let user = await User.findOne({ email });
            if (!user) {
                const password = process.env.ADMIN_PASSWORD; // Use ENV
                const passwordHash = await bcrypt.hash(password, 10);
                await User.create({
                    email,
                    passwordHash,
                    name: 'Admin User',
                    isAdmin: true
                });
                console.log('👑 Admin user seeded.'); // Removed password log
            }
        } catch (e) { console.error('Admin seed error', e); }
    } else {
        // Memory mode admin
        const email = 'admin@aquaflora.com';
        if (!memoryUsers.find(u => u.email === email)) {
            const passwordHash = await bcrypt.hash('admin123', 10);
            memoryUsers.push({
                id: 'admin',
                email,
                passwordHash,
                name: 'Admin User',
                isAdmin: true
            });
            console.log('👑 Memory Admin seeded');
        }
    }
}

// In-memory Data Stores (Fallback)
const memoryUsers = [];
const memoryCarts = {};
const memoryOrders = [];
let memoryProducts = [...seedProducts]; // Copy for in-memory mode
// Fallback In-memory Categories/Subcategories for demo if DB fail (limited support)
let memoryCategories = [];
let memorySubCategories = [];

// Seed Products & Categories to MongoDB
async function seedProductsToDb() {
    if (!isDbConnected) return;
    try {
        const catCount = await Category.countDocuments();

        // ONLY Seed if Categories are empty
        if (catCount === 0) {
            console.log('📦 Seeding Categories & SubCategories...');

            // Map to store created category IDs for product linking
            const catMap = {}; // "Category Name": ObjectId
            const subCatMap = {}; // "Category Name - Sub Name": ObjectId

            // 1. Create Categories & SubCategories from src/data logic
            for (const c of categories) {
                const catSlug = c.title.toLowerCase().replace(/\s+/g, '-');
                let catDoc = await Category.create({
                    name: c.title,
                    slug: catSlug
                });
                catMap[c.title] = catDoc._id;

                for (const subName of c.sub) {
                    const subSlug = subName.toLowerCase().replace(/\s+/g, '-');
                    let subDoc = await SubCategory.create({
                        name: subName,
                        slug: subSlug,
                        categoryId: catDoc._id
                    });
                    subCatMap[`${c.title}-${subName}`] = subDoc._id;
                }
            }
            console.log('✅ Categories seeded.');

            // 2. Seed Products
            const prodCount = await Product.countDocuments();
            if (prodCount === 0) {
                console.log('📦 Seeding products to database...');
                for (const p of seedProducts) {
                    let priceNum = 0;
                    if (typeof p.price === 'string') {
                        priceNum = parseFloat(p.price.replace(' ₺', '').replace(/\./g, '').replace(',', '.'));
                    } else {
                        priceNum = p.price;
                    }

                    const cId = catMap[p.category];
                    const scId = subCatMap[`${p.category}-${p.subCategory}`];

                    // Find or Create Brand (Seeder Logic)
                    let brandName = p.brand || "Generic";
                    let brandSlug = brandName.toLowerCase().replace(/\s+/g, '-');
                    let brandDoc = await Brand.findOne({ slug: brandSlug }); // Global Brand import needed if distinct? No, Brand imported above.

                    // Since we didn't import Brand in seeding scope previously, we rely on top level import
                    if (!brandDoc) {
                        brandDoc = await Brand.create({
                            name: brandName,
                            slug: brandSlug,
                            description: 'Seeded Brand'
                        });
                    }

                    await Product.create({
                        name: p.name,
                        category: p.category, // Keep for legacy
                        subCategory: p.subCategory, // Keep for legacy
                        categoryId: cId,
                        subCategoryId: scId,
                        brandId: brandDoc._id,
                        brand: p.brand,
                        price: priceNum,
                        image: p.image,
                        video: p.video,
                        specs: p.specs,
                        active: true,
                        isFeatured: false // Default
                    });
                }
                console.log('✅ Products seeded linked to categories.');
            }
        }
    } catch (e) {
        console.error('❌ Seeding error:', e.message);
    }
}

// Helper to get products (from DB or memory)
async function getProducts(activeOnly = true) {
    if (isDbConnected) {
        try {
            const filter = activeOnly ? { active: true } : {};
            // Populate category/subcategory names
            return await Product.find(filter)
                .populate('categoryId', 'name')
                .populate('subCategoryId', 'name')
                .populate('brandId', 'name slug')
                .lean();
        } catch (e) {
            console.error('Product fetch error:', e.message);
            return [];
        }
    } else {
        return activeOnly ? memoryProducts.filter(p => p.active !== false) : memoryProducts;
    }
}

// Admin Middleware
const isAdmin = async (req, res, next) => {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const adminFlag = isDbConnected ? user.isAdmin : user.isAdmin;
    if (!adminFlag) return res.status(403).json({ error: 'Forbidden: Admin access required' });

    req.user = user;
    next();
};

// Helper
const getUser = async (req) => {
    if (!req.session.userId) return null;
    if (isDbConnected) {
        try {
            return await User.findById(req.session.userId);
        } catch (e) {
            console.error('Error fetching user:', e.message);
            return null;
        }
    } else {
        return memoryUsers.find(u => u.id === req.session.userId);
    }
};

// Auth Endpoints
app.post('/api/auth/register', authLimiter, async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    if (isDbConnected) {
        try {
            const existingUser = await User.findOne({ email });
            if (existingUser) return res.status(409).json({ error: 'Email already exists' });

            const passwordHash = await bcrypt.hash(password, 10);
            const newUser = new User({ email, passwordHash, name: name || email.split('@')[0] });
            await newUser.save();

            // Initialize empty cart for user
            const newCart = new Cart({ userId: newUser._id, items: [] });
            await newCart.save();

            req.session.userId = newUser._id.toString();
            res.json({ id: newUser._id, email: newUser.email, name: newUser.name });
        } catch (e) {
            console.error('Registration Error:', e);
            res.status(500).json({ error: 'Server error' });
        }
    } else {
        // Fallback
        if (memoryUsers.find(u => u.email === email)) {
            return res.status(409).json({ error: 'Email already exists' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now().toString(),
            email,
            name: name || email.split('@')[0],
            passwordHash
        };
        memoryUsers.push(newUser);
        memoryCarts[newUser.id] = [];
        req.session.userId = newUser.id;
        res.json({ id: newUser.id, email: newUser.email, name: newUser.name });
    }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (isDbConnected) {
        try {
            const user = await User.findOne({ email });
            if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            req.session.userId = user._id.toString();
            res.json({ id: user._id, email: user.email, name: user.name });
        } catch (e) {
            console.error('Login Error:', e);
            res.status(500).json({ error: 'Server error' });
        }
    } else {
        const user = memoryUsers.find(u => u.email === email);
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        req.session.userId = user.id;
        res.json({ id: user.id, email: user.email, name: user.name });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session = null;
    res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', async (req, res) => {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    // Mongoose document vs POJO
    const userData = isDbConnected ? { id: user._id, email: user.email, name: user.name, favorites: user.favorites || [] } : { id: user.id, email: user.email, name: user.name, favorites: [] };
    res.json(userData);
});

// --- Favorites API ---
app.get('/api/favorites', async (req, res) => {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    if (isDbConnected) {
        try {
            // Populate favorites
            const dbUser = await User.findById(user._id).populate('favorites');
            res.json(dbUser.favorites);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.json([]);
    }
});

app.post('/api/favorites/:id', async (req, res) => {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    if (isDbConnected) {
        try {
            await User.findByIdAndUpdate(user._id, { $addToSet: { favorites: req.params.id } });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(501).json({ error: 'DB required' });
    }
});

app.delete('/api/favorites/:id', async (req, res) => {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    if (isDbConnected) {
        try {
            await User.findByIdAndUpdate(user._id, { $pull: { favorites: req.params.id } });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(501).json({ error: 'DB required' });
    }
});

// Cart Endpoints
app.get('/api/cart', async (req, res) => {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    let items = [];
    if (isDbConnected) {
        try {
            let cart = await Cart.findOne({ userId: user._id });
            if (!cart) {
                cart = new Cart({ userId: user._id, items: [] });
                await cart.save();
            }
            items = cart.items;
        } catch (e) {
            console.error('Cart Fetch Error:', e);
            return res.status(500).json({ error: 'Server error' });
        }
    } else {
        items = memoryCarts[user.id] || [];
    }

    // Populate details from products data
    // Fetch fresh product list to populate
    const allProducts = await getProducts(true);

    const cartItems = items.map(item => {
        const product = allProducts.find(p => p._id.toString() === item.productId.toString() || p.id == item.productId);
        return product ? { ...product } : null;
    }).filter(Boolean);

    res.json(cartItems);
});

app.post('/api/cart/add', async (req, res) => {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'Product ID required' });

    let items = [];

    if (isDbConnected) {
        try {
            let cart = await Cart.findOne({ userId: user._id });
            if (!cart) {
                cart = new Cart({ userId: user._id, items: [] });
            }

            cart.items.push({ productId: productId });
            await cart.save();
            items = cart.items;
        } catch (e) {
            console.error('Cart Add Error:', e);
            return res.status(500).json({ error: 'Server error' });
        }
    } else {
        if (!memoryCarts[user.id]) memoryCarts[user.id] = [];
        memoryCarts[user.id].push({ productId: parseInt(productId) });
        items = memoryCarts[user.id];
    }

    // Return updated cart
    const allProducts = await getProducts(true);
    const cartItems = items.map(item => {
        const product = allProducts.find(p => p._id?.toString() === item.productId.toString() || p.id == item.productId);
        return product ? { ...product } : null;
    }).filter(Boolean);

    res.json(cartItems);
});

// Payment Endpoints

app.post('/api/payment/initialize', async (req, res) => {
    // Ödeme sistemi geçici olarak devredışı bırakıldı
    res.status(503).json({
        status: 'maintenance',
        errorMessage: 'Ödeme sistemi şu anda bakım aşamasındadır. Lütfen daha sonra tekrar deneyiniz.'
    });
});

app.post('/api/payment/callback', async (req, res) => {
    res.status(503).send('System Maintenance');
});

// ==================== PUBLIC PRODUCTS & CATEGORY API ====================

app.get('/api/products', async (req, res) => {
    const products = await getProducts(true);
    // Format price for display & Ensure backward compatibility
    const formattedProducts = products.map(p => ({
        ...p,
        id: p._id || p.id,
        price: typeof p.price === 'number' ? p.price : parseFloat(p.price),
        // Ensure string category names exist for frontend compat
        category: p.categoryId?.name || p.category || "",
        subCategory: p.subCategoryId?.name || p.subCategory || "",
        brand: p.brandId?.name || p.brand || ""
    }));
    res.json(formattedProducts);
    res.json(formattedProducts);
});

app.post('/api/products/:id/view', async (req, res) => {
    if (isDbConnected) {
        try {
            await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
            res.json({ success: true });
        } catch (e) {
            // Ignore error silently or log
            console.log('View inc error', e);
            res.status(200).json({ success: false }); // Don't block
        }
    } else {
        res.json({ success: false });
    }
});


// Get Categories (Public)
app.get('/api/categories', async (req, res) => {
    if (isDbConnected) {
        try {
            // Fetch categories and structure them like the old static format
            // [{ id, title, sub: [] }]
            const cats = await Category.find().sort({ name: 1 }).lean();
            const subCats = await SubCategory.find().sort({ name: 1 }).lean();

            const response = cats.map(c => ({
                id: c._id,
                title: c.name,
                slug: c.slug,
                sub: subCats.filter(s => s.categoryId.toString() === c._id.toString()).map(s => ({ name: s.name, slug: s.slug }))
            }));
            res.json(response);
        } catch (e) {
            console.error("Cat fetch error", e);
            res.status(500).json([]);
        }
    } else {
        res.json(categories); // Fallback to static
    }
});

// Get SubCategories (Public)
app.get('/api/subcategories', async (req, res) => {
    if (isDbConnected) {
        const subs = await SubCategory.find().populate('categoryId', 'name').sort({ name: 1 });
        res.json(subs);
    } else {
        res.json([]);
    }
});

// ==================== ADMIN ROUTES ====================

// Serve admin page
app.get('/admin', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- Categories ---

app.get('/api/admin/categories', isAdmin, async (req, res) => {
    if (isDbConnected) {
        const cats = await Category.find().sort({ createdAt: -1 });
        res.json(cats);
    } else {
        res.json([]);
    }
});

app.post('/api/admin/categories', isAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    if (isDbConnected) {
        try {
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            const cat = await Category.create({ name, slug });
            res.json(cat);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(501).json({ error: 'DB required' });
    }
});

app.put('/api/admin/categories/:id', isAdmin, async (req, res) => {
    if (isDbConnected) {
        try {
            const { name } = req.body;
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            const cat = await Category.findByIdAndUpdate(req.params.id, { name, slug }, { new: true });
            res.json(cat);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(501).json({ error: 'DB required' });
    }
});

app.delete('/api/admin/categories/:id', isAdmin, async (req, res) => {
    if (isDbConnected) {
        try {
            // Also delete subcategories? Or restrict? For now, let's restrict if subs exist or cascade? 
            // safest is to error if subs exist, but requirements didn't specify. Let's just delete category.
            // But products link to it. 
            // Simple delete for now.
            await Category.findByIdAndDelete(req.params.id);
            // Optional: delete subcats
            await SubCategory.deleteMany({ categoryId: req.params.id });
            res.json({ message: 'Deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(501).json({ error: 'DB required' });
    }
});

// --- SubCategories ---

app.get('/api/admin/subcategories', isAdmin, async (req, res) => {
    if (isDbConnected) {
        const subs = await SubCategory.find().populate('categoryId', 'name').sort({ createdAt: -1 });
        res.json(subs);
    } else {
        res.json([]);
    }
});

app.post('/api/admin/subcategories', isAdmin, async (req, res) => {
    const { name, categoryId } = req.body;
    if (!name || !categoryId) return res.status(400).json({ error: 'Name and CategoryId required' });

    if (isDbConnected) {
        try {
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            const sub = await SubCategory.create({ name, slug, categoryId });
            res.json(sub);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(501).json({ error: 'DB required' });
    }
});

app.put('/api/admin/subcategories/:id', isAdmin, async (req, res) => {
    if (isDbConnected) {
        try {
            const { name, categoryId } = req.body;
            const updates = { name, categoryId };
            if (name) updates.slug = name.toLowerCase().replace(/\s+/g, '-');

            const sub = await SubCategory.findByIdAndUpdate(req.params.id, updates, { new: true });
            res.json(sub);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(501).json({ error: 'DB required' });
    }
});

app.delete('/api/admin/subcategories/:id', isAdmin, async (req, res) => {
    if (isDbConnected) {
        try {
            await SubCategory.findByIdAndDelete(req.params.id);
            res.json({ message: 'Deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(501).json({ error: 'DB required' });
    }
});

// --- Brands (Global) ---

app.get('/api/brands', async (req, res) => {
    if (isDbConnected) {
        const brands = await Brand.find().sort({ name: 1 });
        res.json(brands);
    } else {
        res.json([]);
    }
});

app.get('/api/admin/brands', isAdmin, async (req, res) => {
    if (isDbConnected) {
        const brands = await Brand.find().sort({ createdAt: -1 });
        res.json(brands);
    } else {
        res.json([]);
    }
});

app.post('/api/admin/brands', isAdmin, async (req, res) => {
    const { name, logo, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    if (isDbConnected) {
        try {
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            const brand = await Brand.create({ name, slug, logo, description });
            res.json(brand);
        } catch (e) {
            if (e.code === 11000) return res.status(409).json({ error: 'Brand already exists' });
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(501).json({ error: 'DB required' });
    }
});

app.put('/api/admin/brands/:id', isAdmin, async (req, res) => {
    if (isDbConnected) {
        try {
            const { name, logo, description } = req.body;
            const updates = { name, logo, description };
            if (name) updates.slug = name.toLowerCase().replace(/\s+/g, '-');

            const brand = await Brand.findByIdAndUpdate(req.params.id, updates, { new: true });
            res.json(brand);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(501).json({ error: 'DB required' });
    }
});

app.delete('/api/admin/brands/:id', isAdmin, async (req, res) => {
    if (isDbConnected) {
        try {
            await Brand.findByIdAndDelete(req.params.id);
            res.json({ message: 'Deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(501).json({ error: 'DB required' });
    }
});

// --- Products ---

// Admin API: List all products (including inactive)
app.get('/api/admin/products', isAdmin, async (req, res) => {
    const products = await getProducts(false);
    // Backward compat for Admin UI if it expects strings
    const formatted = products.map(p => ({
        ...p,
        category: p.categoryId?.name || p.category,
        subCategory: p.subCategoryId?.name || p.subCategory,
        brand: p.brandId?.name || p.brand
    }));
    res.json(formatted);
});

// Admin API: Create product
app.post('/api/admin/products', isAdmin, async (req, res) => {
    const { name, categoryId, subCategoryId, brandId, price, image, video, description, specs, active, isFeatured } = req.body;

    // Validation
    if (!name || !categoryId || !brandId || price === undefined) {
        return res.status(400).json({ error: 'Name, category, brand, and price are required' });
    }

    if (isDbConnected) {
        try {
            // Resolve Names for legacy fields
            const cat = await Category.findById(categoryId);
            const sub = subCategoryId ? await SubCategory.findById(subCategoryId) : null;
            const brandDoc = await Brand.findById(brandId);

            const product = await Product.create({
                name,
                categoryId,
                subCategoryId,
                brandId,
                category: cat ? cat.name : "Unknown", // Legacy
                subCategory: sub ? sub.name : "", // Legacy
                brand: brandDoc ? brandDoc.name : "Unknown", // Legacy
                price: parseFloat(price),
                image, video, description, specs,
                active: active !== false,
                isFeatured: !!isFeatured
            });
            res.json(product);
        } catch (e) {
            console.error('Create product error:', e.message);
            res.status(500).json({ error: 'Failed to create product' });
        }
    } else {
        const newProduct = {
            id: Date.now(),
            name, categoryId, subCategoryId, brandId,
            price: parseFloat(price),
            image, video, description, specs,
            active: active !== false,
            isFeatured: !!isFeatured
        };
        memoryProducts.push(newProduct);
        res.json(newProduct);
    }
});

// Admin API: Update product
app.put('/api/admin/products/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (updates.price !== undefined) {
        updates.price = parseFloat(updates.price);
    }

    // If categoryId changed, update legacy strings
    if (isDbConnected) {
        try {
            if (updates.categoryId) {
                const cat = await Category.findById(updates.categoryId);
                if (cat) updates.category = cat.name;
            }
            if (updates.subCategoryId) {
                const sub = await SubCategory.findById(updates.subCategoryId);
                if (sub) updates.subCategory = sub.name;
            }
            if (updates.brandId) {
                const brand = await Brand.findById(updates.brandId);
                if (brand) updates.brand = brand.name;
            }

            const product = await Product.findByIdAndUpdate(id, updates, { new: true });
            if (!product) return res.status(404).json({ error: 'Product not found' });
            res.json(product);
        } catch (e) {
            console.error('Update product error:', e.message);
            res.status(500).json({ error: 'Failed to update product' });
        }
    } else {
        const idx = memoryProducts.findIndex(p => p.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Product not found' });
        memoryProducts[idx] = { ...memoryProducts[idx], ...updates };
        res.json(memoryProducts[idx]);
    }
});

// Admin API: Delete product
app.delete('/api/admin/products/:id', isAdmin, async (req, res) => {
    const { id } = req.params;

    if (isDbConnected) {
        try {
            const result = await Product.findByIdAndDelete(id);
            if (!result) return res.status(404).json({ error: 'Product not found' });
            res.json({ message: 'Product deleted' });
        } catch (e) {
            console.error('Delete product error:', e.message);
            res.status(500).json({ error: 'Failed to delete product' });
        }
    } else {
        const idx = memoryProducts.findIndex(p => p.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Product not found' });
        memoryProducts.splice(idx, 1);
        res.json({ message: 'Product deleted' });
    }
});

// ==================== SERVER START ====================

// Explicitly serve index and urunler for root navigation if needed (though static covers it)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/urunler.html', (req, res) => res.sendFile(path.join(__dirname, 'urunler.html')));

app.listen(port, async () => {
    console.log(`Backend server listening at http://localhost:${port}`);

    // Seed products after DB connection is established
    // if (process.env.MONGODB_URI) {
    // Wait a moment for connection to establish
    setTimeout(async () => {
        await seedProductsToDb();
        await seedAdminUser();
    }, 2000);
    // }
});
