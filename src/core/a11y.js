// Keyboard and screen-reader helpers shared by the tests.
//
// The answer buttons are disabled between rounds so a stray tap can't count. A disabled button drops
// keyboard focus, which would throw a keyboard player back to the top of the page every round, so we
// remember which answer button had focus and give it back when the buttons come alive again.

export function answerButtons(btns) {
  let focusIdx = -1;
  return {
    enable() {
      btns.forEach((b) => (b.disabled = false));
      // only take focus when nothing else has it, so we never pull focus away from the player
      const a = document.activeElement;
      if (!a || a === document.body || a.getAttribute('tabindex') === '-1') {
        btns[Math.max(0, focusIdx)].focus({ preventScroll: true });
      }
    },
    disable() {
      const i = btns.indexOf(document.activeElement);
      if (i >= 0) focusIdx = i;
      btns.forEach((b) => (b.disabled = true));
    },
  };
}

/** Keep a progress bar's ARIA value in step with its width. frac is 0..1. */
export function setProgress(bar, frac) {
  bar.style.width = `${frac * 100}%`;
  bar.parentElement?.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
}
