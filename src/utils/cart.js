const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const Cart = {
    items: [],
    listeners: [],

    async init() {
        await this.fetchCart();
    },

    async fetchCart() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/cart`, { credentials: 'include' }).catch(() => ({ ok: false }));
            if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
                this.items = await res.json();
                this.notify();
            } else {
                this.items = [];
                this.notify();
            }
        } catch (e) {
            console.warn('Backend connection unavailable (fetchCart)');
            this.items = [];
            this.notify();
        }
    },

    async add(product, selectedVariant = null) {
        try {
            const body = { productId: product.id };
            if (selectedVariant) {
                body.selectedVariant = selectedVariant;
            }

            const res = await fetch(`${API_BASE_URL}/api/cart/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });

            if (res.ok) {
                this.items = await res.json();
                this.notify();
                const variantText = selectedVariant ? ` (Beden: ${selectedVariant})` : '';
                this.showToast(`${product.name}${variantText} sepete eklendi.`);
            } else {
                console.error('Failed to add to cart');
            }
        } catch (e) {
            console.error('Error adding to cart:', e);
        }
    },

    count() {
        return this.items.length;
    },

    subscribe(listener) {
        this.listeners.push(listener);
        // Initial callback with current items (if any, though probably empty until fetch)
        listener(this.items);
    },

    notify() {
        this.listeners.forEach(fn => fn(this.items));
    },

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification glass-panel slide-in-right';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
};

// Initialize on load
Cart.init();
