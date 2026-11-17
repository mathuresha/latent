// `npm run stats [days]`: prints Latent's anonymous usage counts for the last N days (default 7).
//
// Reads the Workers Analytics Engine dataset that worker/index.js writes to. Needs two values, either as
// environment variables or in your local .env (never commit them):
//   CF_ACCOUNT_ID  Cloudflare dashboard > Workers & Pages: "Account ID" on the right
//   CF_API_TOKEN   My Profile > API Tokens > Create token > Custom token, permission
//                  Account > Account Analytics > Read
// Page views, referrers and countries are in the dashboard instead (Analytics & Logs > Web Analytics).

import { readFileSync } from 'node:fs';

const env = { ...process.env };
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env */ }

const { CF_ACCOUNT_ID, CF_API_TOKEN } = env;
if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
  console.error('Set CF_ACCOUNT_ID and CF_API_TOKEN (in .env or the environment). See the top of scripts/stats.js.');
  process.exit(1);
}
const days = Math.max(1, Math.min(90, parseInt(process.argv[2], 10) || 7));
const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;

async function sql(query) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql`, {
    method: 'POST', headers: { Authorization: `Bearer ${CF_API_TOKEN}` }, body: `${query} FORMAT JSON`,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Cloudflare said ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text).data;
}

// Analytics Engine may sample at high volume; _sample_interval scales each row back up.
const byEvent = await sql(`SELECT blob1 AS event, blob2 AS test, SUM(_sample_interval) AS n FROM latent_events WHERE ${since} GROUP BY event, test ORDER BY n DESC`);
const byDay = await sql(`SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, SUM(_sample_interval) AS n FROM latent_events WHERE ${since} AND blob1 = 'open' GROUP BY day ORDER BY day`);
const byCountry = await sql(`SELECT blob3 AS country, SUM(_sample_interval) AS n FROM latent_events WHERE ${since} AND blob1 = 'open' GROUP BY country ORDER BY n DESC LIMIT 10`);

const count = (e, t = '') => Number(byEvent.find((r) => r.event === e && r.test === t)?.n || 0);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
const pad = (s, w) => String(s).padEnd(w);

console.log(`\nLatent, last ${days} day${days > 1 ? 's' : ''}\n`);
console.log(`App opens        ${count('open')}`);
console.log(`How we score     ${count('how_we_score')}`);
console.log(`Music muted      ${count('music_off')}  (turned back on ${count('music_on')})\n`);

console.log(pad('Test', 10) + pad('Opened', 8) + pad('Started', 9) + pad('Finished', 10) + pad('Retry', 7) + pad('Exited', 8) + pad('Shared', 8) + pad('Saved', 7) + 'Finish rate');
for (const t of ['pitch', 'memory', 'rotation']) {
  const st = count('test_start', t), dn = count('test_done', t);
  console.log(pad(t, 10) + pad(count('test_open', t), 8) + pad(st, 9) + pad(dn, 10) + pad(count('test_retry', t), 7)
    + pad(count('test_exit', t), 8) + pad(count('share', t), 8) + pad(count('save', t), 7) + pct(dn, st));
}

console.log('\nOpens per day');
for (const r of byDay) console.log(`  ${String(r.day).slice(0, 10)}  ${r.n}`);
console.log('\nTop countries (opens)');
for (const r of byCountry) console.log(`  ${pad(r.country || '??', 4)} ${r.n}`);
console.log('');
