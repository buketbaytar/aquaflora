import { defineConfig } from 'vite'

// Geliştirme: `npm run dev` (Vite, :5173) + `npm run server` (Express, :3000).
// /api istekleri Express'e yönlenir; tarayıcıdan bakıldığında aynı origin olduğu için çerez/CSRF sorunsuz çalışır.
export default defineConfig({
    server: {
        proxy: {
            '/api': { target: process.env.API_PROXY_TARGET || 'http://localhost:3000', changeOrigin: false },
            '/sitemap.xml': 'http://localhost:3000',
            '/robots.txt': 'http://localhost:3000'
        },
    },
    build: {
        target: 'es2020',
        sourcemap: false,
    },
})
