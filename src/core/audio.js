// Web Audio helpers. Pure sine tones, no audio files.

let ctx = null;

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Schedule a sine tone; resolves when it has finished playing.
export function playTone(freq, durMs, { when = 0, level = 0.25 } = {}) {
  const c = getCtx();
  const t0 = c.currentTime + when;
  const dur = durMs / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // 15 ms raised ramps so onsets do not click
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(level, t0 + 0.015);
  g.gain.setValueAtTime(level, t0 + dur - 0.015);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  return new Promise((res) => { osc.onended = res; });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
