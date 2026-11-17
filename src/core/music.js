// Background music, two tracks. Both original, composed for Latent and synthesised live with Web Audio, so
// there is no audio file and nothing to license.
//   home: silly and bouncy. An "oom-pah" loop with a plinky marimba tune, woodblock ticks and a
//         slide-whistle swoop at the end of each phrase. Home page, test intros and result screens.
//   test: calmer "thinking" groove with no tune to follow: a soft A-minor bass line, a ticking bell
//         arpeggio and a quiet shaker. Only while the memory and rotation tests run, so it doesn't distract.
//
// main.js picks the track for each screen. Changing track stops the old one first (with a gap for the
// start gong or the result sound in between), so two tracks or a track and an effect never pile up. Never in the pitch test or its sound check (it would mask the tones being judged).
// Browsers block sound until the visitor taps or presses a key, so nothing plays until then: the first tap
// anywhere on the page starts it. The one sound toggle covers the music and the effects (src/core/sfx.js),
// and the choice is remembered in this browser.

import { getCtx } from './audio.js';

const KEY = 'latent.music';
const LOOKAHEAD = 0.15; // seconds of notes scheduled ahead

let muted = false;
try { muted = localStorage.getItem(KEY) === 'off'; } catch { /* private mode */ }

let wanted = false; // a screen that has music is showing
let unlocked = false; // the visitor has tapped or pressed a key, so the browser allows sound
let delay = 0; // seconds to wait before the loop starts (lets the start gong or result sound play first)
let want = 'home'; // the track this screen asks for
let playing = null; // the track that is playing now
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
function tick(c, t, { freq = 2400, q = 8, peak = 0.5, dur = 0.04 } = {}) {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  s.connect(bp).connect(env(c, t, peak, dur, 0.002));
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

function scheduleHome(c, s, t) {
  const bar = Math.floor(s / 8), beat = s % 8;
  if (beat === 0) bass(c, hz(CHORDS[bar][0]), t);
  if (beat === 4) bass(c, hz(CHORDS[bar][1]), t);
  if (beat === 2 || beat === 6) { stab(c, STABS[bar], t); tick(c, t); }
  for (const [st, n] of TUNE) if (st === s) plink(c, hz(n), t);
  if (s === SWOOP_STEP) swoop(c, t);
}

// ---- test track: 8 bars of 8 eighth notes, Am F C G | Am F G E, 104 bpm ----------------------------
const T_BASS = [45, 41, 48, 43, 45, 41, 43, 40];
const T_ARP = [[69, 72, 76], [65, 69, 72], [67, 72, 76], [67, 71, 74], [69, 72, 76], [65, 69, 72], [67, 71, 74], [68, 71, 76]];
const T_ORDER = [0, 1, 2, 1, 0, 2, 1, 2];

// round, soft bass
function softBass(c, f, t, dur) {
  osc(c, 'triangle', f, t, dur, env(c, t, 0.6, dur, 0.02));
}
// small bell: sine with a quiet overtone, quick decay
function bell(c, f, t, peak) {
  osc(c, 'sine', f, t, 0.35, env(c, t, peak, 0.35, 0.003));
  osc(c, 'sine', f * 3, t, 0.12, env(c, t, peak * 0.15, 0.12, 0.002));
}
// shaker: high, filtered noise
function shaker(c, t, peak) {
  tick(c, t, { freq: 7000, q: 1.2, peak, dur: 0.05 });
}

function scheduleTest(c, s, t) {
  const bar = Math.floor(s / 8), beat = s % 8;
  const root = hz(T_BASS[bar]);
  if (beat === 0) softBass(c, root, t, 0.5);
  if (beat === 3) softBass(c, root, t, 0.25);
  if (beat === 6) softBass(c, root * 1.5, t, 0.3);
  bell(c, hz(T_ARP[bar][T_ORDER[beat]]), t, beat % 2 ? 0.14 : 0.24);
  shaker(c, t, beat % 2 ? 0.22 : 0.1);
}

const TRACKS = {
  home: { bpm: 140, loop: 64, level: 0.16, schedule: scheduleHome },
  test: { bpm: 104, loop: 64, level: 0.15, schedule: scheduleTest },
};

function pump() {
  const c = getCtx(), tr = TRACKS[playing];
  const stepLen = 60 / tr.bpm / 2; // one eighth note, in seconds
  while (nextTime < c.currentTime + LOOKAHEAD) {
    tr.schedule(c, step, nextTime);
    nextTime += stepLen;
    step = (step + 1) % tr.loop;
  }
}

function play() {
  if (timer || muted || !wanted || !unlocked || document.hidden) return;
  const c = getCtx();
  const t0 = c.currentTime + delay;
  delay = 0;
  playing = want;
  bus = c.createGain();
  bus.gain.setValueAtTime(0.0001, t0);
  bus.gain.exponentialRampToValueAtTime(TRACKS[playing].level, t0 + 0.4);
  bus.connect(c.destination);
  step = 0;
  nextTime = t0 + 0.08;
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

/** Ask for a track on this screen ('home' or 'test'). It starts now if the visitor has already tapped, else
 *  on the first tap. If that track is already playing it just keeps going; a different track is stopped
 *  first. after: seconds of quiet before it comes in (only when it isn't already playing). */
export function startMusic({ track = 'home', after = 0 } = {}) {
  wanted = true;
  if (timer && playing !== track) silence();
  want = track;
  if (!timer) delay = after;
  play();
}

/** Stop the loop, for example when leaving a test. */
export function stopMusic() { wanted = false; silence(); }

export const isMuted = () => muted;
export const isUnlocked = () => unlocked;

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

// the first tap or key press anywhere unlocks sound. The audio context is made right inside the gesture
// (iOS Safari insists), and the loop starts just after the click's own handler has run, so a first tap
// that goes straight to a screen without music (the pitch test) never starts it at all.
const EVENTS = ['touchend', 'click', 'keydown'];
const unlock = (e) => {
  getCtx();
  if (e.type === 'touchend') return; // the click that follows does the rest
  unlocked = true;
  EVENTS.forEach((n) => document.removeEventListener(n, unlock, true));
  setTimeout(play, 0);
};
EVENTS.forEach((n) => document.addEventListener(n, unlock, true));
