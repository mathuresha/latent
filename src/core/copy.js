// Turns a raw percentile into the words on the result card and screen.
// Rarity is shown as "Top x%", computed from the norm model, never invented.

// Norms are lab-based and thin in the extreme tail, so we never claim better than this.
export const RARITY_FLOOR = 0.5;

export function formatTop(pct) {
  return pct < 10 ? pct.toFixed(1) : String(Math.round(pct));
}

function niceN(n) {
  if (n < 20) return String(Math.round(n));
  if (n < 100) return String(Math.round(n / 5) * 5);
  return String(Math.round(n / 10) * 10);
}

export function buildResult(meta, s, detailText) {
  const top = s.topPct;
  const shown = Math.max(RARITY_FLOOR, top);
  const ability = 100 - top;
  let bigLines, sentence;
  if (top <= 10) {
    bigLines = ['Top', `${formatTop(shown)}%`];
    sentence = `Only about 1 in ${niceN(100 / shown)} people can do what you just did.`;
  } else if (top <= 40) {
    const b = Math.max(6, Math.min(9, Math.round(ability / 10)));
    bigLines = [`${b} in 10`];
    sentence = `${b} in 10 ${meta.outperform}.`;
  } else if (top <= 60) {
    bigLines = ['Solidly', 'average'];
    sentence = 'Right where most people are. A clean baseline to build from.';
  } else {
    bigLines = ['Room', 'to grow'];
    sentence = meta.growth;
  }
  const pill = top <= 5 ? 'rare find' : top <= 20 ? 'standout' : top <= 60 ? 'solid' : 'keep exploring';
  return { testId: meta.id, topPct: top, shownTop: shown, bigLines, sentence, pill, detail: detailText, ability: meta.title };
}
