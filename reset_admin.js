/**
 * Yönetici hesabını oluşturur / şifresini sıfırlar.
 * Kullanım:  ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:reset
 * (veya değerleri .env dosyasına yazıp `npm run admin:reset`)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from './src/models/User.js';

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';

if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI tanımlı değil.');
    process.exit(1);
}
if (!email || password.length < 12) {
    console.error('ADMIN_EMAIL ve en az 12 karakterli ADMIN_PASSWORD tanımlayın.');
    process.exit(1);
}

try {
    await mongoose.connect(process.env.MONGODB_URI);
    const passwordHash = await bcrypt.hash(password, 12);
    await User.updateOne(
        { email },
        { $set: { passwordHash, isAdmin: true }, $setOnInsert: { email, name: 'Yönetici' } },
        { upsert: true }
    );
    // Eski demo yöneticisini (bilinen şifreli) devre dışı bırak
    const legacy = await User.updateOne({ email: 'admin@aquaflora.com', isAdmin: true }, { $set: { isAdmin: false } });
    console.log(`✅ Yönetici hazır: ${email.replace(/^(.{2}).*(@.*)$/, '$1***$2')}`);
    if (legacy.modifiedCount) console.log('🔒 Eski admin@aquaflora.com hesabının yönetici yetkisi kaldırıldı.');
    await mongoose.disconnect();
    process.exit(0);
} catch (e) {
    console.error('Hata:', e.message);
    process.exit(1);
}
