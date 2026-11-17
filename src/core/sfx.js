// Short sound effects: a soft "pop" on button taps, a gong when a test starts (the one recorded sound), a "time's up" chime when it
// ends and a little fanfare when the result card comes up. The music stops for the gong and the chime
// (main.js), so they are heard on their own. All but the gong are synthesised live with Web Audio.
//
// They share the sound toggle with the music (src/core/music.js): muted means no music and no effects.
// The pitch test's own tones and the sound-check beep are part of the test, so they are never muted.
// No tap sounds while the pitch test is running (main.js), so nothing is heard but the notes being judged.

import { getCtx } from './audio.js';
import { isMuted, isUnlocked } from './music.js';
import gongUrl from '../assets/gong.mp3';

const LEVEL = 0.22;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function out(c) {
  const g = c.createGain();
  g.gain.value = LEVEL;
  g.connect(c.destination);
  return g;
}

// one note: an oscillator through its own little envelope
function note(c, dest, { type = 'triangle', f, t, dur, peak = 0.6, attack = 0.005, glideTo = null }) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(dest);
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  o.connect(g);
  o.start(t); o.stop(t + dur + 0.05);
}

const ready = () => !isMuted() && isUnlocked();

/** Soft bubbly pop for a button tap (about 60 ms). */
export function sfxClick() {
  if (!ready()) return;
  const c = getCtx(), d = out(c), t = c.currentTime + 0.005;
  note(c, d, { type: 'sine', f: 880, glideTo: 520, t, dur: 0.07, peak: 0.55, attack: 0.003 });
}

// ---- gong ------------------------------------------------------------------------------------------------
// A real recording: one strike of a large Chinese gong, trimmed to about 2.6 s with a fade (src/assets/gong.mp3,
// 32 KB). Source: "Tao-Chi Gong" by the_very_Real_Horst, Wikimedia Commons, CC0 (public domain, no credit
// required): https://commons.wikimedia.org/wiki/File:240382_the-very-real-horst_chinese-gong-finish-session-2014-06-10-29-143.wav
// Two tries at synthesising a gong didn't sound like one, so this is the one sound that is a file.

let gongBuf = null;
let gongLoad = null;
/** Fetch and decode the gong. Called on the first tap (main.js), so it is ready long before a test starts. */
export function preloadGong() {
  if (gongLoad) return gongLoad;
  const c = getCtx();
  gongLoad = fetch(gongUrl)
    .then((r) => r.arrayBuffer())
    .then((b) => new Promise((res, rej) => c.decodeAudioData(b, res, rej))) // callback form for older Safari
    .then((buf) => { gongBuf = buf; })
    .catch(() => { gongLoad = null; }); // try again next time
  return gongLoad;
}

/** Gong for the start of a test. cutAt: seconds after which it is faded out quickly (the pitch test, so it
 *  is gone before the first note). */
export function sfxGong({ cutAt = null } = {}) {
  if (!ready()) return;
  const c = getCtx();
  if (!gongBuf) { preloadGong(); return; } // not loaded yet (very first tap went straight to a test): skip it
  const t = c.currentTime + 0.01;
  const src = c.createBufferSource();
  src.buffer = gongBuf;
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, t); // the clip is normalised loud; this sits it just above the music
  if (cutAt) { g.gain.setValueAtTime(0.5, t + cutAt - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + cutAt); }
  src.connect(g).connect(c.destination);
  src.start(t);
}

/** "Time's up" chime when a test ends: two bright bells, high then lower, over a soft low note (about 1.3 s). */
export function sfxEnd() {
  if (!ready()) return;
  const c = getCtx(), d = out(c), t = c.currentTime + 0.03;
  const chime = (m, at, dur) => {
    note(c, d, { type: 'sine', f: hz(m), t: t + at, dur, peak: 0.45, attack: 0.003 });
    note(c, d, { type: 'sine', f: hz(m) * 2.76, t: t + at, dur: dur * 0.4, peak: 0.1, attack: 0.002 }); // bell overtone
    note(c, d, { type: 'sine', f: hz(m) * 5.4, t: t + at, dur: dur * 0.15, peak: 0.05, attack: 0.002 });
  };
  chime(88, 0, 0.9);    // E6
  chime(84, 0.28, 1.1); // C6
  note(c, d, { type: 'triangle', f: hz(60), t: t + 0.28, dur: 1.0, peak: 0.25, attack: 0.03 });
}

/** Little "ta-da" fanfare and sparkle when the result card comes up (about 1.2 s). */
export function sfxReveal() {
  if (!ready()) return;
  const c = getCtx(), d = out(c), t = c.currentTime + 0.03;
  // ta-ta-taa
  [[0, 67, 0.12], [0.13, 72, 0.12], [0.26, 76, 0.7]].forEach(([at, m, dur]) => {
    note(c, d, { type: 'square', f: hz(m), t: t + at, dur, peak: 0.16 });
    note(c, d, { f: hz(m), t: t + at, dur, peak: 0.45 });
  });
  // full chord under the long note
  [60, 64, 67].forEach((m) => note(c, d, { f: hz(m), t: t + 0.26, dur: 0.9, peak: 0.25, attack: 0.02 }));
  // sparkles on top
  [96, 91, 100, 95].forEach((m, i) => note(c, d, { type: 'sine', f: hz(m), t: t + 0.42 + i * 0.09, dur: 0.25, peak: 0.12 }));
}
