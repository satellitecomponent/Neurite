// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        sourcemap: 'inline',
        target: 'esnext',
        minify: false
    },
    server: {
        port: 8080
    },
    worker: {
        format: 'es'
    }
});