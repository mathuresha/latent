// Usage counts, without tracking people.
//
// Two parts, both on Cloudflare (which already hosts the site), both cookie-free:
//   1. Cloudflare Web Analytics: page views, referrers, countries, browsers and page speed. Its small
//      script is added only when CF_WEB_ANALYTICS_TOKEN is set at build time (see vite.config.js).
//   2. Our own event counts: a handful of named moments (a test started, a card shared...). Each one is a
//      tiny POST to /api/e on our own domain, which the Worker (worker/index.js) adds to a Workers
//      Analytics Engine dataset. `npm run stats` reads the totals back.
//
// What an event carries: its name and, for test events, which test. Nothing else: no score or rarity,
// no name, no ID, no cookie, nothing stored in the browser. The Worker adds the country Cloudflare
// already knows from the request and throws the rest of the request away (the IP address is never stored).
// Browsers set to "Do Not Track" or Global Privacy Control send nothing, not even the page view.
// Off in `npm run dev`, and everywhere when ANALYTICS=off.

/* global __ANALYTICS__, __CF_BEACON_TOKEN__ */
const ON = typeof __ANALYTICS__ !== 'undefined' && __ANALYTICS__ && !import.meta.env.DEV;
const TOKEN = typeof __CF_BEACON_TOKEN__ === 'string' ? __CF_BEACON_TOKEN__ : '';
const ENDPOINT = '/api/e';

const optedOut = () => {
  try { return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1'; }
  catch { return false; }
};
const enabled = ON && !optedOut();

/** Load Cloudflare's page-view script, if a token was set for this build. Call once at start-up. */
export function startAnalytics() {
  if (!enabled || !TOKEN) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token: TOKEN, spa: false });
  document.head.append(s);
}

/**
 * Count one event. `test` is a test id ('pitch' | 'memory' | 'rotation') for test events.
 * Never throws and never waits: a blocked or failed request just isn't counted.
 */
export function track(event, test) {
  if (!enabled) return;
  const body = JSON.stringify(test ? { e: event, t: test } : { e: event });
  try {
    // text/plain keeps it a "simple" request (no preflight); sendBeacon survives the page closing
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
    fetch(ENDPOINT, { method: 'POST', body, keepalive: true, credentials: 'omit' }).catch(() => {});
  } catch { /* ignore */ }
}
