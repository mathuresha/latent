// Result card, "sticker" style (option 4), rendered client-side to a 1080 x 1920 canvas (Story size).
// Colours come from the active theme (src/core/theme.js), so the saved PNG matches what the user sees.

import { palette } from './theme.js';

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function setFont(g, weight, size, spacing = '0px') {
  g.font = `${weight} ${size}px ${FONT}`;
  if ('letterSpacing' in g) g.letterSpacing = spacing;
}

function wrap(g, text, maxW) {
  const lines = []; let line = '';
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export function renderCard({ name, result, colors = palette() }) {
  const { bg: BG, ink: INK, surface: SURFACE, shadow: SHADOW, pink: PINK, yellow: YELLOW, onAccent: ON_ACCENT } = colors;
  const cv = document.createElement('canvas');
  cv.width = 1080; cv.height = 1920;
  const g = cv.getContext('2d');
  g.fillStyle = BG; g.fillRect(0, 0, 1080, 1920);
  g.textBaseline = 'alphabetic';

  if (name) {
    g.fillStyle = colors.soft; setFont(g, 600, 44);
    g.fillText(name, 90, 150);
  }

  // tile
  const TW = 860, TH = 1120, PAD = 80, IW = TW - PAD * 2;
  g.save();
  g.translate(540, 360 + TH / 2); g.rotate((-2 * Math.PI) / 180);
  g.translate(-TW / 2, -TH / 2);
  g.fillStyle = SHADOW; rr(g, 24, 24, TW, TH, 70); g.fill();
  g.fillStyle = SURFACE; rr(g, 0, 0, TW, TH, 70); g.fill();
  g.lineWidth = 10; g.strokeStyle = INK; rr(g, 0, 0, TW, TH, 70); g.stroke();

  // pill
  setFont(g, 700, 36);
  const pw = g.measureText(result.pill).width + 72;
  g.fillStyle = YELLOW; rr(g, PAD, PAD, pw, 62, 31); g.fill();
  g.lineWidth = 6; g.strokeStyle = INK; rr(g, PAD, PAD, pw, 62, 31); g.stroke();
  g.fillStyle = ON_ACCENT; g.fillText(result.pill, PAD + 36, PAD + 43);

  // big lines, shrunk to fit the tile
  let size = result.bigLines.length > 1 ? 270 : 300;
  for (const l of result.bigLines) {
    setFont(g, 800, size, `${-0.04 * size}px`);
    while (g.measureText(l).width > IW && size > 80) { size -= 6; setFont(g, 800, size, `${-0.04 * size}px`); }
  }
  let y = PAD + 62 + 40;
  g.fillStyle = PINK;
  for (const l of result.bigLines) {
    setFont(g, 800, size, `${-0.04 * size}px`);
    g.fillText(l, PAD, y + size * 0.8);
    y += size * 0.9;
  }
  y += 50;

  // ability name
  g.fillStyle = INK; setFont(g, 700, 46, '6px');
  for (const l of wrap(g, result.ability.toUpperCase(), IW)) { g.fillText(l, PAD, y + 40); y += 58; }
  y += 24;

  // sentence
  setFont(g, 500, 46);
  for (const l of wrap(g, result.sentence, IW)) { g.fillText(l, PAD, y + 40); y += 60; }
  g.restore();

  // detail line, outside the tile
  g.fillStyle = colors.softStrong; setFont(g, 400, 42);
  let dy = 1620;
  for (const l of wrap(g, result.detail, 860)) { g.fillText(l, 110, dy); dy += 56; }

  // wordmark
  g.fillStyle = INK; setFont(g, 700, 56, '10px'); g.textAlign = 'center';
  g.fillText('LATENT', 540, 1840);
  g.textAlign = 'left';
  return cv;
}
