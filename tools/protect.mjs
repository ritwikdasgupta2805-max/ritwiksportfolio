// Password-protects a case study page: the <body> is encrypted (AES-GCM, key from PBKDF2-SHA256)
// and replaced with a lock screen that decrypts it in the browser.
//
//   node tools/protect.mjs lock   <password> page.html [...]   encrypt pages in place
//   node tools/protect.mjs unlock <password> page.html [...]   restore the readable page to edit it
//
// The password is never stored in the repository.
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const ITER = 250000;
const b64 = (u8) => Buffer.from(u8).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));
const START = '<!-- protected:start -->', END = '<!-- protected:end -->';

async function key(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function lockScreen(payload) {
  return `${START}
  <div class="pw-gate">
    <a class="pw-back" href="/#work"><span aria-hidden="true">‹</span> Ritwik Dasgupta</a>
    <form class="pw-card" id="pw-form" autocomplete="off">
      <p class="pw-kicker">Case study · Amazon</p>
      <h1 class="pw-title" id="pw-title"></h1>
      <p class="pw-note">This case study is password protected.</p>
      <div class="pw-row">
        <input id="pw-input" type="password" placeholder="Password" aria-label="Password" autofocus required>
        <button type="submit">View</button>
      </div>
      <p class="pw-error" id="pw-error" role="alert" hidden>That password isn’t right. Try again.</p>
      <p class="pw-ask">Need access? <a href="mailto:ritwikdasgupta3@gmail.com">Ask me for the password</a></p>
    </form>
  </div>
  <script id="pw-data" type="application/json">${JSON.stringify(payload)}</script>
  <script>
    (() => {
      const d = JSON.parse(document.getElementById('pw-data').textContent);
      document.getElementById('pw-title').textContent = document.title.split(' — ')[0];
      const u = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
      async function open(pw) {
        const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
        const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: u(d.salt), iterations: d.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        const html = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u(d.iv) }, k, u(d.ct)));
        document.body.innerHTML = html;
        // Scripts inserted with innerHTML don't run, so re-create them
        document.body.querySelectorAll('script').forEach((old) => { const s = document.createElement('script'); s.textContent = old.textContent; old.replaceWith(s); });
        try { sessionStorage.setItem('pw', pw); } catch (e) {}
      }
      const form = document.getElementById('pw-form'), input = document.getElementById('pw-input'), err = document.getElementById('pw-error');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await open(input.value); } catch (x) { err.hidden = false; input.select(); }
      });
      // One password unlocks every case study for the rest of the visit
      let saved = null; try { saved = sessionStorage.getItem('pw'); } catch (e) {}
      if (saved) open(saved).catch(() => { try { sessionStorage.removeItem('pw'); } catch (e) {} });
    })();
  </script>
  ${END}`;
}

const [mode, password, ...files] = process.argv.slice(2);
if (!['lock', 'unlock'].includes(mode) || !password || !files.length) { console.error('usage: node tools/protect.mjs lock|unlock <password> page.html [...]'); process.exit(1); }

for (const f of files) {
  let html = readFileSync(f, 'utf8');
  const open = html.indexOf('<body'), bodyStart = html.indexOf('>', open) + 1, bodyEnd = html.lastIndexOf('</body>');
  const inner = html.slice(bodyStart, bodyEnd);
  if (mode === 'lock') {
    if (inner.includes(START)) { console.log(f, 'already locked'); continue; }
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(password, salt), new TextEncoder().encode(inner)));
    html = html.slice(0, bodyStart) + '\n' + lockScreen({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }) + '\n' + html.slice(bodyEnd);
    // Keep search engines out of the protected pages
    if (!html.includes('name="robots"')) html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="robots" content="noindex">');
    console.log(f, 'locked');
  } else {
    if (!inner.includes(START)) { console.log(f, 'not locked'); continue; }
    const d = JSON.parse(inner.slice(inner.indexOf('application/json">') + 18, inner.indexOf('</script>')));
    const plain = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(d.iv) }, await key(password, unb64(d.salt)), unb64(d.ct)));
    html = html.slice(0, bodyStart) + plain + html.slice(bodyEnd);
    console.log(f, 'unlocked');
  }
  writeFileSync(f, html);
}
