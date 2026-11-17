import { defineConfig, loadEnv } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// The site's public address, with no trailing slash. Used for the canonical URL and link-preview tags in
// index.html (written there as __SITE_URL__), for robots.txt and sitemap.xml, and for the link people
// send when they share a result.
// Set it as SITE_URL in a .env file next to this one (copy .env.example; .env is not committed), or as a
// SITE_URL environment variable on the host (Cloudflare: Settings > Build > Variables). If neither is set,
// the address below is used. Link previews break if it points at a domain you don't own.
const DEFAULT_SITE_URL = 'https://playlatent.com';

// Usage analytics (src/core/analytics.js). Both settings work like SITE_URL: a .env line or a host variable.
//   CF_WEB_ANALYTICS_TOKEN  the site token from Cloudflare > Analytics & Logs > Web Analytics. Adds the
//                           page-view script. Leave it empty to skip page views. It is public (it ends up
//                           in the page), so it is fine in .env.example and in build logs.
//   ANALYTICS=off           turns off everything: page views and our own event counts.

// Relative base so the built site works at a domain root (Cloudflare Pages, Netlify, Vercel)
// and under a sub-path (GitHub Pages project sites) without changes.
export default defineConfig(({ mode }) => {
  // reads .env, .env.local and .env.[mode], plus real environment variables (which win)
  const env = loadEnv(mode, process.cwd(), '');
  const SITE_URL = (env.SITE_URL || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const ANALYTICS = (env.ANALYTICS || 'on').trim().toLowerCase() !== 'off';
  const CF_BEACON_TOKEN = ANALYTICS ? (env.CF_WEB_ANALYTICS_TOKEN || '').trim() : '';
  return {
    base: './',
    build: { outDir: 'dist' },
    // the same address for the app's own code (the link in a shared result, src/core/share.js),
    // and the analytics settings for src/core/analytics.js
    define: {
      __SITE_URL__: JSON.stringify(SITE_URL),
      __ANALYTICS__: JSON.stringify(ANALYTICS),
      __CF_BEACON_TOKEN__: JSON.stringify(CF_BEACON_TOKEN),
    },
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
