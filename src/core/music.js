// Silly background music for the tests: a bouncy "oom-pah" loop with a plinky marimba tune, woodblock
// ticks and a slide-whistle swoop at the end of each phrase. Original, composed for Latent and synthesised
// live with Web Audio, so there is no audio file and nothing to license.
//
// It plays only while a test is running (main.js starts and stops it), never during the pitch test (it
// would mask the tones being judged), and only after a tap, because browsers block sound until then.
// The mute choice is remembered in this browser.

import { getCtx } from './audio.js';

const KEY = 'latent.music';
const BPM = 140;
const STEP = 60 / BPM / 2; // one eighth note, in seconds
const LOOKAHEAD = 0.15; // seconds of notes scheduled ahead
const LEVEL = 0.16; // overall volume, kept well under the test sounds

let muted = false;
try { muted = localStorage.getItem(KEY) === 'off'; } catch { /* private mode */ }

let wanted = false; // a test that uses music is on screen
let bus = null; // gain node all notes go through; replaced on every start so stopping is instant
let timer = null;
let step = 0;
let nextTime = 0;
let noise = null;
const listeners = new Set();

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// 8 bars of 8 eighth notes. Chords: C F G C | C F G C. Melody notes: [step, midi].
const CHORDS = [[48, 55], [53, 60], [55, 62], [48, 55], [48, 55], [53, 60], [55, 62], [48, 55]];
const STABS = [[64, 67, 72], [65, 69, 72], [62, 67, 71], [64, 67, 72], [64, 67, 72], [65, 69, 72], [62, 67, 71], [64, 67, 72]];
const TUNE = [
  [0, 76], [2, 79], [3, 76], [4, 72], [6, 74], [7, 76],
  [8, 77], [10, 81], [11, 77], [12, 72], [14, 74], [15, 77],
  [16, 79], [18, 71], [19, 74], [20, 79], [22, 77], [23, 74],
  [24, 76], [25, 74], [26, 72], [28, 67], [30, 72],
  [32, 76], [34, 79], [35, 76], [36, 72], [38, 74], [39, 76],
  [40, 77], [42, 81], [43, 77], [44, 72], [46, 74], [47, 77],
  [48, 83], [49, 81], [50, 79], [51, 77], [52, 76], [53, 74], [54, 72], [55, 71],
  [56, 72], [58, 67], [60, 72],
];
const SWOOP_STEP = 61;
const LOOP = 64;

function env(c, t, peak, dur, attack = 0.004) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(bus);
  return g;
}

function osc(c, type, f, t, dur, out) {
  const o = c.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f, t);
  o.connect(out); o.start(t); o.stop(t + dur + 0.05);
  return o;
}

// marimba-ish plink: a triangle plus a quiet sine two octaves up that dies fast
function plink(c, f, t) {
  osc(c, 'triangle', f, t, 0.3, env(c, t, 0.5, 0.3));
  osc(c, 'sine', f * 4, t, 0.08, env(c, t, 0.12, 0.08));
}

// bouncy, slightly buzzy bass, like a bassoon on tiptoe
function bass(c, f, t) {
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 700;
  lp.connect(env(c, t, 0.55, 0.2, 0.008));
  osc(c, 'square', f, t, 0.2, lp);
}

// short off-beat chord "pah"
function stab(c, notes, t) {
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1600;
  lp.connect(env(c, t, 0.18, 0.1));
  notes.forEach((n) => osc(c, 'square', hz(n), t, 0.1, lp));
}

// woodblock tick
function tick(c, t) {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 8;
  s.connect(bp).connect(env(c, t, 0.5, 0.04, 0.002));
  s.start(t); s.stop(t + 0.05);
}

// slide whistle up, with a wobble
function swoop(c, t) {
  const o = osc(c, 'sine', hz(72), t, 0.42, env(c, t, 0.3, 0.42, 0.03));
  o.frequency.exponentialRampToValueAtTime(hz(86), t + 0.38);
  const lfo = c.createOscillator();
  const depth = c.createGain();
  lfo.frequency.value = 11; depth.gain.value = 18;
  lfo.connect(depth).connect(o.frequency);
  lfo.start(t); lfo.stop(t + 0.45);
}

function schedule(c, s, t) {
  const bar = Math.floor(s / 8), beat = s % 8;
  if (beat === 0) bass(c, hz(CHORDS[bar][0]), t);
  if (beat === 4) bass(c, hz(CHORDS[bar][1]), t);
  if (beat === 2 || beat === 6) { stab(c, STABS[bar], t); tick(c, t); }
  for (const [st, n] of TUNE) if (st === s) plink(c, hz(n), t);
  if (s === SWOOP_STEP) swoop(c, t);
}

function pump() {
  const c = getCtx();
  while (nextTime < c.currentTime + LOOKAHEAD) {
    schedule(c, step, nextTime);
    nextTime += STEP;
    step = (step + 1) % LOOP;
  }
}

function play() {
  if (timer || muted || !wanted || document.hidden) return;
  const c = getCtx();
  bus = c.createGain();
  bus.gain.setValueAtTime(0.0001, c.currentTime);
  bus.gain.exponentialRampToValueAtTime(LEVEL, c.currentTime + 0.4);
  bus.connect(c.destination);
  step = 0;
  nextTime = c.currentTime + 0.08;
  pump();
  timer = setInterval(pump, 30);
}

function silence() {
  clearInterval(timer); timer = null;
  if (!bus) return;
  const b = bus, c = getCtx();
  bus = null;
  b.gain.cancelScheduledValues(c.currentTime);
  b.gain.setValueAtTime(b.gain.value, c.currentTime);
  b.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.15);
  setTimeout(() => b.disconnect(), 250);
}

/** Start the loop for a test. Call from a tap (or straight after one) so the browser allows sound. */
export function startMusic() { wanted = true; play(); }

/** Stop the loop, for example when leaving a test. */
export function stopMusic() { wanted = false; silence(); }

export const isMuted = () => muted;

export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch { /* ignore */ }
  if (m) silence(); else play();
  listeners.forEach((f) => f(m));
}

/** Call f(muted) whenever the mute setting changes. */
export function onMuteChange(f) { listeners.add(f); return () => listeners.delete(f); }

// pause in a background tab (timers slow down there, which would make the loop stagger)
document.addEventListener('visibilitychange', () => { if (document.hidden) silence(); else play(); });
