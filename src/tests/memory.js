// VISUAL WORKING MEMORY
// Colour change detection (Luck & Vogel 1997 paradigm), single-probe. Adaptive: starts with 2 squares
// and adds squares as you get rounds right (3-down/1-up staircase, src/core/staircase.js). Capacity K is
// fitted over every round with Cowan's (2001) model, as in Rouder et al. (2008).
// Design, sources and assumptions: docs/NORMS.md ("Visual memory").

import { sleep } from '../core/audio.js';
import { normCdf, shuffle, rand } from '../core/stats.js';
import { makeStaircase } from '../core/staircase.js';
import { MEMORY_K_BIAS } from '../data/adaptive-calibration.js';
import { answerButtons, setProgress } from '../core/a11y.js';

export const meta = {
  id: 'memory',
  title: 'Visual memory',
  short: 'Memory',
  blurb: 'How many coloured squares can you hold in your head at once?',
  time: 'About 90 seconds',
  needsAudio: false,
  instructions: [
    'A set of coloured squares flashes up very briefly, then disappears.',
    'One square then reappears. Say whether its colour is the <b>same</b> or has <b>changed</b>.',
    'It starts with just 2 squares and adds more as you get them right.',
    '36 quick rounds.',
    '<b>This test uses colour.</b> If you are colour-blind, your result may not reflect your memory.',
  ],
  // shown under the result card
  resultNote: 'This test uses colour. If you are colour-blind, this result may not reflect your memory.',
  outperform: 'people hold fewer things in mind than you',
  growth: 'Everyone is sharp in different places. Try another test to find yours.',
  verb: 'memory',
};

// Set sizes from 2 to 6 squares (the 7 paradigm colours leave one spare for a change at 6; K = 5 is
// already past the Top 0.5% floor). Start at 2, add a square after every right answer until the first miss,
// then 3-down/1-up, which settles near 79% right: about 5 squares for a typical person (K about 3).
export const SET_SIZES = [2, 3, 4, 5, 6];
export const STAIR = { down: 3, warmupStep: 1 };
export const TRIALS = 36; // same / changed balanced in pairs
const SAMPLE_MS = 250;
const RETENTION_MS = 800;

// Population anchor: mean K = 2.45 at set size 6 (n=100 students, 250 ms / 1000 ms), typical
// lab values 3-4 for small arrays. We use 2.8 for this configuration. SD ASSUMED. See NORMS.md.
export const NORM = { meanK: 2.8, sdK: 0.85 };

// Stimulus colours and the grey field below are fixed on purpose: they are part of the paradigm the
// norms come from, so they do NOT change with the light/dark theme.
const COLORS = ['#e03131', '#1971c2', '#2f9e44', '#fcc419', '#9c36b5', '#111111', '#ffffff'];

// Cowan's model for one probe: with capacity K at set size S, the probed square is in memory with
// probability d = min(1, K/S); otherwise you guess "changed" with probability g.
export function pChanged(changed, S, K, g) {
  const d = Math.min(1, K / S);
  return changed ? d + (1 - d) * g : (1 - d) * g;
}

// Maximum-likelihood K (0 to 6) and guess rate g over every round, whatever set sizes were shown.
// For a single set size this gives the same K as Cowan's S * (H - F).
export function capacity(raw) {
  let best = null;
  for (let K = 0; K <= 6.0001; K += 0.02) {
    for (let g = 0.02; g < 0.99; g += 0.02) {
      let ll = 0;
      for (const b of raw.bySize) {
        const ph = Math.min(1 - 1e-6, Math.max(1e-6, pChanged(true, b.S, K, g)));
        const pf = Math.min(1 - 1e-6, Math.max(1e-6, pChanged(false, b.S, K, g)));
        ll += b.hits * Math.log(ph) + (b.changeTrials - b.hits) * Math.log(1 - ph)
            + b.falseAlarms * Math.log(pf) + (b.sameTrials - b.falseAlarms) * Math.log(1 - pf);
      }
      // ties (for example a perfect run) resolve to the smallest K that explains the data
      if (!best || ll > best.ll + 1e-9) best = { K, ll };
    }
  }
  return best.K;
}

export function score(raw) {
  // adaptive runs read K a little high; undo that measured bias (scripts/simulate.js)
  const K = Math.max(0, capacity(raw) - MEMORY_K_BIAS);
  const z = (K - NORM.meanK) / NORM.sdK;
  return { topPct: 100 * (1 - normCdf(z)), K, typicalK: NORM.meanK, maxSize: raw.maxSize };
}

export function detail(s) {
  return `You held about ${s.K.toFixed(1)} colours in mind at once, and reached ${s.maxSize} squares. Most people hold about ${s.typicalK.toFixed(1)}.`;
}

// Place n squares with minimum centre spacing inside w x h.
function layout(n, w, h, size, minDist) {
  const pts = [];
  let guard = 0;
  while (pts.length < n && guard++ < 5000) {
    const p = { x: rand(size, w - size), y: rand(size, h - size) };
    if (pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= minDist)) pts.push(p);
  }
  return pts.length === n ? pts : layout(n, w, h, size, minDist * 0.9);
}

export async function run(root) {
  const W = 340, H = 280, SQ = 34;
  root.innerHTML = `
    <canvas id="m-cv" class="stage" role="img" aria-label="Coloured squares flash here, then one comes back"></canvas>
    <div class="btnrow" role="group" aria-label="Is the square's colour the same or changed?">
      <button class="btn big" data-a="same" disabled aria-label="Same colour" aria-keyshortcuts="S">Same</button>
      <button class="btn big" data-a="changed" disabled aria-label="Colour changed" aria-keyshortcuts="C">Changed</button>
    </div>
    <p class="keys small">Keyboard: press S for same, C for changed.</p>
    <div class="feedback" id="m-fb" aria-live="polite"></div>
    <div class="progress" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="bar" id="m-bar"></div></div>`;
  const cv = root.querySelector('#m-cv');
  const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const fb = root.querySelector('#m-fb');
  const bar = root.querySelector('#m-bar');
  const btns = [...root.querySelectorAll('button')];
  const ab = answerButtons(btns);

  const bg = () => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, W, H); };
  const sq = (p, c) => { g.fillStyle = c; g.fillRect(p.x - SQ / 2, p.y - SQ / 2, SQ, SQ); };
  const fix = () => {
    bg(); g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(W / 2 - 8, H / 2); g.lineTo(W / 2 + 8, H / 2);
    g.moveTo(W / 2, H / 2 - 8); g.lineTo(W / 2, H / 2 + 8); g.stroke();
  };

  const answer = () => new Promise((res) => {
    const done = (a) => { window.removeEventListener('keydown', key); ab.disable(); res(a); };
    const key = (e) => {
      if (e.key === 's' || e.key === 'S') done('same');
      if (e.key === 'c' || e.key === 'C') done('changed');
    };
    window.addEventListener('keydown', key);
    btns.forEach((b) => { b.onclick = () => done(b.dataset.a); });
    ab.enable();
  });

  async function trial(changed, S) {
    if (!root.isConnected) throw new Error('aborted');
    fix(); await sleep(400);
    const pts = layout(S, W, H, SQ, SQ * 1.7);
    const cols = shuffle(COLORS).slice(0, S);
    bg(); pts.forEach((p, i) => sq(p, cols[i]));
    await sleep(SAMPLE_MS);
    fix(); await sleep(RETENTION_MS);
    const i = Math.floor(Math.random() * S);
    let probe = cols[i];
    if (changed) probe = shuffle(COLORS.filter((c) => !cols.includes(c)))[0];
    bg(); sq(pts[i], probe);
    const a = await answer();
    fix();
    return { changed, said: a };
  }

  // practice: 3 rounds with feedback, not scored
  for (let i = 0; i < 3; i++) {
    fb.textContent = `Practice ${i + 1} of 3`;
    const r = await trial(i === 1, [2, 3, 3][i]);
    const ok = (r.said === 'changed') === r.changed;
    fb.textContent = ok ? 'Right.' : 'Not quite. No feedback from the real rounds on.';
    await sleep(900);
  }
  fb.textContent = '';
  await sleep(600);

  // same / changed shuffled within each pair of rounds, so neither can run long
  const order = Array.from({ length: TRIALS / 2 }, () => shuffle([true, false])).flat();
  const stair = makeStaircase({ levels: SET_SIZES, start: 0, ...STAIR });
  const sizes = new Map();
  for (let i = 0; i < order.length; i++) {
    const S = stair.level;
    const r = await trial(order[i], S);
    const b = sizes.get(S) || sizes.set(S, { S, hits: 0, falseAlarms: 0, changeTrials: 0, sameTrials: 0 }).get(S);
    if (r.changed) { b.changeTrials++; if (r.said === 'changed') b.hits++; }
    else { b.sameTrials++; if (r.said === 'changed') b.falseAlarms++; }
    stair.update((r.said === 'changed') === r.changed);
    setProgress(bar, (i + 1) / order.length);
  }
  return { bySize: [...sizes.values()], maxSize: stair.peak };
}
