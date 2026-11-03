# Latent (MVP)

Three research-based perceptual tests that tell you how rare your result is, then give you a shareable
result card and (for strong results) starting points for a hobby. Runs entirely in the browser. No server,
no accounts, nothing collected.

## Run it

Needs Node 18+.

```
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173). On a phone on the same Wi-Fi, use the "Network"
URL it prints. Sound needs a user tap first, which the sound check provides.

`npm run build` makes a static `dist/` folder (about 40 KB) you can host anywhere. `npm run preview` serves it locally.

## Deploy (Cloudflare)

It is a plain static site: no server, no environment variables, no redirects needed (there is one page and
no URL routing). Free plan is enough. It deploys as a Cloudflare Worker that serves static assets, which is
what the dashboard's Git flow creates. Config already in the repo:

- `vite.config.js`: `base: './'`, so the build works at a domain root or under a sub-path.
- `public/_headers`: long caching for `/assets/*` and a few safe security headers. Copied into `dist/`.
- `wrangler.toml`: Worker name `latent`, serves `./dist`. The name must match the project name in Cloudflare.
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

### Other hosts

Netlify, Vercel and GitHub Pages work the same way: build command `npm run build`, output `dist`. Netlify also
reads `_headers`; the others ignore it. For GitHub Pages, upload `dist` with the Pages GitHub Action; the
relative base path already handles the `/<repo>/` sub-path.

## What is here

| Path | What |
| --- | --- |
| `src/tests/pitch.js`, `memory.js`, `rotation.js` | One file per test: task, scoring, norms and copy. Each owner can work alone. |
| `src/core/card.js` | Result card renderer (option 4, sticker style), 1080 x 1920 canvas. Uses the active theme's colours. |
| `src/core/theme.js` | Light / dark theme: follows the system until the user taps the toggle, then remembers the choice. Colours live as CSS variables in `src/styles.css`; canvas code reads them through `palette()`. |
| `src/core/copy.js` | Turns a percentile into the words on the card. Holds the 0.5% rarity floor. |
| `src/data/hobbies.js` | Draft hobby lists. |
| `scripts/simulate.js` (`npm run simulate`) | Repeatability checks and the rotation norm table. |
| `vite.config.js`, `wrangler.toml`, `public/_headers` | Build and hosting config (see Deploy). |
| `docs/NORMS.md` | Sources, assumptions and known gaps for every percentile. Read this first. |

A test module exports `meta`, `run(root)` (returns raw data), `score(raw)` (returns `{topPct, ...}`) and
`detail(score)`. Add one to the `TESTS` list in `src/main.js` and it appears on the home screen.

## Not done yet

Instagram Story share (the card can be saved, and shared through the phone's share sheet where
supported), the live deploy itself, name checks, privacy notice wording, real-player validation of the norms.

Add `?debug` to the URL to expose `window.__latent` in the console.
