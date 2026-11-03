// Small statistics helpers shared by the tests, the scorer and the simulations.

export function erf(x) {
  // Abramowitz & Stegun 7.1.26, max error ~1.5e-7
  const s = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

export const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Interpolate a percentile (0-100) for `value` in a sorted array of quantile values
// that are evenly spaced in probability from 0 to 1.
export function percentileFromQuantiles(sorted, value) {
  const n = sorted.length;
  if (value <= sorted[0]) return 0;
  if (value >= sorted[n - 1]) return 100;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= value) lo = mid; else hi = mid;
  }
  const span = sorted[hi] - sorted[lo] || 1;
  return ((lo + (value - sorted[lo]) / span) / (n - 1)) * 100;
}
