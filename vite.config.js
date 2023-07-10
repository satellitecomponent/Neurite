// vite.config.js
import typescript from '@rollup/plugin-typescript';

export default {
    base: './',
    plugins: [
        typescript({
            /* TypeScript options here */
        })
    ],
    build: {
        rollupOptions: {
            external: ['js/dropdown.js', 'js/zettelkasten.js', 'js/interface.js', 'js/ai.js']
        },
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