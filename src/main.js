import * as pitch from './tests/pitch.js';
import * as memory from './tests/memory.js';
import * as rotation from './tests/rotation.js';
import { buildResult, formatTop } from './core/copy.js';
import { renderCard } from './core/card.js';
import { getCtx, playTone } from './core/audio.js';
import { HOBBIES } from './data/hobbies.js';
import { HOW_WE_SCORE } from './content/how-we-score.js';
import { currentTheme, toggleTheme, onThemeChange } from './core/theme.js';
import { logoSvg } from './core/logo.js';

const TESTS = [pitch, memory, rotation];
const app = document.getElementById('app');
const results = {}; // testId -> built result, kept in memory only
let name = '';
try { name = localStorage.getItem('latent.name') || ''; } catch { /* private mode */ }

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let screenThemeHook = null; // the current screen's reaction to a theme change, if any
let firstScreen = true;
const html = (s, { testing = false, wide = false } = {}) => {
  screenThemeHook = null;
  document.body.classList.toggle('testing', testing);
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
const $ = (sel) => app.querySelector(sel);

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
    <p class="small">For ages 18 and up. Nothing leaves your device. Your name stays in this browser and only appears on your card. Results are fun, not a medical or hearing test. <button class="linkbtn small" id="how">How we score</button></p>`);
  $('#how').onclick = () => howWeScore(home);
  $('#nm').oninput = (e) => {
    name = e.target.value.trim();
    try { localStorage.setItem('latent.name', name); } catch { /* ignore */ }
  };
  app.querySelectorAll('.test-card').forEach((b) => (b.onclick = () => intro(TESTS.find((t) => t.meta.id === b.dataset.id))));
}

function intro(t) {
  html(`
    <button class="back" id="back">← All tests</button>
    <h1 class="h2">${t.meta.title}</h1>
    <div class="tile"><ul class="steps">${t.meta.instructions.map((i) => `<li>${i}</li>`).join('')}</ul>
      <p class="small">${t.meta.time}</p></div>
    <button class="btn primary" id="go">${t.meta.needsAudio ? 'Next: sound check' : 'Start'}</button>`);
  $('#back').onclick = home;
  $('#go').onclick = () => (t.meta.needsAudio ? soundCheck(t) : play(t));
}

function soundCheck(t) {
  html(`
    <button class="back" id="back">← Back</button>
    <h1 class="h2">Sound check</h1>
    <div class="tile">
      <p>Find a quiet spot and put on headphones if you can. Turn your volume to a comfortable level, then play the tone.</p>
      <div class="btnrow"><button class="btn big" id="tone">▶ Play tone</button></div>
      <p class="small" id="sc-msg">You should hear a steady beep.</p>
    </div>
    <button class="btn primary" id="go" disabled>I heard it. Start</button>`);
  $('#back').onclick = () => intro(t);
  $('#tone').onclick = async () => {
    try { getCtx(); await playTone(440, 800); $('#go').disabled = false; $('#sc-msg').textContent = 'Heard it? Tap Start. If not, raise your volume or check your headphones and play again.'; }
    catch { $('#sc-msg').textContent = 'This browser could not play sound. Try Chrome or Safari.'; }
  };
  $('#go').onclick = () => play(t);
}

async function play(t) {
  html(`<h1 class="brand test-title">${t.meta.title}</h1><div id="stage"></div>`, { testing: true });
  let raw;
  try { raw = await t.run($('#stage')); } catch (e) { if (e.message !== 'aborted') { console.error(e); html(`<p>Something went wrong. <button class="btn" id="b">Back</button></p>`); $('#b').onclick = home; } return; }
  const s = t.score(raw);
  if (s.invalid) {
    html(`<h1 class="h2">${t.meta.title}</h1><div class="tile"><p>${s.invalid}</p></div><div class="btnrow"><button class="btn primary big" id="again">Try again</button><button class="btn big" id="back">Back</button></div>`);
    $('#again').onclick = () => intro(t); $('#back').onclick = home;
    return;
  }
  results[t.meta.id] = buildResult(t.meta, s, t.detail(s));
  result(t);
}

function result(t) {
  const r = results[t.meta.id];
  let cv = renderCard({ name, result: r });
  let url = cv.toDataURL('image/png');
  const others = TESTS.filter((o) => o.meta.id !== t.meta.id && !results[o.meta.id]);
  const strong = r.topPct <= 30;
  html(`
    <button class="back" id="back">← All tests</button>
    <h1 class="sr-only">Your ${t.meta.title.toLowerCase()} result</h1>
    <img class="card-img" src="${url}" alt="${esc(`Your result card. ${r.bigLines.join(' ')}, ${r.ability}. ${r.sentence} ${r.detail}`)}" />
    ${t.meta.resultNote ? `<p class="small note">${t.meta.resultNote}</p>` : ''}
    <div class="btnrow"><button class="btn primary big" id="save">Save card</button><button class="btn big" id="share">Share</button></div>
    ${strong ? `<div class="tile"><h2>A head start, not destiny</h2>
      <p class="small">Fine ${esc(t.meta.verb)} gives you a head start. Whether you stick with something depends far more on practice and how the first month feels.</p>
      ${HOBBIES[t.meta.id].map((h) => `<div class="hobby"><h3>${h.title}</h3><p>${h.why}</p><p><b>Start this week:</b> ${h.start}</p><p class="small">${h.note}</p></div>`).join('')}</div>` : ''}
    ${others.length ? `<div class="tile nudge"><h2 class="h3">${strong ? 'Curious where else you stand out?' : 'Not your standout. That is normal.'}</h2>
      <p>${strong ? 'Try' : 'Everyone is sharp in different places. Try'} ${others.map((o) => `<b>${o.meta.title}</b>`).join(' or ')} next.</p>
      <div class="btnrow">${others.map((o) => `<button class="btn" data-next="${o.meta.id}" aria-label="Try ${o.meta.title}">${o.meta.short}</button>`).join('')}</div></div>` : ''}
    <p class="small">Percentiles come from published research on lab samples and are approximate. This is a fun tool, not a clinical test. <button class="linkbtn small" id="how">How we score</button></p>`);
  // re-draw the card in the new colours if the theme is switched on this screen
  screenThemeHook = () => {
    cv = renderCard({ name, result: r });
    url = cv.toDataURL('image/png');
    $('.card-img').src = url;
  };
  $('#back').onclick = home;
  $('#how').onclick = () => howWeScore(() => result(t));
  app.querySelectorAll('[data-next]').forEach((b) => (b.onclick = () => intro(TESTS.find((o) => o.meta.id === b.dataset.next))));
  const download = () => { const a = document.createElement('a'); a.href = url; a.download = `latent-${t.meta.id}.png`; a.click(); };
  $('#save').onclick = download;
  $('#share').onclick = async () => {
    try {
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
      const file = new File([blob], `latent-${t.meta.id}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else download();
    } catch { /* user cancelled */ }
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
    t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    t.querySelector('h2').tabIndex = -1; t.querySelector('h2').focus({ preventScroll: true });
  }));
  $('#back').onclick = back;
  $('#done').onclick = home;
}

if (location.hash === '#how-we-score') howWeScore(); else home();
if (new URLSearchParams(location.search).has('debug')) window.__latent = { results, TESTS, home, intro, result, howWeScore, buildResult, renderCard };
