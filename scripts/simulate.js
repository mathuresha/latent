// Monte-Carlo checks and norm tables. Run with: npm run simulate
//  - Pitch and memory: how repeatable is a single run (test-retest r) under the stated population model,
//    for the adaptive design and (for comparison) the previous fixed design? Does the adaptive estimate
//    stay centred on the norm (no bias that would shift percentiles)?
//  - Rotation: builds src/data/rotation-norms.js from a population model calibrated on published
//    validation data (Ganis & Kievit 2015, N=54). See docs/NORMS.md for every assumption.

import fs from 'node:fs';
import { fitThreshold, LADDER, START_INDEX, STAIR as P_STAIR, TRIALS as P_TRIALS, NORM as PITCH } from '../src/tests/pitch.js';
import { NORM as MEM, TRIALS as MEM_TRIALS, SET_SIZES, STAIR as M_STAIR, pChanged, capacity as memCapacity } from '../src/tests/memory.js';
import { normCdf } from '../src/core/stats.js';
import { makeStaircase } from '../src/core/staircase.js';
import { ANGLES, STAIR as R_STAIR, POINTS, DURATION_MS } from '../src/data/rotation-design.js';

const randn = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const corr = (a, b) => {
  const n = a.length, ma = a.reduce((s, v) => s + v) / n, mb = b.reduce((s, v) => s + v) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb);
};
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const binom = (n, p) => { let k = 0; for (let i = 0; i < n; i++) if (Math.random() < p) k++; return k; };

// ---------------- PITCH ----------------
// Simulated listener: true 75% threshold drawn from the norm model; the psychometric exponent 1.4 checks
// robustness to a slope different from the one the fit assumes.
const pitchP = (x, th, expo) => 0.97 * normCdf(0.6745 * (x / th) ** expo) + 0.015;
function pitchAdaptive(th, expo) {
  const stair = makeStaircase({ levels: LADDER, start: START_INDEX, ...P_STAIR });
  const tally = new Map();
  for (let i = 0; i < P_TRIALS; i++) {
    const x = stair.level, ok = Math.random() < pitchP(x, th, expo);
    const t = tally.get(x) || tally.set(x, { x, n: 0, k: 0 }).get(x);
    t.n++; if (ok) t.k++;
    stair.update(ok);
  }
  return Math.log10(fitThreshold([...tally.values()]));
}
function pitchFixed(th, expo) { // previous design, for comparison: 5 fixed gaps x 8 rounds
  return Math.log10(fitThreshold([5, 2.5, 1.25, 0.6, 0.3].map((x) => ({ x, n: 8, k: binom(8, pitchP(x, th, expo)) }))));
}
const mean = (v) => v.reduce((s, x) => s + x) / v.length;
const calib = {};
for (const [label, run] of [['fixed (old)', pitchFixed], ['adaptive', pitchAdaptive]]) {
  for (const expo of [1, 1.4]) {
    const N = 4000, a = [], b = [], truth = [];
    for (let i = 0; i < N; i++) {
      const t = Math.log10(PITCH.medianPct) + PITCH.sdLog10 * randn();
      truth.push(t); a.push(run(10 ** t, expo)); b.push(run(10 ** t, expo));
    }
    const diff = a.map((v, i) => Math.abs(v - b[i]) / PITCH.sdLog10);
    const bias = median(a.map((v, i) => v - truth[i])); // log10 units
    if (label === 'adaptive' && expo === 1) calib.pitchLog10Bias = +bias.toFixed(3);
    console.log(`Pitch  ${label.padEnd(11)} exponent ${expo}: test-retest r = ${corr(a, b).toFixed(2)}; r with true = ${corr(a, truth).toFixed(2)}; median |difference| = ${median(diff).toFixed(2)} SD; estimates are x${(10 ** bias).toFixed(2)} the true threshold`);
  }
}

// ---------------- MEMORY ----------------
// Simulated person: capacity K from the norm model, guess rate g uniform 0.3-0.7 (ASSUMED).
const memSay = (changed, S, K, g) => Math.random() < pChanged(changed, S, K, g);
function memAdaptive(K, g) {
  const stair = makeStaircase({ levels: SET_SIZES, start: 0, ...M_STAIR });
  const sizes = new Map();
  for (let i = 0; i < MEM_TRIALS / 2; i++) {
    for (const changed of Math.random() < 0.5 ? [true, false] : [false, true]) {
      const S = stair.level, said = memSay(changed, S, K, g);
      const b = sizes.get(S) || sizes.set(S, { S, hits: 0, falseAlarms: 0, changeTrials: 0, sameTrials: 0 }).get(S);
      if (changed) { b.changeTrials++; if (said) b.hits++; } else { b.sameTrials++; if (said) b.falseAlarms++; }
      stair.update(said === changed);
    }
  }
  return memCapacity({ bySize: [...sizes.values()] });
}
function memFixed(K, g) { // previous design: 36 rounds at set size 5, K = S(H - F)
  const S = 5, n = MEM_TRIALS / 2;
  const H = binom(n, pChanged(true, S, K, g)), F = binom(n, pChanged(false, S, K, g));
  return Math.max(0, S * (H - F) / n);
}
for (const [label, run, N] of [['fixed (old)', memFixed, 4000], ['adaptive', memAdaptive, 3000]]) {
  const a = [], b = [], truth = [];
  for (let i = 0; i < N; i++) {
    const K = Math.max(0, MEM.meanK + MEM.sdK * randn()), g = 0.3 + 0.4 * Math.random();
    truth.push(K); a.push(run(K, g)); b.push(run(K, g));
  }
  const bias = mean(a.map((v, i) => v - truth[i]));
  if (label === 'adaptive') calib.memoryKBias = +bias.toFixed(2);
  console.log(`Memory ${label.padEnd(11)}: test-retest r = ${corr(a, b).toFixed(2)}; r with true K = ${corr(a, truth).toFixed(2)}; estimates average ${bias >= 0 ? '+' : ''}${bias.toFixed(2)} vs true K`);
}

// Adaptive runs misjudge scores slightly, in a predictable direction (the staircase decides which rounds
// you see based on your answers). The tests subtract this so percentiles stay centred on the published
// norms. Simulated with the assumptions above, so it inherits them.
fs.writeFileSync(
  new URL('../src/data/adaptive-calibration.js', import.meta.url),
  `// GENERATED by scripts/simulate.js. Bias of the adaptive estimates, see docs/NORMS.md. Do not edit by hand.\n` +
  `export const PITCH_LOG10_BIAS = ${calib.pitchLog10Bias};\nexport const MEMORY_K_BIAS = ${calib.memoryKBias};\n`
);
console.log(`wrote src/data/adaptive-calibration.js`, calib);

// ---------------- ROTATION ----------------
// Ganis & Kievit 2015, Table 1 (means), SDs recovered as SE * sqrt(54)
const MEAN_RT = { 0: 1801, 50: 2415, 100: 3026, 150: 3191 };
const ERR = { 0: 0.053, 50: 0.073, 100: 0.134, 150: 0.188 };
const SPEED_SD = 0.29;  // between-person CV of RT (SE*sqrt(54)/mean = 0.27-0.31)
const TRIAL_SD = 0.25;  // within-person trial-to-trial variation in RT: ASSUMED
const ACC_SD = 1.0;     // between-person sd on the logit of error: ASSUMED (matches reported error SE)
const OVERHEAD = 400;   // ms between trials (250 ms blank in the lab task + button/redraw)
const logit = (p) => Math.log(p / (1 - p));
const sigm = (x) => 1 / (1 + Math.exp(-x));

function rotationRun(person, adaptive = true) {
  let t = 0, correct = 0, wrong = 0, points = 0;
  const stair = makeStaircase({ levels: ANGLES, start: 0, ...R_STAIR });
  for (;;) {
    const angle = adaptive ? stair.level : ANGLES[Math.floor(Math.random() * 4)];
    const rt = MEAN_RT[angle] * person.speed * Math.exp(TRIAL_SD * randn() - TRIAL_SD ** 2 / 2) + OVERHEAD;
    t += rt;
    if (t > DURATION_MS) break;
    const ok = Math.random() >= sigm(logit(ERR[angle]) + person.acc);
    ok ? correct++ : wrong++;
    points += (ok ? 1 : -1) * (adaptive ? POINTS[angle] : 1);
    stair.update(ok);
  }
  return { net: Math.round(points * 10) / 10, correct };
}
const newPerson = () => ({ speed: Math.exp(SPEED_SD * randn() - SPEED_SD ** 2 / 2), acc: ACC_SD * randn() });

const N = 20000, nets = [], corrects = [], r1 = [], r2 = [], ability = [];
for (let i = 0; i < N; i++) {
  const p = newPerson();
  const x = rotationRun(p), y = rotationRun(p);
  nets.push(x.net); corrects.push(x.correct); r1.push(x.net); r2.push(y.net);
  ability.push(-Math.log(p.speed) - 0.3 * p.acc); // rough "true ability": faster and fewer errors
}
{ // previous fixed design, for comparison
  const a = [], b = [], ab = [];
  for (let i = 0; i < 5000; i++) { const p = newPerson(); a.push(rotationRun(p, false).net); b.push(rotationRun(p, false).net); ab.push(-Math.log(p.speed) - 0.3 * p.acc); }
  console.log(`Rotation fixed (old): test-retest r = ${corr(a, b).toFixed(2)}; r with ability = ${corr(a, ab).toFixed(2)}`);
}
console.log(`Rotation adaptive: r with ability = ${corr(r1, ability).toFixed(2)}`);
nets.sort((a, b) => a - b);
const Q = 2001;
const quantiles = Array.from({ length: Q }, (_, i) => nets[Math.min(N - 1, Math.round((i / (Q - 1)) * (N - 1)))]);
console.log(`Rotation adaptive: median net ${median(nets)}, median correct ${median(corrects)}, p5 ${nets[N * 0.05 | 0]}, p95 ${nets[N * 0.95 | 0]}, test-retest r = ${corr(r1, r2).toFixed(2)}`);

fs.writeFileSync(
  new URL('../src/data/rotation-norms.js', import.meta.url),
  `// GENERATED by scripts/simulate.js. Model-based norms, see docs/NORMS.md. Do not edit by hand.\n` +
  `export const MEDIAN_NET = ${median(nets)};\nexport const MEDIAN_CORRECT = ${median(corrects)};\n` +
  `export const QUANTILES = ${JSON.stringify(quantiles)};\n`
);
console.log('wrote src/data/rotation-norms.js');
