// Adaptive difficulty ("staircase"), shared by all three tests. See docs/NORMS.md ("Adaptive difficulty").
//
// Difficulty is a position on a ladder of levels, from easiest (index 0) to hardest.
//  - Warm-up: start at the bottom and step up after EVERY right answer, so people reach their own
//    level quickly. The warm-up ends at the first wrong answer.
//  - After that, the usual "N-down, 1-up" rule (Levitt 1971): step up one level after `down` right answers
//    in a row, step down one level after any wrong answer. With 2-down it settles where people are
//    right about 71% of the time, with 3-down about 79%.
// The staircase only CHOOSES the next trial. Scoring uses every trial (see each test's score()).

export function makeStaircase({ levels, start = 0, down = 2, warmupStep = 1 }) {
  let i = start, streak = 0, warmup = true, reversals = 0, lastDir = 0, peak = start;
  const move = (dir, step) => {
    if (lastDir && dir !== lastDir) reversals++;
    lastDir = dir;
    i = Math.max(0, Math.min(levels.length - 1, i + dir * step));
    peak = Math.max(peak, i);
  };
  return {
    get level() { return levels[i]; },
    get index() { return i; },
    get reversals() { return reversals; },
    get peak() { return levels[peak]; },
    update(correct) {
      if (warmup) {
        if (correct) move(+1, warmupStep);
        else { warmup = false; move(-1, 1); }
        return;
      }
      if (correct) { if (++streak >= down) { streak = 0; move(+1, 1); } }
      else { streak = 0; move(-1, 1); }
    },
  };
}
