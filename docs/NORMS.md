# Norms, sources and assumptions (v1 MVP)

Every percentile in the app comes from a model written down here. Where a number is a published
figure it says so; where it is an assumption it says that too. **Nothing here has been validated on
real Latent players yet.** Treat all percentiles as approximate, and say so in the product (the result
screen already does).

Display rule: rarity is shown as "Top x%" only for results in the top 10%, and never better than
**Top 0.5%** (`RARITY_FLOOR` in `src/core/copy.js`), because published norms are thin in the extreme
tail. Change the constant if you decide differently.

## Adaptive difficulty (all three tests, `src/core/staircase.js`)

Every test starts at its easiest level and gets harder only as fast as the player keeps up:

1. **Warm-up.** Step one level harder after every right answer, until the first wrong one.
2. **Then N-down / 1-up** (Levitt 1971): one level harder after N right answers in a row, one level
   easier after any wrong answer. Pitch and memory use 3-down (settles near 79% right); rotation uses
   2-down (about 71%), because rotation errors are rare even at the hardest angle.
3. **Stopping rule.** Fixed length: 30 rounds (pitch), 36 rounds (memory), 70 seconds (rotation).
   Shortened from v1's 40 rounds / 90 seconds on 2026-11-16 (Esha's call) to keep the tests quick; the
   adaptive design buys back most of the repeatability that costs.
4. **Scoring uses every round,** not just the level reached. The staircase only decides which round comes
   next.

Adaptive selection makes the raw estimates slightly biased in a predictable direction (pitch reads about
8% too fine, memory K about 0.24 too high). The bias is about the same for weak, average and strong
players, so a single correction is fair to everyone; it depends on test length, so re-run the
simulation after any change. `npm run simulate` measures this on the norm population and
writes `src/data/adaptive-calibration.js`; the tests subtract it before the percentile lookup. **The
correction is model-based**, so it is only as good as the simulation assumptions below.

Simulated repeatability, v1 fixed design vs current adaptive design (test-retest r): pitch 0.66 (40
fixed rounds) -> 0.70 (30 adaptive; 0.74 -> 0.78 with a steeper psychometric slope), memory 0.62 -> 0.70,
rotation 0.84 (90 s fixed) -> 0.81 (70 s adaptive).

## Pitch discrimination (`src/tests/pitch.js`)

**Task.** Two pure tones, which is higher (2AFC). Base frequency about 440 Hz, roved +/-5% so absolute
pitch memory does not help. 30 trials, 300 ms tones. Adaptive: gaps on a ladder from 20% to 0.11% in
steps of sqrt(2); real trials start at 10%, warm-up then 3-down/1-up. 75%-correct threshold fitted by
maximum likelihood on all 30 trials using a standard signal-detection model (P = Phi(d'/sqrt2), d'
proportional to the gap, 3% lapse rate), then divided by the measured adaptive bias (x0.92).
Note the lab anchors below were themselves measured with adaptive staircases, so this is closer to their
method than the v1 fixed levels were.

**Published anchors.**
- Non-musicians' mean frequency difference limen about **1.9%** (musicians 0.76%) for resolved complex
  tones, adaptive 3AFC, 14 non-musicians / 16 musicians: https://core.ac.uk/download/84595741.pdf
  (paper title and authors still to be confirmed before we cite it formally).
- Micheyl, Delhommeau, Perrot & Oxenham (2006), *Hearing Research* 219:36-47. Untrained non-musicians
  had thresholds more than six times larger than classical musicians; about four times after 2 hours of
  practice; 4-8 hours of practice to match musicians. Abstract: https://experts.umn.edu/en/publications/influence-of-musical-and-psychoacoustical-training-on-pitch-discr/
- 440 Hz standard, 3AFC two-down/one-up, musicians n=20 / non-musicians n=18, thresholds not
  significantly non-normal: https://mdpi.com/2076-3425/11/12/1592/html

**Model used.** log10(threshold) is normal with median 1.9% and SD 0.30 (a factor of 2).
**The SD is an assumption**: none of the sources report one we could read. Top 0.5% corresponds to about
0.28% (about 1.2 Hz at 440 Hz).

**Known gaps.** Our procedure (pure tones, 2AFC, fixed levels, one short session, unknown headphones)
differs from the lab anchors. The truly untrained are probably worse than 1.9%, which would make our
percentiles slightly generous.

**Repeatability (simulation, `npm run simulate`).** Test-retest r about 0.70-0.78 (v1, 40 fixed rounds:
0.66-0.74); the median gap between two runs is about 0.42-0.54 SD, roughly 15-25 percentile points near
the middle.

## Visual working memory (`src/tests/memory.js`)

**Task.** Colour change detection (Luck & Vogel, 1997, *Nature* 390:279-281). Five coloured squares
for 250 ms, 800 ms blank, one square returns, same colour or changed? 36 trials (changed / same balanced
in pairs). Adaptive set size 2 to 6, starting at 2, warm-up then 3-down/1-up (a typical K of 3 settles
around 5 squares, the v1 set size). Capacity K is fitted by maximum likelihood over all trials with
Cowan's model (Cowan, 2001, *Behavioral and Brain Sciences* 24:87-114; P(remembered) = min(1, K/S), free
guess rate), the standard way to pool set sizes (Rouder et al., 2008, *PNAS* 105:5975-5979). For a single
set size this equals S x (H - F). Then the measured adaptive bias (0.24) is subtracted.

**Published anchors.**
- Mean K = **2.45** at set size 6, N=100, 250 ms sample / 1000 ms retention, odd-even split-half
  reliability r = .87 at 240 trials: https://link.springer.com/content/pdf/10.3758/s13414-022-02586-0.pdf
  (title and authors to be confirmed).
- Test-retest reliability of K between .50 and .76, higher for larger set sizes (abstract only):
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6362280/
- Timings and design: Matsuyoshi, Osaka & Osaka (2014), Frontiers in Psychology 5:384.

**Model used.** K is normal with mean **2.8** and SD **0.85**. The mean sits between the 2.45 measured at
set size 6 and the 3-4 usually quoted for small arrays; **both the mean and the SD are judgement calls**.

**Known gaps.** This is the least repeatable of the three: with only 36 trials, simulated test-retest
r is about 0.70 (v1 fixed set size 5: 0.62). K is capped at 6 (7 paradigm colours leave one spare for a
change), which is above the Top 0.5% floor. **The norm (mean 2.8) was chosen for a fixed set size of 5;**
we assume the pooled K from mixed set sizes 2-6 estimates the same capacity, which is what Cowan's model
predicts but which published data show only approximately (K drifts a little with set size). The bias
correction assumes guess rates between 0.3 and 0.7. Uses colour, which disadvantages some people with
colour-vision deficiency (the intro says so).

## Mental rotation (`src/tests/rotation.js`, `src/core/shapes3d.js`)

**Task.** Shepard & Metzler (1971, *Science* 171:701-703) same/different judgement on block figures.
The right figure is the left one turned 0/50/100/150 degrees about the vertical axis, or its mirror
image. Figures are generated in code and checked so the mirror image can never be matched by a rotation.
70 seconds (v1: 90). Adaptive: starts at 0 degrees, warm-up then 2-down/1-up over 0/50/100/150 (design constants
in `src/data/rotation-design.js`). Because a turned pair takes longer, each pair is worth points equal
to the lab mean RT at its angle relative to 0 degrees (1 / 1.3 / 1.7 / 1.8); score = points right minus
points wrong. Without the weighting, people who climb to harder angles would answer fewer pairs and be
penalised for being good.

**Published anchors.** Ganis & Kievit (2015), *Journal of Open Psychology Data*, N=54:
mean RT 1801 / 2415 / 3026 / 3191 ms and error 5.3 / 7.3 / 13.4 / 18.8 % at 0 / 50 / 100 / 150 degrees,
RT slope about 9.6 ms per degree. Only standard errors are reported; we recover between-person SDs as
SE x sqrt(54) (RT coefficient of variation 0.27-0.31). https://core.ac.uk/download/29819355.pdf

**Model used (`scripts/simulate.js`).** 20,000 simulated people take the 70-second test. Each has a
speed multiplier (lognormal, CV 0.29) and an accuracy shift (SD 1.0 on the logit of error). The
percentile table `src/data/rotation-norms.js` is generated from this, running the exact adaptive
procedure, point weights and 70-second limit. Simulated median: 18 correct, 23.2 points (v1 fixed
90 s: 26 correct, net 22; the scales are not comparable).

**Assumptions to challenge.** Within-person trial noise (CV 0.25), accuracy SD, 400 ms between trials,
and that people in the lab sample trade speed for accuracy like our players will. Our figures are not
the Ganis & Kievit stimuli (their open set is on figshare; we can switch to it later).

**Repeatability (simulation).** Test-retest r about 0.81 (v1, 90 s: 0.84); correlation with simulated
ability 0.86. The lab data are from random, not adaptive, angle order; we assume per-angle speed and
accuracy do not depend on the order angles come in.

## What would make these real

1. Have 30-50 friends play each test on their own devices (opt-in, local export) and compare the
   distributions with the model above.
2. Replace assumed SDs with measured ones, or with values from the full papers.
3. Confirm authorship and titles of the two sources flagged above.
4. Anonymous score collection (needs DPDP review), which would also replace the simulated adaptive-bias
   corrections with measured ones.
