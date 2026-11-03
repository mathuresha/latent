// Shepard-Metzler style block figures: generation, chirality check, and canvas drawing.
// Figures are built from unit cubes along right-angled arms. Only figures whose mirror image
// cannot be matched by any rotation are kept, so "different" trials are always truly different.

import { randInt, rand } from './stats.js';
import { palette } from './theme.js';

const AXES = [0, 1, 2];

function key(p) { return p.join(','); }

function normalise(cells) {
  const min = [0, 1, 2].map((a) => Math.min(...cells.map((c) => c[a])));
  return cells.map((c) => c.map((v, a) => v - min[a])).map(key).sort().join('|');
}

// the 24 proper rotations of a cube as 3x3 integer matrices
const ROTATIONS = (() => {
  const out = [];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const p of perms) {
    for (let s = 0; s < 8; s++) {
      const sg = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1];
      const m = [0, 1, 2].map((r) => { const row = [0, 0, 0]; row[p[r]] = sg[r]; return row; });
      const det =
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
        m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
        m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
      if (det === 1) out.push(m);
    }
  }
  return out;
})();

const apply = (m, c) => m.map((row) => row[0] * c[0] + row[1] * c[1] + row[2] * c[2]);
export const mirror = (cells) => cells.map((c) => [-c[0], c[1], c[2]]);

export function isChiral(cells) {
  const target = normalise(mirror(cells));
  return !ROTATIONS.some((m) => normalise(cells.map((c) => apply(m, c))) === target);
}

export function generateShape() {
  for (let attempt = 0; attempt < 500; attempt++) {
    const seen = new Set(['0,0,0']);
    const cells = [[0, 0, 0]];
    let pos = [0, 0, 0];
    let prevAxis = -1;
    const segs = randInt(3, 4);
    let ok = true;
    for (let s = 0; s < segs && ok; s++) {
      const axis = AXES.filter((a) => a !== prevAxis)[randInt(0, 1)];
      const sign = Math.random() < 0.5 ? -1 : 1;
      const len = randInt(2, 3);
      for (let i = 0; i < len; i++) {
        pos = pos.slice(); pos[axis] += sign;
        if (seen.has(key(pos))) { ok = false; break; }
        seen.add(key(pos)); cells.push(pos);
      }
      prevAxis = axis;
    }
    if (ok && cells.length >= 8 && cells.length <= 11 && isChiral(cells)) return cells;
  }
  throw new Error('shape generation failed');
}

// ---- drawing --------------------------------------------------------------------------

const FACES = [
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
];

const TILT = (-24 * Math.PI) / 180; // camera looks slightly down on the figure
const LIGHT = [-0.45, 0.75, 0.5];

function view(p, yaw) {
  // rotate about the vertical axis, then tilt toward the viewer
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy;
  const ct = Math.cos(TILT), st = Math.sin(TILT);
  return [x, p[1] * ct - z * st, p[1] * st + z * ct];
}

export function drawShape(canvas, cells, yawDeg, hue = 214) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 160, H = canvas.clientHeight || 160;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.clearRect(0, 0, W, H);
  const edge = palette().shapeEdge;
  const c0 = [0, 1, 2].map((a) => cells.reduce((s, c) => s + c[a], 0) / cells.length);
  const pts = cells.map((c) => c.map((v, a) => v - c0[a]));
  const radius = Math.max(...pts.map((p) => Math.hypot(...p))) + 0.9;
  const scale = (Math.min(W, H) * 0.47) / radius;
  const yaw = (yawDeg * Math.PI) / 180;
  const order = pts.map((p) => ({ p, z: view(p, yaw)[2] })).sort((a, b) => a.z - b.z);
  for (const { p } of order) {
    for (const f of FACES) {
      const n = view(f.n, yaw);
      if (n[2] <= 0.001) continue;
      const lum = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      g.fillStyle = `hsl(${hue} 70% ${34 + lum * 40}%)`;
      g.strokeStyle = edge; g.lineWidth = 1.6; g.lineJoin = 'round';
      g.beginPath();
      f.v.forEach((v, i) => {
        const q = view([p[0] + v[0] / 2, p[1] + v[1] / 2, p[2] + v[2] / 2], yaw);
        const x = W / 2 + q[0] * scale, y = H / 2 - q[1] * scale;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.closePath(); g.fill(); g.stroke();
    }
  }
}

export const randomYaw = () => rand(0, 360);
