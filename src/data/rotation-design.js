// Mental rotation design constants, shared by src/tests/rotation.js and scripts/simulate.js (which builds
// the norm table from them, so the two can never drift apart). See docs/NORMS.md ("Mental rotation").

export const DURATION_MS = 70000;
// Turn between the two figures, easiest first. The staircase starts at 0 deg.
export const ANGLES = [0, 50, 100, 150];
export const STAIR = { down: 2, warmupStep: 1 };
// Points per pair = lab mean response time at that angle / at 0 deg (Ganis & Kievit 2015: 1801, 2415,
// 3026, 3191 ms), rounded. A turned pair costs more time, so it earns proportionally more.
export const POINTS = { 0: 1, 50: 1.3, 100: 1.7, 150: 1.8 };
