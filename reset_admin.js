
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function resetAdmin() {
    if (!process.env.MONGODB_URI) {
        console.log('No MONGODB_URI, skipping DB reset');
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const email = 'admin@aquaflora.com';
        await User.deleteOne({ email });
        console.log('Deleted existing admin');

        const passwordHash = await bcrypt.hash('admin123', 10);
        await User.create({
            email,
            passwordHash,
            name: 'Admin User',
            isAdmin: true
        });
        console.log('Created new admin: admin@aquaflora.com / admin123');

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

resetAdmin();
