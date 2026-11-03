# Norms, sources and assumptions (v1 MVP)

Every percentile in the app comes from a model written down here. Where a number is a published
figure it says so; where it is an assumption it says that too. **Nothing here has been validated on
real Latent players yet.** Treat all percentiles as approximate, and say so in the product (the result
screen already does).

Display rule: rarity is shown as "Top x%" only for results in the top 10%, and never better than
**Top 0.5%** (`RARITY_FLOOR` in `src/core/copy.js`), because published norms are thin in the extreme
tail. Change the constant if you decide differently.

## Pitch discrimination (`src/tests/pitch.js`)

**Task.** Two pure tones, which is higher (2AFC). Base frequency about 440 Hz, roved +/-5% so absolute
pitch memory does not help. Five fixed gaps (5, 2.5, 1.25, 0.6, 0.3 % of frequency), 8 trials each,
40 trials, 300 ms tones. Fixed levels, no adaptive staircase. 75%-correct threshold fitted by maximum
likelihood using a standard signal-detection model (P = Phi(d'/sqrt2), d' proportional to the gap,
3% lapse rate).

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

**Repeatability (simulation, `npm run simulate`).** Test-retest r about 0.67-0.76; the median gap
between two runs is about 0.6 SD, roughly 15-25 percentile points near the middle. Good enough for a
fun result, not for fine distinctions. An adaptive staircase (later) would improve this.

## Visual working memory (`src/tests/memory.js`)

**Task.** Colour change detection (Luck & Vogel, 1997, *Nature* 390:279-281). Five coloured squares
for 250 ms, 800 ms blank, one square returns, same colour or changed? 36 trials (18 changed, 18 same).
Capacity K = set size x (hit rate - false-alarm rate) (Cowan, 2001, *Behavioral and Brain Sciences*
24:87-114).

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
r is about 0.59, and K cannot exceed 5, so a perfect score tops out near "Top 0.5%". Uses colour, which
disadvantages some people with colour-vision deficiency (the intro says so).

## Mental rotation (`src/tests/rotation.js`, `src/core/shapes3d.js`)

**Task.** Shepard & Metzler (1971, *Science* 171:701-703) same/different judgement on block figures.
The right figure is the left one turned 0/50/100/150 degrees about the vertical axis, or its mirror
image. Figures are generated in code and checked so the mirror image can never be matched by a rotation.
90 seconds, score = correct minus wrong.

**Published anchors.** Ganis & Kievit (2015), *Journal of Open Psychology Data*, N=54:
mean RT 1801 / 2415 / 3026 / 3191 ms and error 5.3 / 7.3 / 13.4 / 18.8 % at 0 / 50 / 100 / 150 degrees,
RT slope about 9.6 ms per degree. Only standard errors are reported; we recover between-person SDs as
SE x sqrt(54) (RT coefficient of variation 0.27-0.31). https://core.ac.uk/download/29819355.pdf

**Model used (`scripts/simulate.js`).** 20,000 simulated people take the 90-second test. Each has a
speed multiplier (lognormal, CV 0.29) and an accuracy shift (SD 1.0 on the logit of error). The
percentile table `src/data/rotation-norms.js` is generated from this. Simulated median: 26 correct,
net score 22.

**Assumptions to challenge.** Within-person trial noise (CV 0.25), accuracy SD, 400 ms between trials,
and that people in the lab sample trade speed for accuracy like our players will. Our figures are not
the Ganis & Kievit stimuli (their open set is on figshare; we can switch to it later).

**Repeatability (simulation).** Test-retest r about 0.84.

## What would make these real

1. Have 30-50 friends play each test on their own devices (opt-in, local export) and compare the
   distributions with the model above.
2. Replace assumed SDs with measured ones, or with values from the full papers.
3. Confirm authorship and titles of the two sources flagged above.
4. Decide on adaptive staircase for pitch in v2, and anonymous score collection (needs DPDP review).
