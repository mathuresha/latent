import * as pitch from './tests/pitch.js';
import * as memory from './tests/memory.js';
import * as rotation from './tests/rotation.js';
import { buildResult, formatTop } from './core/copy.js';
import { renderCard } from './core/card.js';
import { getCtx, playTone } from './core/audio.js';
import { HOBBIES } from './data/hobbies.js';
import { currentTheme, toggleTheme, onThemeChange } from './core/theme.js';

const TESTS = [pitch, memory, rotation];
const app = document.getElementById('app');
const results = {}; // testId -> built result, kept in memory only
let name = '';
try { name = localStorage.getItem('latent.name') || ''; } catch { /* private mode */ }

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let screenThemeHook = null; // the current screen's reaction to a theme change, if any
const html = (s, { testing = false } = {}) => {
  screenThemeHook = null;
  document.body.classList.toggle('testing', testing);
  app.innerHTML = s; window.scrollTo(0, 0);
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
    <div class="brand">LATENT</div>
    <h1>Find what you're strangely good at.</h1>
    <p class="sub">Three short tests. Each one tells you how rare your result is, then points you to something worth trying.</p>
    <label for="nm">Your first name (optional, for your card)</label>
    <input id="nm" type="text" maxlength="20" placeholder="e.g. Esha" value="${esc(name)}" autocomplete="off" />
    ${TESTS.map((t) => {
      const r = results[t.meta.id];
      return `<button class="tile test-card" data-id="${t.meta.id}">
        ${r ? `<span class="chip">${r.topPct <= 10 ? 'Top ' + formatTop(r.shownTop) + '%' : r.pill}</span>` : ''}
        <h3>${t.meta.title}</h3><p>${t.meta.blurb}</p><p class="small">${t.meta.time}</p></button>`;
    }).join('')}
    <p class="small">For ages 18 and up. Nothing leaves your device. Your name stays in this browser and only appears on your card. Results are fun, not a medical or hearing test.</p>`);
  $('#nm').oninput = (e) => {
    name = e.target.value.trim();
    try { localStorage.setItem('latent.name', name); } catch { /* ignore */ }
  };
  app.querySelectorAll('.test-card').forEach((b) => (b.onclick = () => intro(TESTS.find((t) => t.meta.id === b.dataset.id))));
}

function intro(t) {
  html(`
    <button class="back" id="back">← All tests</button>
    <h2>${t.meta.title}</h2>
    <div class="tile"><ul class="steps">${t.meta.instructions.map((i) => `<li>${i}</li>`).join('')}</ul>
      <p class="small">${t.meta.time}</p></div>
    <button class="btn primary" id="go">${t.meta.needsAudio ? 'Next: sound check' : 'Start'}</button>`);
  $('#back').onclick = home;
  $('#go').onclick = () => (t.meta.needsAudio ? soundCheck(t) : play(t));
}

function soundCheck(t) {
  html(`
    <button class="back" id="back">← Back</button>
    <h2>Sound check</h2>
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
  html(`<div class="brand">${t.meta.title}</div><div id="stage"></div>`, { testing: true });
  let raw;
  try { raw = await t.run($('#stage')); } catch (e) { if (e.message !== 'aborted') { console.error(e); html(`<p>Something went wrong. <button class="btn" id="b">Back</button></p>`); $('#b').onclick = home; } return; }
  const s = t.score(raw);
  if (s.invalid) {
    html(`<h2>${t.meta.title}</h2><div class="tile"><p>${s.invalid}</p></div><div class="btnrow"><button class="btn primary big" id="again">Try again</button><button class="btn big" id="back">Back</button></div>`);
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
    <img class="card-img" src="${url}" alt="Your result card" />
    <div class="btnrow"><button class="btn primary big" id="save">Save card</button><button class="btn big" id="share">Share</button></div>
    ${strong ? `<div class="tile"><h2>A head start, not destiny</h2>
      <p class="small">Fine ${esc(t.meta.verb)} gives you a head start. Whether you stick with something depends far more on practice and how the first month feels.</p>
      ${HOBBIES[t.meta.id].map((h) => `<div class="hobby"><h3>${h.title}</h3><p>${h.why}</p><p><b>Start this week:</b> ${h.start}</p><p class="small">${h.note}</p></div>`).join('')}</div>` : ''}
    ${others.length ? `<div class="tile nudge"><h3>${strong ? 'Curious where else you stand out?' : 'Not your standout. That is normal.'}</h3>
      <p>${strong ? 'Try' : 'Everyone is sharp in different places. Try'} ${others.map((o) => `<b>${o.meta.title}</b>`).join(' or ')} next.</p>
      <div class="btnrow">${others.map((o) => `<button class="btn" data-next="${o.meta.id}">${o.meta.short}</button>`).join('')}</div></div>` : ''}
    <p class="small">Percentiles come from published research on lab samples and are approximate. This is a fun tool, not a clinical test.</p>`);
  // re-draw the card in the new colours if the theme is switched on this screen
  screenThemeHook = () => {
    cv = renderCard({ name, result: r });
    url = cv.toDataURL('image/png');
    $('.card-img').src = url;
  };
  $('#back').onclick = home;
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

home();
if (new URLSearchParams(location.search).has('debug')) window.__latent = { results, TESTS, home, intro, result, buildResult, renderCard };
