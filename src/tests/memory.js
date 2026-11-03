// VISUAL WORKING MEMORY
// Colour change detection (Luck & Vogel 1997 paradigm), single-probe, capacity K = S * (H - F)
// (Cowan 2001). Design, sources and assumptions: docs/NORMS.md ("Visual memory").

import { sleep } from '../core/audio.js';
import { normCdf, shuffle, rand } from '../core/stats.js';

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
    '36 quick rounds. Uses colour, so it may be harder with some kinds of colour blindness.',
  ],
  outperform: 'people hold fewer things in mind than you',
  growth: 'Everyone is sharp in different places. Try another test to find yours.',
  verb: 'memory',
};

export const SET_SIZE = 5;
export const TRIALS = 36; // 18 same, 18 changed
const SAMPLE_MS = 250;
const RETENTION_MS = 800;

// Population anchor: mean K = 2.45 at set size 6 (n=100 students, 250 ms / 1000 ms), typical
// lab values 3-4 for small arrays. We use 2.8 for this configuration. SD ASSUMED. See NORMS.md.
export const NORM = { meanK: 2.8, sdK: 0.85 };

// Stimulus colours and the grey field below are fixed on purpose: they are part of the paradigm the
// norms come from, so they do NOT change with the light/dark theme.
const COLORS = ['#e03131', '#1971c2', '#2f9e44', '#fcc419', '#9c36b5', '#111111', '#ffffff'];

export function capacity(raw) {
  const H = raw.hits / raw.changeTrials;
  const F = raw.falseAlarms / raw.sameTrials;
  return Math.max(0, SET_SIZE * (H - F));
}

export function score(raw) {
  const K = capacity(raw);
  const z = (K - NORM.meanK) / NORM.sdK;
  return { topPct: 100 * (1 - normCdf(z)), K, typicalK: NORM.meanK };
}

export function detail(s) {
  return `You held about ${s.K.toFixed(1)} colours in mind at once. Most people hold about ${s.typicalK.toFixed(1)}.`;
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
    <canvas id="m-cv" class="stage"></canvas>
    <div class="btnrow">
      <button class="btn big" data-a="same" disabled>Same</button>
      <button class="btn big" data-a="changed" disabled>Changed</button>
    </div>
    <div class="feedback" id="m-fb"></div>
    <div class="progress"><div class="bar" id="m-bar"></div></div>`;
  const cv = root.querySelector('#m-cv');
  const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const fb = root.querySelector('#m-fb');
  const bar = root.querySelector('#m-bar');
  const btns = [...root.querySelectorAll('button')];

  const bg = () => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, W, H); };
  const sq = (p, c) => { g.fillStyle = c; g.fillRect(p.x - SQ / 2, p.y - SQ / 2, SQ, SQ); };
  const fix = () => {
    bg(); g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(W / 2 - 8, H / 2); g.lineTo(W / 2 + 8, H / 2);
    g.moveTo(W / 2, H / 2 - 8); g.lineTo(W / 2, H / 2 + 8); g.stroke();
  };

  const answer = () => new Promise((res) => {
    const done = (a) => { window.removeEventListener('keydown', key); btns.forEach((b) => (b.disabled = true)); res(a); };
    const key = (e) => {
      if (e.key === 's' || e.key === 'S') done('same');
      if (e.key === 'c' || e.key === 'C') done('changed');
    };
    window.addEventListener('keydown', key);
    btns.forEach((b) => { b.disabled = false; b.onclick = () => done(b.dataset.a); });
  });

  async function trial(changed) {
    if (!root.isConnected) throw new Error('aborted');
    fix(); await sleep(400);
    const pts = layout(SET_SIZE, W, H, SQ, SQ * 1.7);
    const cols = shuffle(COLORS).slice(0, SET_SIZE);
    bg(); pts.forEach((p, i) => sq(p, cols[i]));
    await sleep(SAMPLE_MS);
    fix(); await sleep(RETENTION_MS);
    const i = Math.floor(Math.random() * SET_SIZE);
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
    const r = await trial(i === 1);
    const ok = (r.said === 'changed') === r.changed;
    fb.textContent = ok ? 'Right.' : 'Not quite. No feedback from the real rounds on.';
    await sleep(900);
  }
  fb.textContent = '';
  await sleep(600);

  const order = shuffle(Array.from({ length: TRIALS }, (_, i) => i % 2 === 0));
  const raw = { hits: 0, falseAlarms: 0, changeTrials: 0, sameTrials: 0 };
  for (let i = 0; i < order.length; i++) {
    const r = await trial(order[i]);
    if (r.changed) { raw.changeTrials++; if (r.said === 'changed') raw.hits++; }
    else { raw.sameTrials++; if (r.said === 'changed') raw.falseAlarms++; }
    bar.style.width = `${((i + 1) / order.length) * 100}%`;
  }
  return raw;
}
