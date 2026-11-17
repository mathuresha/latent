// PITCH DISCRIMINATION
// Two pure tones, which one is higher? Adaptive: the gap starts large and shrinks as you get rounds
// right (3-down/1-up staircase, src/core/staircase.js), then a maximum-likelihood threshold fit on
// every round.
// Design, sources and assumptions: docs/NORMS.md ("Pitch").

import { playTone, sleep } from '../core/audio.js';
import { normCdf, clamp, rand } from '../core/stats.js';
import { makeStaircase } from '../core/staircase.js';
import { PITCH_LOG10_BIAS } from '../data/adaptive-calibration.js';
import { answerButtons, setProgress } from '../core/a11y.js';

export const meta = {
  id: 'pitch',
  title: 'Pitch discrimination',
  short: 'Pitch',
  blurb: 'Which of two notes is higher? Tiny gaps, sharp ears.',
  time: 'About a minute',
  needsAudio: true,
  instructions: [
    'You will hear two notes, one after the other.',
    'Tap which one was <b>higher</b>. It starts easy and the gap shrinks as you get them right. Guess when you are unsure.',
    '30 short rounds. Headphones work best.',
  ],
  // wording used on the card
  outperform: 'people hear pitch less finely than you',
  growth: 'Pitch hearing improves with practice, so this is a starting line, not a ceiling.',
  verb: 'ear',
  shareAs: 'ear for pitch',
};

// Ladder of frequency differences, in % of the base frequency: 20% down to about 0.1%, each step a
// factor of sqrt(2). Real rounds start at 10% (easy for almost everyone), get one step harder per right
// answer until the first miss, then 3-down/1-up (settles near 79% right). In simulation this was the most
// repeatable of the rules we tried (see scripts/simulate.js).
export const LADDER = Array.from({ length: 16 }, (_, k) => +(20 / Math.SQRT2 ** k).toPrecision(3));
export const START_INDEX = 2; // 10%
export const TRIALS = 30;
export const STAIR = { down: 3, warmupStep: 1 };
export const PRACTICE_LEVEL = 20;
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
  // the fit on staircase data reads a little low; undo that measured bias (scripts/simulate.js)
  const th = clamp(fitThreshold(raw.levels) / 10 ** PITCH_LOG10_BIAS, 0.1, 30);
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
    <div class="arena">
      <div class="prompt big-prompt" id="p-msg" aria-live="polite">Get ready…</div>
      <div class="feedback" id="p-fb" aria-live="polite"></div>
    </div>
    <div class="controls">
    <div class="btnrow" role="group" aria-label="Which note was higher?">
      <button class="btn big" data-a="1" disabled aria-label="The first note was higher" aria-keyshortcuts="1">1 · First</button>
      <button class="btn big" data-a="2" disabled aria-label="The second note was higher" aria-keyshortcuts="2">2 · Second</button>
    </div>
    <p class="keys small">Keyboard: press 1 or 2.</p>
    <div class="progress" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="bar" id="p-bar"></div></div>
    </div>`;
  const msg = root.querySelector('#p-msg');
  const fb = root.querySelector('#p-fb');
  const bar = root.querySelector('#p-bar');
  const btns = [...root.querySelectorAll('button')];
  const ab = answerButtons(btns);

  const answer = () => new Promise((res) => {
    const done = (a) => { window.removeEventListener('keydown', key); ab.disable(); res(a); };
    const key = (e) => { if (e.key === '1' || e.key === '2') done(Number(e.key)); };
    window.addEventListener('keydown', key);
    btns.forEach((b) => { b.onclick = () => done(Number(b.dataset.a)); });
    ab.enable();
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

  const stair = makeStaircase({ levels: LADDER, start: START_INDEX, ...STAIR });
  const tally = new Map();
  for (let i = 0; i < TRIALS; i++) {
    const x = stair.level;
    const ok = await trial(x);
    const t = tally.get(x) || tally.set(x, { x, n: 0, k: 0 }).get(x);
    t.n++; if (ok) t.k++;
    stair.update(ok);
    setProgress(bar, (i + 1) / TRIALS);
    await sleep(250);
  }
  return { levels: [...tally.values()], finest: stair.peak };
}
