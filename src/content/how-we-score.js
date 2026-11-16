// "How we score" page copy. Plain-language version of docs/NORMS.md for players.
// Draft text: https://claude.ai/artifact/62V27D1MS9VAZsHYzywBDu (edit there, then paste changes here).
// If the rarity bands in src/core/copy.js or the test lengths change, update this page too.

export const HOW_WE_SCORE = `
<h1>How we score</h1>
<p class="sub">Every result on Latent comes from real research on how people perform, not from a number we made up.
It's a good guide to what you're naturally good at, but it isn't a lab test, and this page shows exactly where it can be off.</p>

<div class="tile prose">
  <h2>What each test measures</h2>
  <div class="item">
    <h3>Pitch</h3>
    <p>The smallest gap between two notes you can still hear. You get 30 pairs. The first gap is easy, it gets finer as you keep getting them right, and wider when you miss, so most of your rounds land right at your limit.</p>
    <p class="small">Based on standard hearing research on pitch discrimination, for example Micheyl and colleagues (2006).</p>
  </div>
  <div class="item">
    <h3>Visual memory</h3>
    <p>How many things you can hold in your head at once. Coloured squares flash for a quarter of a second, then one comes back, and you say if its colour changed. You start with 2 squares, get more as you keep getting them right, and lose one when you miss, up to 6.</p>
    <p class="small">Based on a classic memory experiment by Luck and Vogel (1997), used in hundreds of studies since.</p>
  </div>
  <div class="item">
    <h3>Mental rotation</h3>
    <p>How quickly and accurately you can turn a 3D shape in your mind. You get 70 seconds to judge as many pairs as you can. The first pairs aren't turned at all; they turn further as you get them right, and back a step when you miss. A pair turned further is worth more points, because it takes everyone longer.</p>
    <p class="small">Based on Shepard and Metzler (1971), one of the most famous tests in psychology, and modern data from Ganis and Kievit (2015).</p>
  </div>
  <p>We built our own versions of these tests so they run in a browser in under two minutes. That makes them shorter than the lab versions, which matters for how exact the result can be.
  All three adjust to you as you go: everyone starts with the basics, and the test gets harder only as fast as you keep up. That way your rounds are spent near your own limit, which is where a short test learns the most about you.</p>
</div>

<div class="tile prose">
  <h2>How we turn your score into rarity</h2>
  <p>We place your score among how people did in published studies, and the rarity is the share of people who'd do as well as you or better.
  We don't compare you with other Latent players yet, because we don't collect anyone's results.</p>
  <ul>
    <li><b>Pitch:</b> a typical person can hear a gap of about 2% between two notes, which is roughly 8 Hz around the note A. The smaller the gap you can hear, the rarer your result.</li>
    <li><b>Visual memory:</b> we work out how many squares you actually held in mind, allowing for lucky guesses. Most people hold about 3.</li>
    <li><b>Mental rotation:</b> we took the speed and accuracy that lab volunteers showed and ran 20,000 simulated players through our exact 70-second test, with the same way of getting harder. Your score is placed among them.</li>
  </ul>
  <p>Because the test picks each round based on your last answers, the raw score can come out slightly off in a predictable direction (a little too flattering for both pitch and memory).
  We measured how much by running thousands of simulated players through the same adaptive test, and we correct for it before working out your rarity.</p>
  <h3>How your result shows up</h3>
  <dl class="bands">
    <dt>Top 10%</dt><dd>Your exact rarity, like "Top 3.2%"</dd>
    <dt>Top 10% to 40%</dt><dd>"7 in 10", meaning you did better than about 7 in 10 people</dd>
    <dt>Middle</dt><dd>"Solidly average", plus a real detail from your run</dd>
    <dt>Lower</dt><dd>"Room to grow", plus what to try next</dd>
  </dl>
</div>

<div class="tile prose">
  <h2>Why "Top 0.5%" is the best we show</h2>
  <p>Research studies test tens or hundreds of people, which is plenty to know what's typical but not enough to tell a 1-in-1,000 result from a 1-in-200 one.
  So we never claim better than Top 0.5%, even if your score was off the charts. If you see Top 0.5%, you're at least that rare, and maybe rarer.</p>
  <p>We show decimals like "Top 3.2%" because they come straight from the calculation. Treat the first number as the real signal and the decimal as rough.</p>
</div>

<div class="tile prose">
  <h2>How repeatable each test is</h2>
  <p>If you take a test twice, your second result should land near your first, but not on the same number. Short tests are noisier than long lab sessions.</p>
  <dl class="bands">
    <dt>Mental rotation</dt><dd>Most steady. Usually very close to your first result.</dd>
    <dt>Pitch</dt><dd>Fairly steady. Near the middle, it usually moves by 15 to 25 places out of 100.</dd>
    <dt>Visual memory</dt><dd>Least steady. Can swing more, because it's only 36 quick rounds.</dd>
  </dl>
  <p>A strong result that shows up twice is a much better sign than one lucky run. Pitch also gets better with practice, so a second try is often a little higher.</p>
  <p class="small">These figures come from our own computer checks of the tests, not yet from real players.</p>
</div>

<div class="tile prose">
  <h2>What can throw your result off</h2>
  <ul>
    <li><b>Your setup.</b> Cheap earbuds, phone speakers or a noisy room make pitch harder. A dim, small or tinted screen makes the visual tests harder.</li>
    <li><b>Colour blindness.</b> The memory test uses colours, so it may undersell you if you're colour blind.</li>
    <li><b>Distractions.</b> A notification, a tap that didn't register, or looking away for a second all count against you.</li>
    <li><b>Our test isn't the lab's.</b> It's shorter and runs on your own device, so it won't match a study exactly. We think the numbers may be slightly generous for pitch.</li>
  </ul>
  <p>If a result feels wrong, find a quiet spot and try again. A careful run with no distractions is the one to trust.</p>
</div>

<div class="tile prose">
  <h2>What we don't do</h2>
  <ul>
    <li><b>We don't diagnose anything.</b> Latent is not a hearing, eyesight or medical test. If you're worried about your hearing or vision, see a doctor.</li>
    <li><b>We don't collect your results.</b> Every test runs and is scored on your phone. Nothing is sent to us.</li>
    <li><b>We don't need an account.</b> Your first name, if you add it, stays in your browser and only appears on your card.</li>
    <li><b>We don't decide who you are.</b> A rare result is a head start, not destiny, and an average one doesn't mean you can't get good with practice.</li>
  </ul>
</div>
`;
