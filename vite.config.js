import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    server: {
        proxy: {
            '/api': {
                target: process.env.VITE_API_URL || 'http://localhost:10000',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                urunler: resolve(__dirname, 'urunler.html'),
            },
        },
    },
})