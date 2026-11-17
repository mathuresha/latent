// Sharing a result: the card image, a short message and the link to the site, through the phone's own
// share sheet (Instagram, WhatsApp, Facebook, Messages, and so on).
//
// Order of attempts:
//   1. image + message + link        phones (Android Chrome, iOS Safari), Safari and Edge on desktop
//   2. message + link, no image      browsers that can share but not share files
//   3. copy card + message + link    browsers with no share sheet at all (some desktop browsers, and any
//                                    page served over plain http, such as `npm run dev` opened on a phone).
//                                    See copyCard() below.
//   4. copy message + link           if the browser will not put an image on the clipboard
//
// The link goes inside the message text, because several apps (WhatsApp, Instagram) keep only the text
// when an image is attached. It is not also passed as `url` with the image, or some apps show it twice.

import { formatTop } from './copy.js';

/* global __SITE_URL__ */
export const SITE_URL = (typeof __SITE_URL__ === 'string' ? __SITE_URL__ : location.origin) + '/';

/** The message that goes with a shared card. */
export function shareMessage(meta, r) {
  const brag = r.topPct <= 10 ? ` (top ${formatTop(r.shownTop)}%!)` : '';
  return `Hey, check out my ${meta.shareAs} result${brag} on Latent. Try finding out your talent too 👉 ${SITE_URL}`;
}

/**
 * Open the share sheet. Must be called straight from a tap, without awaiting anything first, or Safari
 * refuses: so the card file is made ahead of time and passed in.
 * Returns 'shared' | 'cancelled' | 'unsupported'.
 */
export async function shareResult({ file, text }) {
  const title = 'Latent';
  const attempts = [];
  if (file && navigator.canShare?.({ files: [file] })) attempts.push({ files: [file], title, text });
  if (navigator.share) attempts.push({ title, text, url: SITE_URL });
  for (const data of attempts) {
    try { await navigator.share(data); return 'shared'; }
    catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
      // NotAllowedError / TypeError / DataError: the browser refused this payload, try the next one
    }
  }
  return 'unsupported';
}

const escHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Put the card and the message (with the link) on the clipboard together, as one item with three formats:
 * the picture, plain text, and HTML holding both. What a paste gives depends on the app: email and docs
 * (Gmail, Outlook, Google Docs) take the card and the message together; chat apps (WhatsApp Web, Slack,
 * Instagram) take the card as a photo, and their text box takes the message.
 * Returns 'card' (card + message copied), 'text' (message only) or false (nothing copied).
 * Call straight from a tap with the file and its data: URL ready (Safari refuses a clipboard write that
 * waits on anything first), like shareResult().
 */
export async function copyCard({ file, dataUrl, text }) {
  if (file && dataUrl && window.ClipboardItem && navigator.clipboard?.write) {
    try {
      const html = `<p>${escHtml(text).replace(escHtml(SITE_URL), `<a href="${SITE_URL}">${SITE_URL}</a>`)}</p><img src="${dataUrl}" alt="My Latent result card" width="360">`;
      await navigator.clipboard.write([new ClipboardItem({
        'image/png': file,
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      })]);
      return 'card';
    } catch { /* this browser takes text only on the clipboard: fall through */ }
  }
  return (await copyText(text)) ? 'text' : false;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* ignore */ }
  ta.remove();
  return ok;
}
