// Native fetch in Node 18+


const BASE_URL = 'http://localhost:3000';
const SESSION_COOKIE_NAME = 'session';
let sessionCookie = '';
let csrfToken = '';

async function runTest() {
    console.log('🚀 Starting System Verification Test...\n');

    try {
        // 1. Health Check
        console.log('1. Testing Health Endpoint...');
        const health = await fetch(`${BASE_URL}/health`).then(r => r.json());
        console.log('   ✅ Health OK:', health);

        // 2. Get CSRF Token
        console.log('\n2. Fetching CSRF Token...');
        const csrfRes = await fetch(`${BASE_URL}/api/csrf-token`);
        const csrfJson = await csrfRes.json();
        csrfToken = csrfJson.csrfToken;

        // Native Fetch Set-Cookie handling
        const cookieHeader = csrfRes.headers.get('set-cookie');
        console.log('   🔍 Step 2 Set-Cookie:', cookieHeader);
        if (cookieHeader) {
            sessionCookie = cookieHeader.split(';')[0];
        }
        console.log('   🔍 Step 3 Sending Cookie:', sessionCookie);

        if (!csrfToken) throw new Error('Failed to get CSRF Token');
        console.log('   ✅ CSRF Token Received');

        // 3. Register User
        console.log('\n3. Testing Registration...');
        const testUser = {
            email: `test${Date.now()}@example.com`,
            password: 'password123',
            name: 'Test User'
        };
        const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
                'Cookie': sessionCookie
            },
            body: JSON.stringify(testUser)
        });

        if (regRes.status === 403) {
            console.error('   ❌ 403 Forbidden. Body:', await regRes.text());
            throw new Error('CSRF Check Failed during Register');
        }
        if (!regRes.ok) throw new Error(`Register Failed: ${regRes.status} ${await regRes.text()}`);

        const regData = await regRes.json();
        const regCookies = regRes.headers.getSetCookie();
        if (regCookies.length > 0) {
            // Update session cookie (important for auth)
            sessionCookie = regCookies.map(c => c.split(';')[0]).join('; ');
        }
        console.log('   ✅ Register OK:', regData.email);

        // 4. Logout (to test login next)
        console.log('\n4. Testing Logout...');
        await fetch(`${BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken, 'Cookie': sessionCookie }
        });
        sessionCookie = ''; // Clear cookie
        console.log('   ✅ Logout OK');

        // 5. Login
        console.log('\n5. Testing Login...');
        // Need fresh CSRF/Session potentially? Usually CSRF token is per session, but let's reuse if valid or fetch new if needed. 
        // In this app, csrf is tied to session. If we wiped session, we might need a new handshake or just reusing the token if the secret hasn't changed?
        // Let's do a fresh CSRF fetch to be safe as if we are a fresh client.
        const csrfRes2 = await fetch(`${BASE_URL}/api/csrf-token`);
        csrfToken = (await csrfRes2.json()).csrfToken;
        const cookies2 = csrfRes2.headers.getSetCookie();
        if (cookies2.length > 0) sessionCookie = cookies2.map(c => c.split(';')[0]).join('; ');

        const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
                'Cookie': sessionCookie
            },
            body: JSON.stringify({ email: testUser.email, password: testUser.password })
        });

        if (!loginRes.ok) throw new Error(`Login Failed: ${loginRes.status} ${await loginRes.text()}`);
        const loginData = await loginRes.json();

        // Capture auth session
        const loginCookies = loginRes.headers.getSetCookie();
        if (loginCookies.length > 0) sessionCookie = loginCookies.map(c => c.split(';')[0]).join('; ');

        console.log('   ✅ Login OK:', loginData.email);

        // 6. Get Me (Verify Session)
        console.log('\n6. Testing /api/auth/me (Session Persistence)...');
        const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
            headers: {
                'Cookie': sessionCookie
            }
        });
        if (!meRes.ok) throw new Error(`Me Failed: ${meRes.status}`);
        const meData = await meRes.json();
        console.log('   ✅ Session Valid. Authenticated as:', meData.email);

        // 7. Get Products (Public)
        console.log('\n7. Testing Products API...');
        const prodRes = await fetch(`${BASE_URL}/api/products`);
        const products = await prodRes.json();
        console.log(`   ✅ Fetched ${products.length} products`);

        console.log('\n✨ ALL TESTS PASSED! System is fully functional.');

    } catch (e) {
        console.error('\n❌ TEST FAILED:', e.message);
        process.exit(1);
    }
}

runTest();
