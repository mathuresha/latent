// The Latent Worker. It serves the built site (dist/) and has one job of its own: counting anonymous
// usage events sent by src/core/analytics.js to POST /api/e.
//
// Each event is written to the Workers Analytics Engine dataset bound as EVENTS (see wrangler.toml) as:
//   blob1 = event name, blob2 = test id (or ''), blob3 = country code from Cloudflare (or '')
// Nothing else from the request is kept: no IP address, no user agent, no cookie, no ID.
// Only the names below are accepted, so the dataset can't fill up with junk.
// Read the totals with `npm run stats`.

const EVENTS = new Set([
  'open',          // the app loaded
  'test_open',     // a test's intro screen was opened
  'test_start',    // a test began (after the intro, and the sound check for pitch)
  'test_done',     // a test finished with a valid result
  'test_retry',    // a test finished but the run looked invalid, so the player was asked to retry
  'share',         // Share tapped on a result
  'save',          // Save card tapped on a result
  'how_we_score',  // the How we score page was opened
  'music_off',     // background music muted
  'music_on',      // background music turned back on
]);
const TESTS = new Set(['pitch', 'memory', 'rotation']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/e') return env.ASSETS.fetch(request);

    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    // only from our own pages
    const origin = request.headers.get('Origin');
    if (origin && new URL(origin).host !== url.host) return new Response(null, { status: 403 });

    let e = '', t = '';
    try {
      const text = await request.text();
      if (text.length > 200) throw new Error('too long');
      const d = JSON.parse(text);
      e = String(d.e || ''); t = String(d.t || '');
    } catch { return new Response(null, { status: 400 }); }
    if (!EVENTS.has(e) || (t && !TESTS.has(t))) return new Response(null, { status: 400 });

    try {
      env.EVENTS?.writeDataPoint({ indexes: [e], blobs: [e, t, request.cf?.country || ''], doubles: [1] });
    } catch { /* counting must never break the site */ }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  },
};
