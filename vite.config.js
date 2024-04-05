// vite.config.js
export default {
    base: './',
    build: {
        sourcemap: 'inline',
        target: 'esnext',
        minify: false
    },
    esbuild: {
        jsxFactory: 'h',
        jsxFragment: 'Fragment'
    },
    server: {
        port: 8080
    }
};