// MENTAL ROTATION
// Two block figures: is the right one the SAME figure turned, or its mirror image (different)?
// Shepard & Metzler (1971) paradigm; angles 0/50/100/150 deg about the vertical axis as in
// Ganis & Kievit (2015). 70-second timed run. Adaptive: starts with unturned shapes (0 deg) and turns
// them further as you get rounds right (2-down/1-up, src/core/staircase.js). Turned pairs are worth more
// points, in proportion to how long they take people in the lab, so climbing never costs you score.
// Score = points for right answers minus points for wrong ones (guess-corrected).
// Design, sources and assumptions: docs/NORMS.md ("Mental rotation").

import { sleep } from '../core/audio.js';
import { generateShape, mirror, drawShape, randomYaw } from '../core/shapes3d.js';
import { percentileFromQuantiles, pick } from '../core/stats.js';
import { makeStaircase } from '../core/staircase.js';
import { DURATION_MS, ANGLES, STAIR, POINTS } from '../data/rotation-design.js';
import { QUANTILES, MEDIAN_NET, MEDIAN_CORRECT } from '../data/rotation-norms.js';
import { answerButtons } from '../core/a11y.js';

export const meta = {
  id: 'rotation',
  title: 'Mental rotation',
  short: 'Rotation',
  blurb: 'Is that the same shape turned around, or a mirror twin?',
  time: '70 seconds, timed',
  needsAudio: false,
  instructions: [
    'Two block shapes appear. Is the right one the <b>same</b> shape just turned, or a mirror image (<b>different</b>)?',
    'It starts with shapes that are not turned at all, and turns them further as you get them right. Harder pairs score more.',
    'Go as fast as you can while staying accurate. You have <b>70 seconds</b>.',
    'Wrong answers cancel right ones, so do not just mash buttons.',
  ],
  outperform: 'people turn shapes in their head slower than you',
  growth: 'Everyone is sharp in different places. Try another test to find yours.',
  verb: 'spatial sense',
};

export { DURATION_MS, ANGLES, STAIR, POINTS };

// Guards against button mashing: answers are locked for the first 600 ms of each round, and a run
// that looks like guessing is not scored.
export const LOCK_MS = 600;
export function score(raw) {
  const answered = raw.correct + raw.wrong;
  if (answered < 8 || (answered >= 15 && raw.correct / answered < 0.62)) {
    return { invalid: 'That looked more like guessing than turning shapes. Give it another go, taking a moment to compare the two.' };
  }
  const net = Math.round(raw.points * 10) / 10;
  const pct = percentileFromQuantiles(QUANTILES, net);
  return { topPct: 100 - pct, net, correct: raw.correct, answered, maxAngle: raw.maxAngle, typicalCorrect: MEDIAN_CORRECT, typicalNet: MEDIAN_NET };
}

export function detail(s) {
  return `You solved ${s.correct} of ${s.answered} in ${DURATION_MS / 1000} seconds, with shapes turned up to ${s.maxAngle}°. That scores ${Math.round(s.net)} points; a typical person scores about ${Math.round(s.typicalNet)}.`;
}

export async function run(root) {
  root.innerHTML = `
    <div class="timer" id="r-timer" role="timer" aria-live="off">Practice</div>
    <div class="pair"><canvas class="shape" id="r-a" role="img" aria-label="Shape A"></canvas><canvas class="shape" id="r-b" role="img" aria-label="Shape B, turned"></canvas></div>
    <div class="btnrow" role="group" aria-label="Is shape B the same shape turned, or a mirror image?">
      <button class="btn big" data-a="same" disabled aria-label="Same shape, just turned" aria-keyshortcuts="S">Same</button>
      <button class="btn big" data-a="different" disabled aria-label="Different, a mirror image" aria-keyshortcuts="D">Different</button>
    </div>
    <p class="keys small">Keyboard: press S for same, D for different.</p>
    <div class="feedback" id="r-fb" aria-live="polite"></div>`;
  const ca = root.querySelector('#r-a'), cb = root.querySelector('#r-b');
  const timer = root.querySelector('#r-timer');
  const fb = root.querySelector('#r-fb');
  const btns = [...root.querySelectorAll('button')];
  const ab = answerButtons(btns);

  const pool = Array.from({ length: 10 }, () => generateShape());

  // resolves with 'same' | 'different', or null if the deadline passes first
  const answer = (deadline) => new Promise((res) => {
    let timeout = null;
    const unlock = setTimeout(() => ab.enable(), LOCK_MS);
    const unlockAt = performance.now() + LOCK_MS;
    const finish = (a) => {
      clearTimeout(timeout); clearTimeout(unlock); window.removeEventListener('keydown', key);
      ab.disable(); res(a);
    };
    const done = (a) => { if (performance.now() >= unlockAt) finish(a); };
    const key = (e) => {
      if (e.key === 's' || e.key === 'S') done('same');
      if (e.key === 'd' || e.key === 'D') done('different');
    };
    window.addEventListener('keydown', key);
    btns.forEach((b) => { b.onclick = () => done(b.dataset.a); });
    if (deadline) timeout = setTimeout(() => finish(null), Math.max(0, deadline - performance.now()));
  });

  async function trial(angle, deadline) {
    if (!root.isConnected) throw new Error('aborted');
    const shape = pick(pool);
    const same = Math.random() < 0.5;
    const yaw = randomYaw();
    const turn = (Math.random() < 0.5 ? -1 : 1) * angle;
    drawShape(ca, shape, yaw);
    drawShape(cb, same ? shape : mirror(shape), yaw + turn);
    const t0 = performance.now();
    const a = await answer(deadline);
    if (a === null) return null;
    return { correct: (a === 'same') === same, rt: performance.now() - t0, angle };
  }

  // practice: 3 untimed rounds with feedback
  for (const angle of [0, 100, 50]) {
    const r = await trial(angle, null);
    fb.textContent = r.correct ? 'Right.' : 'Not quite. Try to turn one shape in your head to line up with the other.';
    await sleep(1000);
  }
  fb.textContent = 'Timer starts after you tap Go.';
  const go = document.createElement('button');
  go.className = 'btn primary'; go.textContent = 'Go';
  root.querySelector('.btnrow').after(go);
  go.focus({ preventScroll: true });
  await new Promise((r) => (go.onclick = r));
  go.remove(); fb.textContent = '';

  const raw = { correct: 0, wrong: 0, points: 0, maxAngle: 0, byAngle: {} };
  const stair = makeStaircase({ levels: ANGLES, start: 0, ...STAIR });
  const deadline = performance.now() + DURATION_MS;
  const tick = setInterval(() => {
    timer.textContent = `${Math.max(0, Math.ceil((deadline - performance.now()) / 1000))} s`;
  }, 200);
  try {
    while (performance.now() < deadline) {
      const r = await trial(stair.level, deadline);
      if (!r) break;
      r.correct ? raw.correct++ : raw.wrong++;
      raw.points += (r.correct ? 1 : -1) * POINTS[r.angle];
      raw.maxAngle = Math.max(raw.maxAngle, r.angle);
      stair.update(r.correct);
      const b = (raw.byAngle[r.angle] ||= { n: 0, k: 0, rt: 0 });
      b.n++; b.rt += r.rt; if (r.correct) b.k++;
    }
  } finally { clearInterval(tick); }
  return raw;
}
