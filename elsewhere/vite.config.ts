import { defineConfig } from 'vite';

// Single IIFE bundle so tools/makePlay.mjs can inline it into a self-contained PLAY.html.
export default defineConfig({
  base: './',
  server: { host: true, port: 5174 },
  build: {
    target: 'es2020',
    modulePreload: false,
    assetsInlineLimit: 1 << 20,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
