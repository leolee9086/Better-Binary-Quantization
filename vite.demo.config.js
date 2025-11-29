const { defineConfig } = require('vite');
const path = require('path');

module.exports = defineConfig({
    root: 'demo',
    base: './',
    build: {
        outDir: path.resolve(__dirname, 'docs'),
        emptyOutDir: true,
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    }
});
