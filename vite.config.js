import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// The site's public address, with no trailing slash. Used for the canonical URL and link-preview tags in
// index.html (written there as __SITE_URL__), for robots.txt and sitemap.xml, and for the link people
// send when they share a result.
// CHANGE THIS to the real domain before launch, or to the workers.dev address until the domain is bought:
// link previews break if it points at a domain you don't own. A SITE_URL environment variable overrides it.
const SITE_URL = (process.env.SITE_URL || 'https://latent.mathuresha2001.workers.dev/').replace(/\/+$/, '');

// Relative base so the built site works at a domain root (Cloudflare Pages, Netlify, Vercel)
// and under a sub-path (GitHub Pages project sites) without changes.
export default defineConfig(({ mode }) => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    base: './',
    build: { outDir: 'dist' },
    // the same address for the app's own code (the link in a shared result, src/core/share.js)
    define: { __SITE_URL__: JSON.stringify(SITE_URL) },
    plugins: [
      // `npm run dev:phone`: serve over https on your Wi-Fi, because phones only offer the share sheet
      // (and a few other features) to https pages. Your phone will warn about the certificate once.
      ...(mode === 'phone' ? [basicSsl()] : []),
      {
        name: 'latent-seo-files',
        transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', SITE_URL),
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n` });
          this.emitFile({
            type: 'asset', fileName: 'sitemap.xml',
            source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod></url>\n</urlset>\n`,
          });
        },
      },
    ],
  };
});
