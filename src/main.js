import * as pitch from './tests/pitch.js';
import * as memory from './tests/memory.js';
import * as rotation from './tests/rotation.js';
import { buildResult, formatTop } from './core/copy.js';
import { renderCard } from './core/card.js';
import { getCtx, playTone, sleep } from './core/audio.js';
import { HOBBIES } from './data/hobbies.js';
import { HOW_WE_SCORE } from './content/how-we-score.js';
import { currentTheme, toggleTheme, onThemeChange } from './core/theme.js';
import { logoSvg } from './core/logo.js';
import { startMusic, stopMusic, isMuted, setMuted, onMuteChange, isUnlocked, unlockedBy } from './core/music.js';
import { sfxClick, sfxGong, sfxEnd, sfxReveal, preloadGong } from './core/sfx.js';
import { shareMessage, shareResult, copyCard } from './core/share.js';
import { startAnalytics, track } from './core/analytics.js';

const TESTS = [pitch, memory, rotation];
const app = document.getElementById('app');
const results = {}; // testId -> built result, kept in memory only
let name = '';
try { name = localStorage.getItem('latent.name') || ''; } catch { /* private mode */ }

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let screenThemeHook = null; // the current screen's reaction to a theme change, if any
let firstScreen = true;
// fill: the screen takes the full height of the window, so its main buttons (.actions) sit at the bottom
// within thumb reach instead of floating halfway up with empty space below them.
// music: true for the home track (home, test intros), or { track, after } to pick the track ('home' or
// 'test') and leave `after` seconds of quiet first for a gong or fanfare. The same track keeps playing
// across screens; a different one replaces it. Screens without music stop it.
const html = (s, { testing = false, wide = false, fill = false, music = false } = {}) => {
  screenThemeHook = null;
  if (music) startMusic(music === true ? undefined : music); else stopMusic();
  document.body.classList.toggle('testing', testing);
  document.body.classList.toggle('fill', fill || testing);
  document.body.classList.toggle('music', !!music);
  document.body.classList.toggle('wide', wide); // only the How we score page uses the wide desktop layout
  app.innerHTML = s; window.scrollTo(0, 0);
  // move focus to the new screen's heading, so keyboard and screen-reader users start at the top of it
  // (not on first load, where the browser's own start point is right)
  const h = app.querySelector('h1, h2');
  if (h && !firstScreen) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  firstScreen = false;
};

// ---- theme toggle ---------------------------------------------------------------------
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
const ICON_SHARE = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
const themeBtn = document.createElement('button');
themeBtn.className = 'theme-toggle';
themeBtn.onclick = toggleTheme;
document.body.prepend(themeBtn);
const syncThemeBtn = (t) => {
  const next = t === 'dark' ? 'light' : 'dark';
  themeBtn.innerHTML = t === 'dark' ? ICON_SUN : ICON_MOON;
  themeBtn.setAttribute('aria-label', `Switch to ${next} theme`);
  themeBtn.title = `Switch to ${next} theme`;
};
syncThemeBtn(currentTheme());
onThemeChange((t) => { syncThemeBtn(t); screenThemeHook?.(t); });

// ---- sound toggle: music and sound effects together (next to the theme toggle; during the memory and
// rotation tests it takes the theme toggle's spot; hidden in the pitch test, which has neither) --------------
const ICON_NOTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const ICON_NOTE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
const musicBtn = document.createElement('button');
musicBtn.className = 'theme-toggle music-toggle';
musicBtn.setAttribute('aria-label', 'Music and sounds');
// the very first tap on the page, if it lands on this button, means "play": it unlocks sound and must not
// also mute it (which is what used to happen, so people had to tap it twice)
musicBtn.onclick = () => {
  if (unlockedBy(musicBtn)) { if (isMuted()) { setMuted(false); track('music_on'); } return; }
  setMuted(!isMuted()); track(isMuted() ? 'music_off' : 'music_on');
};
document.body.prepend(musicBtn);
// Before the first tap nothing can play yet, so the button says so: "Tap for music" with a gentle pulse
// (unless they muted it on an earlier visit).
const syncMusicBtn = (m) => {
  const waiting = !isUnlocked() && !m;
  musicBtn.classList.toggle('waiting', waiting);
  musicBtn.innerHTML = waiting ? `${ICON_NOTE_OFF}<span>Tap for music</span>` : m ? ICON_NOTE_OFF : ICON_NOTE;
  musicBtn.setAttribute('aria-pressed', String(!m && !waiting)); // pressed = music on
  musicBtn.title = waiting ? 'Tap to play music and sounds' : m ? 'Sound off. Tap to turn music and sounds on' : 'Sound on. Tap to mute music and sounds';
};
syncMusicBtn(isMuted());
onMuteChange(syncMusicBtn);
const $ = (sel) => app.querySelector(sel);

// ---- exit a test midway: an X at the top right (only while a test runs), then a confirmation ------------
// Leaving bumps runId, so the abandoned test's result is ignored if it still finishes in the background
// (the rotation timer runs out on its own), and its next round stops because its screen is gone.
let runId = 0;
let runningTest = null;
const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const exitBtn = document.createElement('button');
exitBtn.className = 'theme-toggle exit-toggle';
exitBtn.setAttribute('aria-label', 'Exit test');
exitBtn.title = 'Exit test';
exitBtn.innerHTML = ICON_X;
document.body.prepend(exitBtn);
const exitDlg = document.createElement('dialog');
exitDlg.className = 'confirm';
exitDlg.setAttribute('aria-labelledby', 'exit-h');
exitDlg.setAttribute('aria-describedby', 'exit-p');
exitDlg.innerHTML = `<h2 id="exit-h" class="h3">Leave this test?</h2>
  <p id="exit-p">Your answers so far won't be saved. You can start it again any time.</p>
  <div class="btnrow"><button class="btn big" id="exit-stay" autofocus>Keep going</button><button class="btn primary big" id="exit-leave">Exit</button></div>`;
document.body.append(exitDlg);
exitBtn.onclick = () => { if (!exitDlg.open) exitDlg.showModal(); };
exitDlg.querySelector('#exit-stay').onclick = () => exitDlg.close();
exitDlg.querySelector('#exit-leave').onclick = () => {
  exitDlg.close();
  track('test_exit', runningTest?.meta.id);
  runId++; runningTest = null;
  home();
};
// tap on the dimmed backdrop = keep going
exitDlg.addEventListener('click', (e) => { if (e.target === exitDlg) exitDlg.close(); });
// while the question is up, the test's answer keys (1/2, S/C/D) must not reach the test
window.addEventListener('keydown', (e) => { if (exitDlg.open) e.stopPropagation(); }, true);
const dialogClosed = () => (exitDlg.open ? new Promise((r) => exitDlg.addEventListener('close', r, { once: true })) : null);

// a soft pop on every button tap, except buttons marked data-sfx="none" (they make their own sound) and
// inside the pitch test, where the only sounds should be the notes being judged. Runs after the button's
// own handler, so a tap that starts the pitch test is already silent.
const inPitchTest = () => document.body.classList.contains('testing') && !document.body.classList.contains('music');
document.addEventListener('click', preloadGong, { once: true }); // the gong recording, ready before any test
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled || b.dataset.sfx === 'none' || inPitchTest()) return;
  sfxClick();
});
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// a small note that pops up at the bottom for a few seconds, also read out by screen readers
const toastEl = document.createElement('div');
toastEl.className = 'toast'; toastEl.setAttribute('role', 'status');
document.body.append(toastEl);
let toastTimer = null;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function home() {
  html(`
    <div class="brand">${logoSvg(34)}</div>
    <h1>Find what you're strangely good at.</h1>
    <p class="sub">Three short tests. Each one tells you how rare your result is, then points you to something worth trying.</p>
    <label for="nm">Your first name (optional, for your card)</label>
    <input id="nm" type="text" maxlength="20" placeholder="e.g. Esha" value="${esc(name)}" autocomplete="off" />
    ${TESTS.map((t) => {
      const r = results[t.meta.id];
      return `<button class="tile test-card" data-id="${t.meta.id}">
        ${r ? `<span class="chip">${r.topPct <= 10 ? 'Top ' + formatTop(r.shownTop) + '%' : r.pill}</span>` : ''}
        <h2 class="h3">${t.meta.title}</h2><p>${t.meta.blurb}</p><p class="small">${t.meta.time}</p></button>`;
    }).join('')}
    <p class="small">For ages 18 and up. Your results never leave your device. Your name stays in this browser and only appears on your card. Results are fun, not a medical or hearing test. <button class="linkbtn small" id="how">How we score</button></p>`, { music: true });
  $('#how').onclick = () => howWeScore(home);
  $('#nm').oninput = (e) => {
    name = e.target.value.trim();
    try { localStorage.setItem('latent.name', name); } catch { /* ignore */ }
  };
  app.querySelectorAll('.test-card').forEach((b) => (b.onclick = () => intro(TESTS.find((t) => t.meta.id === b.dataset.id))));
}

function intro(t) {
  track('test_open', t.meta.id);
  html(`
    <button class="back" id="back">← All tests</button>
    <h1 class="h2">${t.meta.title}</h1>
    <div class="tile"><ul class="steps">${t.meta.instructions.map((i) => `<li>${i}</li>`).join('')}</ul>
      <p class="small">${t.meta.time}</p></div>
    <div class="actions"><button class="btn primary big" id="go"${t.meta.needsAudio ? '' : ' data-sfx="none"'}>${t.meta.needsAudio ? 'Next: sound check' : 'Start'}</button></div>`, { fill: true, music: !t.meta.needsAudio });
  $('#back').onclick = home;
  $('#go').onclick = () => (t.meta.needsAudio ? soundCheck(t) : play(t));
}

function soundCheck(t) {
  html(`
    <button class="back" id="back">← Back</button>
    <h1 class="h2">Sound check</h1>
    <div class="tile">
      <p>Find a quiet spot and put on headphones if you can. Turn your volume to a comfortable level, then play the tone.</p>
      <div class="btnrow"><button class="btn big" id="tone" data-sfx="none">▶ Play tone</button></div>
      <p class="small" id="sc-msg">You should hear a steady beep.</p>
    </div>
    <div class="actions"><button class="btn primary big" id="go" disabled>I heard it. Start</button></div>`, { fill: true });
  $('#back').onclick = () => intro(t);
  $('#tone').onclick = async () => {
    try { getCtx(); await playTone(440, 800); $('#go').disabled = false; $('#sc-msg').textContent = 'Heard it? Tap Start. If not, raise your volume or check your headphones and play again.'; }
    catch { $('#sc-msg').textContent = 'This browser could not play sound. Try Chrome or Safari.'; }
  };
  $('#go').onclick = () => play(t);
}

async function play(t) {
  // no music in the pitch test: it would mask the notes being compared
  const music = !t.meta.needsAudio;
  const id = ++runId;
  runningTest = t;
  // play() always runs straight from a tap, so the browser allows sound.
  // The home music stops, a gong rings on its own, then the calmer test track comes in under its tail.
  html(`<h1 class="brand test-title">${t.meta.title}</h1><div id="stage"></div>`, { testing: true, music: music && { track: 'test', after: 2.4 } });
  sfxGong(music ? undefined : { cutAt: 1.8 });
  track('test_start', t.meta.id);
  // pitch test: the gong is faded out by 1.8 s, and the first note waits until it is fully gone
  if (!music) await sleep(2000);
  if (id !== runId) return; // left during the gong
  let raw;
  try { raw = await t.run($('#stage')); } catch (e) { if (id === runId && e.message !== 'aborted') { console.error(e); html(`<p>Something went wrong. <button class="btn" id="b">Back</button></p>`); $('#b').onclick = home; } return; }
  await dialogClosed(); // the test ended (rotation timer) while "Leave this test?" was up: wait for the answer
  if (id !== runId) return; // they left
  runningTest = null;
  const s = t.score(raw);
  if (s.invalid) {
    track('test_retry', t.meta.id);
    html(`<h1 class="h2">${t.meta.title}</h1><div class="tile"><p>${s.invalid}</p></div><div class="btnrow actions"><button class="btn primary big" id="again">Try again</button><button class="btn big" id="back">Back</button></div>`, { fill: true });
    $('#again').onclick = () => intro(t); $('#back').onclick = home;
    return;
  }
  results[t.meta.id] = buildResult(t.meta, s, t.detail(s));
  track('test_done', t.meta.id); // which test, never the score
  await finished(t);
  result(t, { fresh: true });
}

// "Done!" screen between the last answer and the result card: a check mark pops in with a confetti burst
// and a "time's up" chime (no music), then the card comes up by itself (about 1.9 s; a tap or key press skips ahead).
// With reduced motion it is a still screen for a shorter moment.
const CONFETTI = ['var(--pink)', 'var(--yellow)', '#5ec8ff', '#7be0a0', 'var(--surface)'];
function finished(t) {
  const bits = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
    const d = 95 + Math.random() * 70;
    return `<i style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d)}px;--rot:${Math.round(Math.random() * 540 - 270)}deg;--d:${(0.15 + Math.random() * 0.12).toFixed(2)}s;--c:${CONFETTI[i % CONFETTI.length]};--r:${i % 3 ? '3px' : '50%'}"></i>`;
  }).join('');
  html(`
    <div class="done">
      <div class="done-badge">
        <div class="done-burst" aria-hidden="true">${bits}</div>
        <svg class="done-check" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/><path d="M37 62l16 16 31-33"/></svg>
      </div>
      <h1 class="done-title">Done!</h1>
      <p class="sub done-sub">${t.meta.title} finished. Here comes your card…</p>
    </div>`, { fill: true });
  sfxEnd();
  return new Promise((res) => {
    let over = false, armed = false;
    const go = () => {
      if (over || !armed) return;
      over = true; clearTimeout(timer);
      document.removeEventListener('keydown', go); document.removeEventListener('click', go);
      res();
    };
    document.addEventListener('keydown', go); document.addEventListener('click', go);
    // skipping only counts after a moment, so the tap or key press that answered the last round doesn't skip it
    setTimeout(() => { armed = true; }, 400);
    const timer = setTimeout(() => { armed = true; go(); }, reducedMotion() ? 1200 : 1900);
  });
}

// fresh: straight after the test, so the card arrives with a fanfare and the home music comes back after it
// (coming back from How we score, the music just carries on)
function result(t, { fresh = false } = {}) {
  const r = results[t.meta.id];
  let cv = renderCard({ name, result: r });
  let url = cv.toDataURL('image/png');
  const msg = shareMessage(t.meta, r);
  // the card file is made ahead of time: Safari only opens the share sheet if it is asked straight from the tap
  let file = null;
  const makeFile = () => cv.toBlob((b) => { if (b) file = new File([b], `latent-${t.meta.id}.png`, { type: 'image/png' }); }, 'image/png');
  makeFile();
  const others = TESTS.filter((o) => o.meta.id !== t.meta.id && !results[o.meta.id]);
  const strong = r.topPct <= 30;
  html(`
    <button class="back" id="back">← All tests</button>
    <h1 class="sr-only">Your ${t.meta.title.toLowerCase()} result</h1>
    <img class="card-img" src="${url}" alt="${esc(`Your result card. ${r.bigLines.join(' ')}, ${r.ability}. ${r.sentence} ${r.detail}`)}" />
    ${t.meta.resultNote ? `<p class="small note">${t.meta.resultNote}</p>` : ''}
    <div class="btnrow share-row reveal-late"><button class="btn primary big" id="share">${ICON_SHARE}Share</button><button class="btn big" id="save">Save card</button></div>

    ${strong ? `<div class="tile reveal-later"><h2>A head start, not destiny</h2>
      <p class="small">Fine ${esc(t.meta.verb)} gives you a head start. Whether you stick with something depends far more on practice and how the first month feels.</p>
      ${HOBBIES[t.meta.id].map((h) => `<div class="hobby"><h3>${h.title}</h3><p>${h.why}</p><p><b>Start this week:</b> ${h.start}</p><p class="small">${h.note}</p></div>`).join('')}</div>` : ''}
    ${others.length ? `<div class="tile nudge reveal-later"><h2 class="h3">${strong ? 'Curious where else you stand out?' : 'Not your standout. That is normal.'}</h2>
      <p>${strong ? 'Try' : 'Everyone is sharp in different places. Try'} ${others.map((o) => `<b>${o.meta.title}</b>`).join(' or ')} next.</p>
      <div class="btnrow">${others.map((o) => `<button class="btn" data-next="${o.meta.id}" aria-label="Try ${o.meta.title}">${o.meta.short}</button>`).join('')}</div></div>` : ''}
    <p class="small">Percentiles come from published research on lab samples and are approximate. This is a fun tool, not a clinical test. <button class="linkbtn small" id="how">How we score</button></p>`, { music: { track: 'home', after: fresh ? 1.4 : 0 } });
  if (fresh) sfxReveal();
  // re-draw the card in the new colours if the theme is switched on this screen
  screenThemeHook = () => {
    cv = renderCard({ name, result: r });
    url = cv.toDataURL('image/png');
    $('.card-img').src = url;
    makeFile();
  };
  $('#back').onclick = home;
  $('#how').onclick = () => howWeScore(() => result(t));
  app.querySelectorAll('[data-next]').forEach((b) => (b.onclick = () => intro(TESTS.find((o) => o.meta.id === b.dataset.next))));
  const download = () => { const a = document.createElement('a'); a.href = url; a.download = `latent-${t.meta.id}.png`; a.click(); };
  $('#save').onclick = () => { track('save', t.meta.id); download(); };
  // the phone's own share sheet (Instagram, WhatsApp, Facebook...) with the card, the message and the link.
  // A browser with no share sheet (some desktop browsers) saves the card and copies the message instead.
  $('#share').onclick = async () => {
    track('share', t.meta.id);
    const how = await shareResult({ file, text: msg });
    if (how !== 'unsupported') return;
    const copied = await copyCard({ file, dataUrl: url, text: msg });
    toast(copied === 'card' ? 'Card and link copied. Paste them anywhere.'
      : copied === 'text' ? 'Link copied. Tap Save card to add the picture.'
      : 'Could not copy here. Tap Save card, then share the card.');
  };
}

// "How we score": plain-language method page (copy in src/content/how-we-score.js).
// Also opens directly at #how-we-score, so it can be linked from outside the app.
//
// Layout (styles: "How we score layout" in src/styles.css): on phones each section folds open and shut
// (the first starts open), so the page is a short list of headings; from tablet width up every section
// is open, the three tests sit side by side, and on desktop a sticky list of section links sits on the
// left with the other sections in two columns. The copy file stays plain HTML; this function
// rearranges it, so pasting new copy from the doc keeps working.
function howWeScore(back = home) {
  track('how_we_score');
  html(`
    <div class="hws">
      <button class="back" id="back">← Back</button>
      <header class="hws-head"></header>
      <nav class="hws-toc" aria-label="On this page"><p class="hws-toc-label">On this page</p><ul></ul></nav>
      <div class="hws-body"><div class="hws-lead"></div><div class="hws-rest"></div></div>
      <div class="hws-foot"><button class="btn primary" id="done">Back to the tests</button></div>
    </div>
    <template id="hws-src">${HOW_WE_SCORE}</template>`, { wide: true });
  const src = $('#hws-src').content;
  const head = $('.hws-head'), toc = $('.hws-toc ul');
  [...src.children].forEach((el) => {
    if (!el.classList.contains('tile')) { head.append(el); return; }
    const h2 = el.querySelector('h2');
    const id = 'hws-' + h2.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    el.id = id; el.setAttribute('aria-labelledby', id + '-h'); h2.id = id + '-h';
    // fold-out panel for phones: everything after the heading
    const panel = document.createElement('div');
    panel.className = 'hws-panel'; panel.id = id + '-p';
    while (h2.nextSibling) panel.append(h2.nextSibling);
    el.append(panel);
    const first = toc.children.length === 0;
    if (!first) el.classList.add('collapsed');
    h2.innerHTML = `<button class="hws-toggle" aria-controls="${id}-p" aria-expanded="${first}">${h2.innerHTML}<span class="chev" aria-hidden="true"></span></button>`;
    h2.firstChild.onclick = () => {
      const open = el.classList.toggle('collapsed') === false;
      h2.firstChild.setAttribute('aria-expanded', String(open));
    };
    // the first section (the three tests) gets its own full-width row on desktop
    (first ? $('.hws-lead') : $('.hws-rest')).append(el);
    const li = document.createElement('li');
    li.innerHTML = `<button class="hws-link" data-to="${id}">${h2.textContent}</button>`;
    toc.append(li);
  });
  $('#hws-src').remove();
  // the fold-out toggles only act on phones; from tablet width up they are plain headings
  const phone = matchMedia('(max-width: 719px)');
  const syncToggles = () => app.querySelectorAll('.hws-toggle').forEach((b) => {
    if (phone.matches) { b.removeAttribute('tabindex'); b.setAttribute('aria-expanded', String(!b.closest('.tile').classList.contains('collapsed'))); }
    else { b.tabIndex = -1; b.removeAttribute('aria-expanded'); }
  });
  syncToggles();
  phone.onchange = () => { if (app.querySelector('.hws')) syncToggles(); };
  const h1 = head.querySelector('h1');
  if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
  app.querySelectorAll('.hws-link').forEach((b) => (b.onclick = () => {
    const t = document.getElementById(b.dataset.to);
    t.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    t.querySelector('h2').tabIndex = -1; t.querySelector('h2').focus({ preventScroll: true });
  }));
  $('#back').onclick = back;
  $('#done').onclick = home;
}

startAnalytics();
track('open');
if (location.hash === '#how-we-score') howWeScore(); else home();
if (new URLSearchParams(location.search).has('debug')) window.__latent = { results, TESTS, home, intro, result, howWeScore, buildResult, renderCard };
