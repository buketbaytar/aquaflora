

const BASE_URL = 'http://localhost:3000';
let adminCookie = '';
let brandIdNike = '';
let productId = '';

async function run() {
    try {
        console.log('--- 1. Login as Admin ---');
        // Assuming memory mode or seeded admin for now, but let's try to login
        // Server seeds admin@aquaflora.com / admin123
        const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@aquaflora.com', password: 'admin123' })
        });

        if (!loginRes.ok) {
            console.error('Login failed:', await loginRes.text());
            return;
        }

        // Capture cookie
        const rawCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
        adminCookie = rawCookies ? rawCookies.map((entry) => entry.split(';')[0]).join('; ') : '';
        console.log('Logged in. Cookie:', adminCookie ? 'Captured' : 'None?');

        const headers = {
            'Content-Type': 'application/json',
            'Cookie': adminCookie
        };

        console.log('\n--- 2. Create Brand: Nike ---');
        const nikeRes = await fetch(`${BASE_URL}/api/admin/brands`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: 'Nike',
                description: 'Just Do It',
                logo: 'https://example.com/nike.png'
            })
        });
        const nikeData = await nikeRes.json();
        console.log('Create Nike Result:', nikeData);
        brandIdNike = nikeData._id || nikeData.id;

        console.log('\n--- 3. Create Brand: Adidas ---');
        const adidasRes = await fetch(`${BASE_URL}/api/admin/brands`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: 'Adidas',
                description: 'Impossible is Nothing',
                logo: 'https://example.com/adidas.png'
            })
        });
        const adidasData = await adidasRes.json();
        console.log('Create Adidas Result:', adidasData);

        console.log('\n--- 4. List Brands ---');
        const listRes = await fetch(`${BASE_URL}/api/brands`);
        const listData = await listRes.json();
        console.log('Brands Count:', listData.length);
        console.log('Brand Names:', listData.map(b => b.name).join(', '));

        console.log('\n--- 5. Create Product with Nike Brand ---');
        // Need a valid category ID first, let's fetch one
        const catRes = await fetch(`${BASE_URL}/api/categories`);
        const cats = await catRes.json();
        const catId = cats[0]?.id || cats[0]?._id; // Adapt to API response format
        console.log('Using Category ID:', catId);

        if (!catId) {
            console.error('No categories found to create product');
            // Try to create one?
            return;
        }

        const productRes = await fetch(`${BASE_URL}/api/admin/products`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: 'Air Max 90',
                price: 2999,
                categoryId: catId,
                brandId: brandIdNike,
                description: 'Iconic sneaker',
                active: true
            })
        });
        const productData = await productRes.json();
        console.log('Create Product Result Code:', productRes.status);
        console.log('Product Data:', productData);
        productId = productData._id || productData.id;

        console.log('\n--- 6. Verify Product Brand Population (Admin API) ---');
        const prodListRes = await fetch(`${BASE_URL}/api/admin/products`, { headers });
        const prodList = await prodListRes.json();
        const myProd = prodList.find(p => (p._id || p.id) == productId);
        console.log('Product in Admin List:', myProd ? 'Found' : 'Not Found');
        if (myProd) {
            console.log('Product Brand Field (Legacy/Display check):', myProd.brand);
            console.log('Product BrandId Field:', myProd.brandId);
        }

    } catch (e) {
        console.error('Test Error:', e);
    }
}

run();
