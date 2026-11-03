// Light / dark theme. The colours themselves live in src/styles.css as CSS variables; this module
// picks which set is active, remembers the user's choice, and hands the same colours to canvas code
// (result card, rotation shapes) so nothing is hard-coded twice.
//
// Until the user picks, we follow the system setting (and keep following it if it changes).
// index.html runs a tiny copy of resolve() before first paint so there is no flash of the wrong theme.

const KEY = 'latent.theme';
const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
const listeners = new Set();

let chosen = null; // 'light' | 'dark' | null (null = follow system)
try { chosen = localStorage.getItem(KEY); } catch { /* private mode */ }
if (chosen !== 'light' && chosen !== 'dark') chosen = null;

export const currentTheme = () => chosen || (mq?.matches ? 'dark' : 'light');

function apply() {
  const t = currentTheme();
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette().bg);
  listeners.forEach((f) => f(t));
}

export function setTheme(t) {
  chosen = t;
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  apply();
}

export const toggleTheme = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');

/** Call f(theme) whenever the theme changes. Returns an unsubscribe function. */
export function onThemeChange(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** The active theme's colours, read from the CSS variables, for drawing on canvas. */
export function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    bg: v('--bg'), ink: v('--ink'), surface: v('--surface'), shadow: v('--shadow'),
    pink: v('--pink'), yellow: v('--yellow'), onAccent: v('--on-accent'),
    soft: v('--soft'), softStrong: v('--soft-strong'), shapeEdge: v('--shape-edge'),
  };
}

mq?.addEventListener?.('change', () => { if (!chosen) apply(); });
apply();
