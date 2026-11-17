# Latent (MVP)

Three research-based perceptual tests that tell you how rare your result is, then give you a shareable
result card and (for strong results) starting points for a hobby. Runs entirely in the browser. No accounts,
and results never leave the device. The only thing collected is anonymous, cookie-free usage counts (see Usage analytics).

## Run it

Needs Node 18+.

```
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173). On a phone on the same Wi-Fi, use the "Network"
URL it prints. Sound needs a user tap first, which the sound check provides.

To try **Share** on a phone, use `npm run dev:phone` instead and open the `https://` Network URL. Phones
only offer the share sheet to https pages, so with plain `npm run dev` the Share button falls back to saving
the card. The phone will warn about the certificate the first time (it is made on your computer for
testing); tap Advanced and continue. The live site is https already.

`npm run build` makes a static `dist/` folder (about 40 KB) you can host anywhere. `npm run preview` serves it locally.

## Deploy (Cloudflare)

It is a static site plus a tiny Worker (`worker/index.js`) that only counts anonymous usage events; no
redirects needed (there is one page and no URL routing). Free plan is enough. It deploys as a Cloudflare Worker that serves static assets, which is
what the dashboard's Git flow creates. Config already in the repo:

- `vite.config.js`: `base: './'`, so the build works at a domain root or under a sub-path.
- `public/_headers`: long caching for `/assets/*` and a few safe security headers. Copied into `dist/`.
- `wrangler.toml`: Worker name `latent`, serves `./dist`, runs `worker/index.js` for `/api/e` and binds the
  `latent_events` Analytics Engine dataset. The name must match the project name in Cloudflare.
- `.node-version`: Node 20 for the Cloudflare build.

### Option A: connected to Git (rebuilds on every push)

Repo: https://github.com/mathuresha/latent

1. Cloudflare dashboard > Workers & Pages > Create > Import a repository, pick the repo.
2. Project name `latent`. Build command `npm run build`. Deploy command `npx wrangler deploy`. Root
   directory empty.
3. Deploy. The site appears at `https://latent.<your-subdomain>.workers.dev`. Every push to `main` redeploys.

### Option B: direct upload (no Git)

```
npx wrangler login        # once, opens the browser
npm run deploy            # builds, then runs: npx wrangler deploy
```

### Custom domain

In the project: Settings > Domains & Routes > Add > Custom domain. HTTPS is automatic.

The live site is https://playlatent.com (custom domain on the `latent` Worker). `SITE_URL` defaults to it in
`vite.config.js`; it is also set under Settings > Build > Variables and secrets so Git builds use it explicitly.

`www.playlatent.com` redirects to `https://playlatent.com` with a Cloudflare Redirect Rule, not in this repo
(a `_redirects` file can't match on hostname):

1. DNS > Records: `AAAA` record, name `www`, IPv6 `100::`, Proxied (orange cloud).
2. Rules > Redirect Rules > Create rule (or the "Redirect from WWW to root" template). If: Hostname equals
   `www.playlatent.com`. Then: Dynamic redirect, expression `concat("https://playlatent.com", http.request.uri.path)`,
   status 301, Preserve query string on.

### Other hosts

Netlify, Vercel and GitHub Pages work the same way: build command `npm run build`, output `dist`. Netlify also
reads `_headers`; the others ignore it. For GitHub Pages, upload `dist` with the Pages GitHub Action; the
relative base path already handles the `/<repo>/` sub-path.

## Usage analytics

Two cookie-free parts, both on Cloudflare (which already hosts the site). Neither stores IP addresses, IDs
or anything from a test result, and both are skipped for browsers set to Do Not Track or Global Privacy Control.
`npm run dev` sends nothing. Set `ANALYTICS=off` to turn both off.

- **Page views** (visitors, referrers, countries, browsers, page speed): Cloudflare Web Analytics. Set
  `CF_WEB_ANALYTICS_TOKEN` (in `.env` and in the Worker's build variables) to the site token from
  Analytics & Logs > Web Analytics. Don't also turn on its automatic setup, or views count twice.
- **Events** (which tests get opened, started, finished, shared): `src/core/analytics.js` sends an event name,
  and the test id, to `POST /api/e`; `worker/index.js` writes it, plus the country, to the Analytics Engine
  dataset `latent_events`. The full list of events is at the top of `worker/index.js`. Read the totals with
  `npm run stats` (or `npm run stats 30` for 30 days); it needs `CF_ACCOUNT_ID` and an `CF_API_TOKEN` with
  Account Analytics Read, kept in your local `.env` only.

On hosts other than Cloudflare the Worker doesn't run, so events are simply not counted.

## What is here

| Path | What |
| --- | --- |
| `src/tests/pitch.js`, `memory.js`, `rotation.js` | One file per test: task, scoring, norms and copy. Each owner can work alone. |
| `src/core/card.js` | Result card renderer (option 4, sticker style), 1080 x 1920 canvas. Uses the active theme's colours. |
| `src/core/theme.js` | Light / dark theme: follows the system until the user taps the toggle, then remembers the choice. Colours live as CSS variables in `src/styles.css`; canvas code reads them through `palette()`. |
| `src/core/staircase.js` | Adaptive difficulty shared by all three tests: start easy, harder after right answers, easier after a miss. |
| `src/core/share.js` | Share button: phone share sheet with card + message + link; where there is none, copies the card and message together and shows a short "copied" note. The link is `SITE_URL` from `vite.config.js`. |
| `src/core/music.js` | Two background tracks, both original and synthesised in the browser: a silly one for home, intros and results, a calmer one during the memory and rotation tests (no music in the pitch test). One remembered sound toggle covers music and effects. |
| `src/core/sfx.js` | Sound effects: tap pop, start gong, "time's up" chime, result fanfare. All synthesised except the gong, `src/assets/gong.mp3`: "Tao-Chi Gong" by the_very_Real_Horst, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:240382_the-very-real-horst_chinese-gong-finish-session-2014-06-10-29-143.wav), CC0 (public domain), trimmed to one 2.6 s strike. |
| `src/core/analytics.js`, `worker/index.js` | Anonymous usage counts (see Usage analytics). |
| `src/core/copy.js` | Turns a percentile into the words on the card. Holds the 0.5% rarity floor. |
| `src/data/hobbies.js` | Draft hobby lists. |
| `scripts/simulate.js` (`npm run simulate`) | Repeatability checks, the adaptive-bias corrections (`src/data/adaptive-calibration.js`) and the rotation norm table. Re-run after changing any test's design. |
| `vite.config.js`, `wrangler.toml`, `public/_headers` | Build and hosting config (see Deploy). |
| `docs/NORMS.md` | Sources, assumptions and known gaps for every percentile. Read this first. |

A test module exports `meta`, `run(root)` (returns raw data), `score(raw)` (returns `{topPct, ...}`) and
`detail(score)`. Add one to the `TESTS` list in `src/main.js` and it appears on the home screen.

## Not done yet

Direct "post to Instagram Story" (sharing goes through the phone's share sheet, with the card, a message and
the link; see `src/core/share.js`), the live deploy itself, name checks, privacy notice wording, real-player validation of the norms.

Add `?debug` to the URL to expose `window.__latent` in the console.
