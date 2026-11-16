// Latent logo ("Spotted"): a tilted sticker tile with an ink L-corner and a pink dot, plus the
// lowercase wordmark (Inter Display Black, outlined so it needs no font). Generated from the brand files in
// latent-brand/logos/option-d-spotted. Colours come from the theme, so it follows light and dark.

export const LOGO_W = 312.4;
export const LOGO_H = 120;
const WORDMARK = 'M147.1875 37.4375H134.6875V84.0H147.1875ZM160.4475 84.59375C164.66625 84.59375 167.76 83.3125 169.9475 79.375H170.0725V84.0H182.26V61.9375C182.26 54.4375 176.8225 50.25 166.635 50.25C156.51 50.25 151.10375 54.4375 150.5725 61.9375H162.01C162.22875 60.0 163.66625 58.9375 166.135 58.9375C168.41625 58.9375 169.885 59.875 169.885 61.3125V61.4375C169.885 63.25 167.6975 63.9375 161.885 64.3125C154.76 64.78125 149.1975 67.5 149.1975 74.875C149.1975 81.4375 153.8225 84.59375 160.4475 84.59375ZM164.51 76.8125C162.385 76.8125 160.885 75.8125 160.885 74.125C160.885 72.4375 162.4475 71.3125 165.01 70.875C167.3225 70.46875 168.76 70.125 170.01 69.6875V72.3125C170.01 75.25 167.1975 76.8125 164.51 76.8125ZM208.20749999999998 51.0H201.39499999999998V42.0H188.89499999999998V51.0H183.33249999999998V60.5H188.89499999999998V74.125C188.89499999999998 81.0 192.67624999999998 84.0 201.33249999999998 84.0H208.20749999999998V74.5H204.26999999999998C201.98874999999998 74.5 201.39499999999998 73.90625 201.39499999999998 71.9375V60.5H208.20749999999998ZM226.18625 84.75C234.87375 84.75 241.87375 79.96875 243.0925 73.21875H232.03C231.3425 75.0 229.3425 76.0625 226.68625 76.0625C223.06125 76.0625 220.87375 74.0 220.78 70.5H243.2175V67.15625C243.2175 57.25 236.06125 50.25 225.93625 50.25C215.81125 50.25 208.655 57.40625 208.655 67.5C208.655 77.59375 215.905 84.75 226.18625 84.75ZM220.87375 63.5C221.31125 60.78125 223.24875 59.1875 226.28 59.1875C229.31125 59.1875 231.24875 60.78125 231.68625 63.5ZM257.4775 66.5C257.4775 62.6875 259.13375 60.8125 262.07125 60.8125C265.00875 60.8125 266.665 62.6875 266.665 66.0V84.0H279.165V63.1875C279.165 55.25 275.38375 50.25 268.04 50.25C262.8525 50.25 259.50875 52.71875 257.32125 56.5V51.0H244.97750000000002V84.0H257.4775ZM305.1125 51.0H298.3V42.0H285.8V51.0H280.2375V60.5H285.8V74.125C285.8 81.0 289.58125 84.0 298.2375 84.0H305.1125V74.5H301.175C298.89375 74.5 298.3 73.90625 298.3 71.9375V60.5H305.1125Z';

// Mark geometry, in a 120 x 120 box (the lockup scales it by 0.95 and nudges it down 2).
const TILE = { x: 14, y: 14, w: 88, h: 88, r: 24, off: 7, stroke: 6 };
const CORNER = 'M38,34 L38,80 L82,80';
const DOT = { cx: 68, cy: 50, r: 11 };

/** Inline SVG lockup for the page. Uses CSS variables, so it re-colours with the theme. */
export function logoSvg(height = 32) {
  const t = TILE;
  return `<svg class="logo" role="img" aria-label="Latent" viewBox="0 0 ${LOGO_W} ${LOGO_H}" height="${height}" width="${(height * LOGO_W / LOGO_H).toFixed(1)}">` +
    `<g transform="translate(0 2) scale(0.95) rotate(-6 60 60)">` +
    `<rect x="${t.x + t.off}" y="${t.y + t.off}" width="${t.w}" height="${t.h}" rx="${t.r}" style="fill:var(--shadow)"/>` +
    `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="${t.r}" style="fill:var(--surface);stroke:var(--ink)" stroke-width="${t.stroke}"/>` +
    `<path d="${CORNER}" fill="none" style="stroke:var(--ink)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}" style="fill:var(--pink)"/></g>` +
    `<path d="${WORDMARK}" style="fill:var(--ink)"/></svg>`;
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** Draw the lockup on a canvas with its top-left at (x, y), `height` px tall. colors = palette(). */
export function drawLogo(g, x, y, height, colors) {
  const s = height / LOGO_H, t = TILE;
  g.save();
  g.translate(x, y); g.scale(s, s);
  g.save();
  g.translate(0, 2); g.scale(0.95, 0.95);
  g.translate(60, 60); g.rotate((-6 * Math.PI) / 180); g.translate(-60, -60);
  g.fillStyle = colors.shadow; rr(g, t.x + t.off, t.y + t.off, t.w, t.h, t.r); g.fill();
  g.fillStyle = colors.surface; rr(g, t.x, t.y, t.w, t.h, t.r); g.fill();
  g.lineWidth = t.stroke; g.strokeStyle = colors.ink; g.stroke();
  g.lineWidth = 13; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(new Path2D(CORNER));
  g.fillStyle = colors.pink; g.beginPath(); g.arc(DOT.cx, DOT.cy, DOT.r, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = colors.ink; g.fill(new Path2D(WORDMARK));
  g.restore();
}
