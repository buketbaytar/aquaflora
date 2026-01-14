import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieSession from 'cookie-session';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import csrf from 'csurf';
// Veri ve Modeller
import { products as seedProducts, categories } from './src/data/products.js';
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

// 1. TRUST PROXY (Render ve Cloudflare için ŞART)
app.set('trust proxy', 1);

const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// 2. CORS AYARLARI (Domainler)
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:10000',
    'https://aqualora.shop',
    'https://www.aqualora.shop'
];

console.log('🌐 Allowed CORS Origins:', allowedOrigins);

// 3. CORS MIDDLEWARE
app.use(cors({
    origin: (origin, callback) => {
        // Origin yoksa (server-to-server) veya listede varsa izin ver
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS BLOCKED: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Cookie transferi için şart
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// 4. DATABASE CONNECTION
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
            if (isProduction) {
                console.error('❌ FATAL: Database required in production. Exiting.');
                process.exit(1);
            }
            console.warn('⚠️ Server running without database.');
        });
} else {
    if (isProduction) {
        console.error('❌ FATAL: MONGODB_URI not defined. Exiting.');
        process.exit(1);
    }
    console.warn('⚠️ MONGODB_URI not found.');
}

// 5. BODY PARSER & RATE LIMIT
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // Biraz esnetildi
    message: { error: 'Too many attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// 6. STATIC FILES (Session'dan ÖNCE olmalı ki gereksiz cookie oluşmasın)
// Bu sayede resimler, CSS ve JS dosyaları 403 yemeden yüklenir.
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

// 7. SESSION MIDDLEWARE (EN KRİTİK KISIM)
app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'gizli_anahtar_degistirin'],
    maxAge: 24 * 60 * 60 * 1000, // 24 saat

    // Güvenlik Ayarları
    httpOnly: true,
    secure: true, // Render HTTPS olduğu için TRUE olmalı

    // Aynı domainde (aqualora.shop) çalıştığımız için 'lax' en iyisidir.
    sameSite: 'lax',

    // Domain'i null bırakıyoruz, tarayıcı otomatik algılar (En güvenlisi)
    domain: undefined
}));

// 8. CSRF PROTECTION
const csrfProtection = csrf({
    cookie: false, // CookieSession kullandığımız için false
    sessionKey: 'session',
    value: (req) => {
        return req.headers['x-csrf-token'] ||
            req.headers['csrf-token'] ||
            req.body._csrf;
    }
});

// Global Hata Yakalayıcı (CSRF Hatası İçin)
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        console.error('❌ CSRF Error:', req.method, req.path);
        // Cookie'yi temizle ki kullanıcı yenileyince düzelmiş olsun
        req.session = null;
        return res.status(403).json({
            error: 'CSRF token geçersiz veya eksik',
            message: 'Oturumunuz zaman aşımına uğradı, lütfen sayfayı yenileyin.'
        });
    }
    next(err);
});

// ==================== ROUTES ====================

// API Info Endpoint
app.get('/api/info', (req, res) => {
    res.json({
        message: 'Aquaflora API is running',
        database: isDbConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// CSRF Token Endpoint (Token almak için)
// Bu endpoint korumalı OLMAMALI, sadece token dağıtır.
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    // Token'ı hem JSON dönelim hem de loglayalım
    const token = req.csrfToken();
    // console.log('🔑 CSRF Token Generated:', token);
    res.json({ csrfToken: token });
});

// BURADAN SONRA DİĞER API ROUTE'LARINIZ GELECEK...


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
app.post('/api/auth/register', csrfProtection, authLimiter, async (req, res) => {
    console.log('[POST /api/auth/register] Request received');
    try {
        const { email, password, name } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        if (isDbConnected) {
            console.log('[POST /api/auth/register] Using MongoDB');
            const existingUser = await User.findOne({ email });
            if (existingUser) return res.status(409).json({ error: 'Email already exists' });

            const passwordHash = await bcrypt.hash(password, 10);
            const newUser = new User({ email, passwordHash, name: name || email.split('@')[0] });
            await newUser.save();

            // Initialize empty cart for user
            const newCart = new Cart({ userId: newUser._id, items: [] });
            await newCart.save();

            req.session.userId = newUser._id.toString();
            console.log('[POST /api/auth/register] User registered successfully:', newUser.email);
            res.json({ id: newUser._id, email: newUser.email, name: newUser.name });
        } else {
            // Fallback
            console.log('[POST /api/auth/register] Using memory mode');
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
            console.log('[POST /api/auth/register] User registered in memory:', newUser.email);
            res.json({ id: newUser.id, email: newUser.email, name: newUser.name });
        }
    } catch (e) {
        console.error('[POST /api/auth/register] Error:', e.message, e.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', csrfProtection, authLimiter, async (req, res) => {
    console.log('[POST /api/auth/login] Request received');
    try {
        const { email, password } = req.body;

        if (isDbConnected) {
            console.log('[POST /api/auth/login] Checking MongoDB for user:', email);
            const user = await User.findOne({ email });
            if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
                console.log('[POST /api/auth/login] Invalid credentials for:', email);
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            req.session.userId = user._id.toString();
            console.log('[POST /api/auth/login] Login successful:', email);
            res.json({ id: user._id, email: user.email, name: user.name });
        } else {
            console.log('[POST /api/auth/login] Checking memory for user:', email);
            const user = memoryUsers.find(u => u.email === email);
            if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
                console.log('[POST /api/auth/login] Invalid credentials for:', email);
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            req.session.userId = user.id;
            console.log('[POST /api/auth/login] Login successful (memory):', email);
            res.json({ id: user.id, email: user.email, name: user.name });
        }
    } catch (e) {
        console.error('[POST /api/auth/login] Error:', e.message, e.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    // 1. Session içeriğini boşalt
    req.session = null;

    // 2. Çerezleri agresif bir şekilde temizle
    // İhtimalleri kapsayarak siliyoruz:

    // Varsayılan silme
    res.clearCookie('session');
    res.clearCookie('session.sig');

    // Domain spesifik silme (Eski ayarlardan kalanları temizlemek için)
    res.clearCookie('session', { path: '/', domain: '.aqualora.shop' });
    res.clearCookie('session.sig', { path: '/', domain: '.aqualora.shop' });

    // Tam domain silme
    res.clearCookie('session', { path: '/', domain: 'aqualora.shop' });
    res.clearCookie('session.sig', { path: '/', domain: 'aqualora.shop' });

    console.log('🚪 Kullanıcı çıkış yaptı (Session temizlendi).');
    res.status(200).json({ success: true });
});

// Auth Check Endpoint
app.get('/api/auth/me', async (req, res) => {
    console.log('[GET /api/auth/me] Request received');
    try {
        const user = await getUser(req);
        if (!user) {
            console.log('[GET /api/auth/me] Not authenticated (Visitor)');
            // Return 200 with null user to avoid console 401 errors
            return res.json({ user: null });
        }

        // Mongoose document vs POJO
        const userData = isDbConnected ? { id: user._id, email: user.email, name: user.name, favorites: user.favorites || [] } : { id: user.id, email: user.email, name: user.name, favorites: [] };
        console.log('[GET /api/auth/me] Returning user data:', userData.email);
        res.json(userData);
    } catch (e) {
        console.error('[GET /api/auth/me] Error:', e.message, e.stack);
        // Keep 500 for actual server errors
        res.status(500).json({ error: 'Server error' });
    }
});

// --- Favorites API ---
// 1. FAVORİLERİ GETİR (HATA DÜZELTİLDİ)
app.get('/api/favorites', async (req, res) => {
    const user = await getUser(req);

    // DÜZELTME: Kullanıcı giriş yapmamışsa 401 hatası verme, boş liste ([]) döndür.
    // Bu sayede site açılışında konsolda kırmızı hata çıkmaz.
    if (!user) {
        return res.json([]);
    }

    if (isDbConnected) {
        try {
            // Kullanıcının favorilerini veritabanından çek ve doldur (populate)
            const dbUser = await User.findById(user._id).populate('favorites');

            // Eğer veritabanında kullanıcı bulunamazsa yine boş dön
            if (!dbUser) return res.json([]);

            res.json(dbUser.favorites || []);
        } catch (e) {
            console.error('Favorites Fetch Error:', e);
            res.status(500).json({ error: 'Favoriler alınamadı' });
        }
    } else {
        // Veritabanı bağlı değilse boş liste dön
        res.json([]);
    }
});

// 2. FAVORİ EKLE (Burası korumalı kalmalı)
app.post('/api/favorites/:id', csrfProtection, async (req, res) => {
    console.log('[POST /api/favorites/:id] Request received for product:', req.params.id);
    try {
        const user = await getUser(req);
        // Giriş yapmamışsa 401 dön (Frontend bunu yakalayıp Login modalını açar)
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        if (isDbConnected) {
            // $addToSet: Eğer zaten varsa tekrar eklemez (Duplicate önler)
            await User.findByIdAndUpdate(user._id, { $addToSet: { favorites: req.params.id } });
            console.log('[POST /api/favorites/:id] Favorite added:', req.params.id);
            res.json({ success: true });
        } else {
            res.status(501).json({ error: 'DB required' });
        }
    } catch (e) {
        console.error('[POST /api/favorites/:id] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// 3. FAVORİ SİL (Burası korumalı kalmalı)
app.delete('/api/favorites/:id', csrfProtection, async (req, res) => {
    console.log('[DELETE /api/favorites/:id] Request received for product:', req.params.id);
    try {
        const user = await getUser(req);
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        if (isDbConnected) {
            await User.findByIdAndUpdate(user._id, { $pull: { favorites: req.params.id } });
            console.log('[DELETE /api/favorites/:id] Favorite removed:', req.params.id);
            res.json({ success: true });
        } else {
            res.status(501).json({ error: 'DB required' });
        }
    } catch (e) {
        console.error('[DELETE /api/favorites/:id] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Cart Endpoints
app.get('/api/cart', async (req, res) => {
    const user = await getUser(req);
    // Return empty cart for guests to avoid 401 console errors
    if (!user) return res.json([]);

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

app.post('/api/cart/add', csrfProtection, async (req, res) => {
    console.log('[POST /api/cart/add] Request received');
    try {
        const user = await getUser(req);
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        const { productId } = req.body;
        if (!productId) return res.status(400).json({ error: 'Product ID required' });

        let items = [];

        if (isDbConnected) {
            console.log('[POST /api/cart/add] Adding to DB cart');
            let cart = await Cart.findOne({ userId: user._id });
            if (!cart) {
                cart = new Cart({ userId: user._id, items: [] });
            }

            cart.items.push({ productId: productId });
            await cart.save();
            items = cart.items;
        } else {
            console.log('[POST /api/cart/add] Adding to memory cart');
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

        console.log('[POST /api/cart/add] Product added to cart, total items:', cartItems.length);
        res.json(cartItems);
    } catch (e) {
        console.error('[POST /api/cart/add] Error:', e.message, e.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

// Payment Endpoints

app.post('/api/payment/initialize', csrfProtection, async (req, res) => {
    console.log('[POST /api/payment/initialize] Request received - maintenance mode');
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
    console.log('[GET /api/products] Request received');
    try {
        const products = await getProducts(true);
        console.log('[GET /api/products] Fetched', products.length, 'products from', isDbConnected ? 'DB' : 'memory');

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

        console.log('[GET /api/products] Returning', formattedProducts.length, 'formatted products');
        res.json(formattedProducts);
    } catch (e) {
        console.error('[GET /api/products] Error:', e.message, e.stack);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.post('/api/products/:id/view', csrfProtection, async (req, res) => {
    console.log('[POST /api/products/:id/view] Request received for product:', req.params.id);
    try {
        if (isDbConnected) {
            await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
            console.log('[POST /api/products/:id/view] View count incremented');
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (e) {
        console.error('[POST /api/products/:id/view] Error:', e.message);
        res.status(200).json({ success: false }); // Don't block
    }
});


// Get Categories (Public)
app.get('/api/categories', async (req, res) => {
    console.log('[GET /api/categories] Request received');
    try {
        if (isDbConnected) {
            console.log('[GET /api/categories] Fetching from DB');
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
            console.log('[GET /api/categories] Returning', response.length, 'categories');
            res.json(response);
        } else {
            console.log('[GET /api/categories] Returning static categories');
            res.json(categories); // Fallback to static
        }
    } catch (e) {
        console.error('[GET /api/categories] Error:', e.message, e.stack);
        res.status(500).json([]);
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

app.post('/api/admin/categories', csrfProtection, isAdmin, async (req, res) => {
    console.log('[POST /api/admin/categories] Request received');
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });

        if (isDbConnected) {
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            const cat = await Category.create({ name, slug });
            console.log('[POST /api/admin/categories] Category created:', name);
            res.json(cat);
        } else {
            res.status(501).json({ error: 'DB required' });
        }
    } catch (e) {
        console.error('[POST /api/admin/categories] Error:', e.message, e.stack);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/admin/categories/:id', csrfProtection, isAdmin, async (req, res) => {
    console.log('[PUT /api/admin/categories/:id] Request received for:', req.params.id);
    try {
        if (isDbConnected) {
            const { name } = req.body;
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            const cat = await Category.findByIdAndUpdate(req.params.id, { name, slug }, { new: true });
            console.log('[PUT /api/admin/categories/:id] Category updated:', name);
            res.json(cat);
        } else {
            res.status(501).json({ error: 'DB required' });
        }
    } catch (e) {
        console.error('[PUT /api/admin/categories/:id] Error:', e.message, e.stack);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/categories/:id', csrfProtection, isAdmin, async (req, res) => {
    console.log('[DELETE /api/admin/categories/:id] Request received for:', req.params.id);
    try {
        if (isDbConnected) {
            await Category.findByIdAndDelete(req.params.id);
            await SubCategory.deleteMany({ categoryId: req.params.id });
            console.log('[DELETE /api/admin/categories/:id] Category deleted');
            res.json({ message: 'Deleted' });
        } else {
            res.status(501).json({ error: 'DB required' });
        }
    } catch (e) {
        console.error('[DELETE /api/admin/categories/:id] Error:', e.message, e.stack);
        res.status(500).json({ error: e.message });
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

app.post('/api/admin/subcategories', csrfProtection, isAdmin, async (req, res) => {
    console.log('[POST /api/admin/subcategories] Request received');
    try {
        const { name, categoryId } = req.body;
        if (!name || !categoryId) return res.status(400).json({ error: 'Name and CategoryId required' });

        if (isDbConnected) {
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            const sub = await SubCategory.create({ name, slug, categoryId });
            console.log('[POST /api/admin/subcategories] Subcategory created:', name);
            res.json(sub);
        } else {
            res.status(501).json({ error: 'DB required' });
        }
    } catch (e) {
        console.error('[POST /api/admin/subcategories] Error:', e.message, e.stack);
        res.status(500).json({ error: e.message });
    }
});




app.put('/api/admin/subcategories/:id', csrfProtection, isAdmin, async (req, res) => {
    console.log('[PUT /api/admin/subcategories/:id] Request received for:', req.params.id);
    try {
        if (isDbConnected) {
            const { name, categoryId } = req.body;
            const updates = { name, categoryId };
            if (name) updates.slug = name.toLowerCase().replace(/\s+/g, '-');

            const sub = await SubCategory.findByIdAndUpdate(req.params.id, updates, { new: true });
            console.log('[PUT /api/admin/subcategories/:id] Subcategory updated');
            res.json(sub);
        } else {
            res.status(501).json({ error: 'DB required' });
        }
    } catch (e) {
        console.error('[PUT /api/admin/subcategories/:id] Error:', e.message, e.stack);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/subcategories/:id', csrfProtection, isAdmin, async (req, res) => {
    console.log('[DELETE /api/admin/subcategories/:id] Request received for:', req.params.id);
    try {
        if (isDbConnected) {
            await SubCategory.findByIdAndDelete(req.params.id);
            console.log('[DELETE /api/admin/subcategories/:id] Subcategory deleted');
            res.json({ message: 'Deleted' });
        } else {
            res.status(501).json({ error: 'DB required' });
        }
    } catch (e) {
        console.error('[DELETE /api/admin/subcategories/:id] Error:', e.message, e.stack);
        res.status(500).json({ error: e.message });
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

app.post('/api/admin/brands', csrfProtection, isAdmin, async (req, res) => {
    console.log('[POST /api/admin/brands] Request received');
    try {
        const { name, logo, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });

        if (isDbConnected) {
            const slug = name.toLowerCase().replace(/\s+/g, '-');
            const brand = await Brand.create({ name, slug, logo, description });
            console.log('[POST /api/admin/brands] Brand created:', name);
            res.json(brand);
        } else {
            res.status(501).json({ error: 'DB required' });
        }
    } catch (e) {
        console.error('[POST /api/admin/brands] Error:', e.message, e.stack);
        if (e.code === 11000) return res.status(409).json({ error: 'Brand already exists' });
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/admin/brands/:id', csrfProtection, isAdmin, async (req, res) => {
    console.log('[PUT /api/admin/brands/:id] Request received for:', req.params.id);
    try {
        if (isDbConnected) {
            const { name, logo, description } = req.body;
            const updates = { name, logo, description };
            if (name) updates.slug = name.toLowerCase().replace(/\s+/g, '-');

            const brand = await Brand.findByIdAndUpdate(req.params.id, updates, { new: true });
            console.log('[PUT /api/admin/brands/:id] Brand updated');
            res.json(brand);
        } else {
            res.status(501).json({ error: 'DB required' });
        }
    } catch (e) {
        console.error('[PUT /api/admin/brands/:id] Error:', e.message, e.stack);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/brands/:id', csrfProtection, isAdmin, async (req, res) => {
    console.log('[DELETE /api/admin/brands/:id] Request received for:', req.params.id);
    try {
        if (isDbConnected) {
            await Brand.findByIdAndDelete(req.params.id);
            console.log('[DELETE /api/admin/brands/:id] Brand deleted');
            res.json({ message: 'Deleted' });
        } else {
            res.status(501).json({ error: 'DB required' });
        }
    } catch (e) {
        console.error('[DELETE /api/admin/brands/:id] Error:', e.message, e.stack);
        res.status(500).json({ error: e.message });
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
app.post('/api/admin/products', csrfProtection, isAdmin, async (req, res) => {
    console.log('[POST /api/admin/products] Request received');
    try {
        const { name, categoryId, subCategoryId, brandId, price, image, video, description, specs, active, isFeatured } = req.body;

        // Validation
        if (!name || !categoryId || !brandId || price === undefined) {
            return res.status(400).json({ error: 'Name, category, brand, and price are required' });
        }

        if (isDbConnected) {
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
            console.log('[POST /api/admin/products] Product created:', name);
            res.json(product);
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
            console.log('[POST /api/admin/products] Product created in memory:', name);
            res.json(newProduct);
        }
    } catch (e) {
        console.error('[POST /api/admin/products] Error:', e.message, e.stack);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Admin API: Update product
app.put('/api/admin/products/:id', csrfProtection, isAdmin, async (req, res) => {
    console.log('[PUT /api/admin/products/:id] Request received for:', req.params.id);
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.price !== undefined) {
            updates.price = parseFloat(updates.price);
        }

        // If categoryId changed, update legacy strings
        if (isDbConnected) {
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
            console.log('[PUT /api/admin/products/:id] Product updated');
            res.json(product);
        } else {
            const idx = memoryProducts.findIndex(p => p.id == id);
            if (idx === -1) return res.status(404).json({ error: 'Product not found' });
            memoryProducts[idx] = { ...memoryProducts[idx], ...updates };
            console.log('[PUT /api/admin/products/:id] Product updated in memory');
            res.json(memoryProducts[idx]);
        }
    } catch (e) {
        console.error('[PUT /api/admin/products/:id] Error:', e.message, e.stack);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Admin API: Delete product
app.delete('/api/admin/products/:id', csrfProtection, isAdmin, async (req, res) => {
    console.log('[DELETE /api/admin/products/:id] Request received for:', req.params.id);
    try {
        const { id } = req.params;

        if (isDbConnected) {
            const result = await Product.findByIdAndDelete(id);
            if (!result) return res.status(404).json({ error: 'Product not found' });
            console.log('[DELETE /api/admin/products/:id] Product deleted');
            res.json({ message: 'Product deleted' });
        } else {
            const idx = memoryProducts.findIndex(p => p.id == id);
            if (idx === -1) return res.status(404).json({ error: 'Product not found' });
            memoryProducts.splice(idx, 1);
            console.log('[DELETE /api/admin/products/:id] Product deleted from memory');
            res.json({ message: 'Product deleted' });
        }
    } catch (e) {
        console.error('[DELETE /api/admin/products/:id] Error:', e.message, e.stack);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ==================== SPA FALLBACK ====================

// For any request not handled by API, serve index.html
app.get(/(.*)/, (req, res) => {
    // Don't serve HTML for API 404s
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ==================== SERVER START ====================

app.listen(port, async () => {
    console.log(`Backend server listening at http://localhost:${port}`);
    console.log(`Frontend served from 'dist' folder`);

    // Seed products after DB connection is established
    if (process.env.MONGODB_URI || isDbConnected) {
        // Wait a moment for connection to establish
        setTimeout(async () => {
            await seedProductsToDb();
            await seedAdminUser();
        }, 2000);
    } else {
        // Memory mode
        setTimeout(async () => {
            await seedAdminUser(); // Seed admin to memory
        }, 1000);
    }
});
