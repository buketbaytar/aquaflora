import Iyzipay from 'iyzipay';
import dotenv from 'dotenv';

dotenv.config();

const iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY,
    secretKey: process.env.IYZICO_SECRET_KEY,
    uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
});

export const initializePayment = async (user, cartItems, totalPrice, callbackUrl) => {
    return new Promise((resolve, reject) => {
        // Safety check: Warn if placeholder keys are used
        if (!process.env.IYZICO_API_KEY || process.env.IYZICO_API_KEY.includes('placeholder')) {
            console.error('❌ IYZICO_API_KEY is missing or is a placeholder. Payment will fail.');
            return reject(new Error('Payment gateway not configured. Please set valid iyzico credentials.'));
        }

        const request = {
            locale: Iyzipay.LOCALE.TR,
            conversationId: user.id + '_' + Date.now(),
            price: totalPrice.toFixed(2),
            paidPrice: totalPrice.toFixed(2),
            currency: Iyzipay.CURRENCY.TRY,
            basketId: 'B' + Date.now(),
            paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
            callbackUrl: callbackUrl,
            enabledInstallments: [2, 3, 6, 9],
            buyer: {
                id: user.id,
                name: user.name || 'John',
                surname: 'Doe', // Simplified: In a real app, we'd need surname
                gsmNumber: '+905350000000', // Simplified
                email: user.email,
                identityNumber: '74300864791', // Sandbox dummy
                lastLoginDate: '2023-01-01 12:00:00',
                registrationAddress: 'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
                ip: '85.34.78.112',
                city: 'Istanbul',
                country: 'Turkey',
                zipCode: '34732'
            },
            shippingAddress: {
                contactName: user.name || 'John Doe',
                city: 'Istanbul',
                country: 'Turkey',
                address: 'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
                zipCode: '34732'
            },
            billingAddress: {
                contactName: user.name || 'John Doe',
                city: 'Istanbul',
                country: 'Turkey',
                address: 'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
                zipCode: '34732'
            },
            basketItems: cartItems.map(item => ({
                id: item.id.toString(),
                name: item.name,
                category1: item.category || 'General',
                itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
                price: item.price.toFixed(2)
            }))
        };

        iyzipay.checkoutFormInitialize.create(request, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

export const retrievePaymentResult = async (token) => {
    return new Promise((resolve, reject) => {
        iyzipay.checkoutForm.retrieve({
            locale: Iyzipay.LOCALE.TR,
            conversationId: '123456789', // Not strictly checked for retrieval but good practice to track
            token: token
        }, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};
