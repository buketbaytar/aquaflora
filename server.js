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
import { User } from './src/models/User.js';
import { Cart } from './src/models/Cart.js';
import { Order } from './src/models/Order.js';
import { Product } from './src/models/Product.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL || 'https://dancing-halva-4bdea7.netlify.app';
const backendUrl = process.env.BACKEND_URL || `http://localhost:${port}`;

// CORS Ayarları - Production ve Local linkleri destekler
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://dancing-halva-4bdea7.netlify.app',
    'https://aquaflora.onrender.com',
    'https://aquaflora-frontend.onrender.com',
    process.env.FRONTEND_URL,
    process.env.CUSTOM_DOMAIN
].filter(Boolean);

// Database Connection
let isDbConnected = false;
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log('✅ MongoDB Connected');
            isDbConnected = true;
        })
        .catch(err => {
            console.error('❌ MongoDB Connection Error:', err.message);
            console.warn('⚠️ Server running without database. Persistence disabled.');
        });
} else {
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

app.use(bodyParser.json());
app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000,
    secure: true,
    httpOnly: true,
    sameSite: 'none'
}));

// In-memory Data Stores (Fallback)
const memoryUsers = [];
const memoryCarts = {};
const memoryOrders = [];
let memoryProducts = [...seedProducts]; // Copy for in-memory mode

// Seed Products to MongoDB (only if empty)
async function seedProductsToDb() {
    if (!isDbConnected) return;
    try {
        const count = await Product.countDocuments();
        if (count === 0) {
            console.log('📦 Seeding products to database...');
            for (const p of seedProducts) {
                // Parse price string to number
                let priceNum = 0;
                if (typeof p.price === 'string') {
                    priceNum = parseFloat(p.price.replace(' ₺', '').replace(/\./g, '').replace(',', '.'));
                } else {
                    priceNum = p.price;
                }
                await Product.create({
                    name: p.name,
                    category: p.category,
                    subCategory: p.subCategory,
                    brand: p.brand,
                    price: priceNum,
                    image: p.image,
                    video: p.video,
                    specs: p.specs,
                    active: true
                });
            }
            console.log('✅ Products seeded successfully');
        }
    } catch (e) {
        console.error('❌ Product seeding error:', e.message);
    }
}

// Helper to get products (from DB or memory)
async function getProducts(activeOnly = true) {
    if (isDbConnected) {
        try {
            const filter = activeOnly ? { active: true } : {};
            return await Product.find(filter).lean();
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
    const userData = isDbConnected ? { id: user._id, email: user.email, name: user.name } : { id: user.id, email: user.email, name: user.name };
    res.json(userData);
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
    const cartItems = items.map(item => {
        const product = products.find(p => p.id === item.productId);
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

            // Allow multiple same items? For simple list: just push. 
            // Ideally we check if item exists and inc qty, but requirements were simple list earlier.
            // Following previous logic: just push.
            cart.items.push({ productId: parseInt(productId) });
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
    const cartItems = items.map(item => {
        const product = products.find(p => p.id === item.productId);
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

// ==================== PUBLIC PRODUCTS API ====================

app.get('/api/products', async (req, res) => {
    const products = await getProducts(true);
    // Format price for display
    const formattedProducts = products.map(p => ({
        ...p,
        id: p._id || p.id,
        price: typeof p.price === 'number' ? p.price : parseFloat(p.price)
    }));
    res.json(formattedProducts);
});

app.get('/api/categories', (req, res) => {
    res.json(categories);
});

// ==================== ADMIN ROUTES ====================

// Serve admin page
app.get('/admin', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Admin API: List all products (including inactive)
app.get('/api/admin/products', isAdmin, async (req, res) => {
    const products = await getProducts(false);
    res.json(products);
});

// Admin API: Create product
app.post('/api/admin/products', isAdmin, async (req, res) => {
    const { name, category, subCategory, brand, price, image, video, description, specs, active } = req.body;

    if (!name || !category || price === undefined) {
        return res.status(400).json({ error: 'Name, category, and price are required' });
    }

    if (isDbConnected) {
        try {
            const product = await Product.create({
                name, category, subCategory, brand,
                price: parseFloat(price),
                image, video, description, specs,
                active: active !== false
            });
            res.json(product);
        } catch (e) {
            console.error('Create product error:', e.message);
            res.status(500).json({ error: 'Failed to create product' });
        }
    } else {
        const newProduct = {
            id: Date.now(),
            name, category, subCategory, brand,
            price: parseFloat(price),
            image, video, description, specs,
            active: active !== false
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

    if (isDbConnected) {
        try {
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

app.listen(port, async () => {
    console.log(`Backend server listening at http://localhost:${port}`);

    // Seed products after DB connection is established
    if (process.env.MONGODB_URI) {
        // Wait a moment for connection to establish
        setTimeout(seedProductsToDb, 2000);
    }
});
