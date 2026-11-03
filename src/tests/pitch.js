// PITCH DISCRIMINATION
// Two pure tones, which one is higher? Fixed set of frequency gaps (method of constant
// stimuli, no adaptive staircase), then a maximum-likelihood threshold fit.
// Design, sources and assumptions: docs/NORMS.md ("Pitch").

import { playTone, sleep } from '../core/audio.js';
import { normCdf, clamp, rand, shuffle } from '../core/stats.js';

export const meta = {
  id: 'pitch',
  title: 'Pitch discrimination',
  short: 'Pitch',
  blurb: 'Which of two notes is higher? Tiny gaps, sharp ears.',
  time: 'About 90 seconds',
  needsAudio: true,
  instructions: [
    'You will hear two notes, one after the other.',
    'Tap which one was <b>higher</b>. Some gaps are tiny. Guess when you are unsure.',
    '40 short rounds. Headphones work best.',
  ],
  // wording used on the card
  outperform: 'people hear pitch less finely than you',
  growth: 'Pitch hearing improves with practice, so this is a starting line, not a ceiling.',
  verb: 'ear',
};

// Frequency differences tested, in % of the base frequency (geometric steps).
export const LEVELS = [5, 2.5, 1.25, 0.6, 0.3];
export const TRIALS_PER_LEVEL = 8;
export const PRACTICE_LEVEL = 10;
const LAPSE = 0.03;

// Population anchor: median untrained listener ~1.9% (resolved complex tones, adaptive 3AFC;
// non-musicians in Zatorre-lab fMRI sample), log-normal spread ASSUMED (SDs unpublished).
export const NORM = { medianPct: 1.9, sdLog10: 0.3, refHz: 440 };

// 2AFC signal-detection model: P(correct) = Phi(d'/sqrt2), d' proportional to the gap.
// Threshold = gap giving 75% correct (Phi(0.6745)). One free parameter, plus a small lapse rate.
export function pCorrect(x, th) {
  return (1 - LAPSE) * normCdf((0.6745 * x) / th) + LAPSE * 0.5;
}

export function fitThreshold(levels) {
  let best = null;
  for (let lt = Math.log(0.05); lt <= Math.log(30); lt += 0.01) {
    const th = Math.exp(lt);
    let ll = 0;
    for (const l of levels) {
      const p = clamp(pCorrect(l.x, th), 1e-6, 1 - 1e-6);
      ll += l.k * Math.log(p) + (l.n - l.k) * Math.log(1 - p);
    }
    if (!best || ll > best.ll) best = { th, ll };
  }
  return best.th;
}

export function score(raw) {
  const th = clamp(fitThreshold(raw.levels), 0.1, 30);
  const z = (Math.log10(th) - Math.log10(NORM.medianPct)) / NORM.sdLog10;
  const topPct = 100 * normCdf(z); // lower threshold = rarer
  return {
    topPct,
    thresholdPct: th,
    thresholdHz: (th / 100) * NORM.refHz,
    typicalHz: (NORM.medianPct / 100) * NORM.refHz,
  };
}

export function detail(s) {
  const hz = s.thresholdHz < 10 ? s.thresholdHz.toFixed(1) : Math.round(s.thresholdHz);
  const typ = Math.round(s.typicalHz);
  return `You could hear a ${hz} Hz gap between two notes. Most people need about ${typ} Hz.`;
}

export async function run(root) {
  root.innerHTML = `
    <div class="prompt" id="p-msg">Get ready…</div>
    <div class="btnrow">
      <button class="btn big" data-a="1" disabled>1 · First</button>
      <button class="btn big" data-a="2" disabled>2 · Second</button>
    </div>
    <div class="feedback" id="p-fb"></div>
    <div class="progress"><div class="bar" id="p-bar"></div></div>`;
  const msg = root.querySelector('#p-msg');
  const fb = root.querySelector('#p-fb');
  const bar = root.querySelector('#p-bar');
  const btns = [...root.querySelectorAll('button')];

  const answer = () => new Promise((res) => {
    const done = (a) => { window.removeEventListener('keydown', key); btns.forEach((b) => (b.disabled = true)); res(a); };
    const key = (e) => { if (e.key === '1' || e.key === '2') done(Number(e.key)); };
    window.addEventListener('keydown', key);
    btns.forEach((b) => { b.disabled = false; b.onclick = () => done(Number(b.dataset.a)); });
  });

  async function trial(x) {
    if (!root.isConnected) throw new Error('aborted');
    const base = 440 * (1 + rand(-0.05, 0.05)); // rove so absolute pitch memory does not help
    const hi = base * (1 + x / 100);
    const firstHigher = Math.random() < 0.5;
    msg.textContent = 'Listen…';
    playTone(firstHigher ? hi : base, 300, { when: 0.05 });
    await playTone(firstHigher ? base : hi, 300, { when: 0.05 + 0.3 + 0.35 });
    msg.textContent = 'Which note was higher?';
    const a = await answer();
    return a === (firstHigher ? 1 : 2);
  }

  // practice: two easy rounds with feedback, not scored
  for (let i = 0; i < 2; i++) {
    msg.textContent = `Practice ${i + 1} of 2`;
    await sleep(500);
    const ok = await trial(PRACTICE_LEVEL);
    fb.textContent = ok ? 'Right.' : 'Not that one. The higher note sounds thinner.';
    await sleep(900);
  }
  fb.textContent = '';
  msg.textContent = 'Now the real thing. No feedback from here.';
  await sleep(1400);

  const order = shuffle(LEVELS.flatMap((x) => Array(TRIALS_PER_LEVEL).fill(x)));
  const tally = new Map(LEVELS.map((x) => [x, { x, n: 0, k: 0 }]));
  for (let i = 0; i < order.length; i++) {
    const ok = await trial(order[i]);
    const t = tally.get(order[i]);
    t.n++; if (ok) t.k++;
    bar.style.width = `${((i + 1) / order.length) * 100}%`;
    await sleep(250);
  }
  return { levels: [...tally.values()] };
}
