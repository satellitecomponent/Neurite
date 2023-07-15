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