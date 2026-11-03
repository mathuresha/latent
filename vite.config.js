import { defineConfig } from 'vite';

// Relative base so the built site works at a domain root (Cloudflare Pages, Netlify, Vercel)
// and under a sub-path (GitHub Pages project sites) without changes.
export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
});
