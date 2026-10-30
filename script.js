const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

// Respect reduced motion: show the poster frame instead of playing work videos
if (reduceMotion) document.querySelectorAll('video[autoplay]').forEach(v => { v.removeAttribute('autoplay'); v.pause(); });

// Hand control back to the normal styles once the entrance has played
if (root.classList.contains('intro')) setTimeout(() => root.classList.remove('intro'), 2200);

document.getElementById('year').textContent = new Date().getFullYear();

// Cursor spotlight + per-card shimmer border
let mouseX = innerWidth / 2, mouseY = innerHeight / 3;
addEventListener('pointermove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  root.style.setProperty('--x', mouseX + 'px');
  root.style.setProperty('--y', mouseY + 'px');
  requestTick();
}, { passive: true });

document.querySelectorAll('.item').forEach(card => {
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--cx', e.clientX - r.left + 'px');
    card.style.setProperty('--cy', e.clientY - r.top + 'px');
  });
});

// Parallax: background layers drift at different speeds on scroll,
// and nudge slightly toward the cursor
const layers = [...document.querySelectorAll('.layer')].map(el => ({
  el,
  speed: parseFloat(el.dataset.speed) || 0,
  mouse: parseFloat(el.dataset.mouse) || 0,
}));
let ticking = false;
function requestTick() {
  if (!ticking && !reduceMotion) {
    ticking = true;
    requestAnimationFrame(update);
  }
}
function update() {
  const y = scrollY;
  const mx = (mouseX / innerWidth - 0.5);
  const my = (mouseY / innerHeight - 0.5);
  for (const { el, speed, mouse } of layers) {
    el.style.transform = `translate3d(${mx * mouse}px, ${y * speed + my * mouse}px, 0)`;
  }
  updateFeatured();
  updateReveals();
  ticking = false;
}

// Featured work: each image gently un-crops and settles as it scrolls into view,
// with the artwork drifting slightly inside its frame (parallax)
const medias = [...document.querySelectorAll('.fw-media')].map(el => ({ el, art: el.firstElementChild }));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function updateFeatured() {
  const vh = innerHeight;
  for (const { el, art } of medias) {
    const r = el.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) continue;
    const p = clamp((vh - r.top) / (vh * 0.75), 0, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.style.setProperty('--clip', ((1 - eased) * 4).toFixed(2) + '%');
    art.style.setProperty('--s', (1.08 - 0.08 * eased).toFixed(4));
    // Artwork slides inside its frame, capped so the edges never show
    const limit = r.height * 0.13;
    art.style.setProperty('--py', clamp((r.top + r.height / 2 - vh / 2) * -0.12, -limit, limit).toFixed(1) + 'px');
  }
}
addEventListener('resize', requestTick);
addEventListener('scroll', requestTick, { passive: true });

// Feature carousels: scroll-snapping tracks with dots and arrows
document.querySelectorAll('.project').forEach(project => {
  const track = project.querySelector('.track');
  const slides = [...track.children];
  const dots = [...project.querySelectorAll('.dot')];
  const prev = project.querySelector('.prev');
  const next = project.querySelector('.next');
  const offsetOf = i => slides[i].offsetLeft - slides[0].offsetLeft;
  const current = () => {
    if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 2) return slides.length - 1;
    let best = 0;
    slides.forEach((_, i) => { if (Math.abs(offsetOf(i) - track.scrollLeft) < Math.abs(offsetOf(best) - track.scrollLeft)) best = i; });
    return best;
  };
  const go = i => track.scrollTo({ left: offsetOf(clamp(i, 0, slides.length - 1)), behavior: reduceMotion ? 'auto' : 'smooth' });
  const sync = () => {
    const i = current();
    dots.forEach((d, n) => { d.classList.toggle('active', n === i); d.setAttribute('aria-current', n === i ? 'true' : 'false'); });
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
  };
  prev.addEventListener('click', () => go(current() - 1));
  next.addEventListener('click', () => go(current() + 1));
  dots.forEach((d, n) => d.addEventListener('click', () => go(n)));
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  sync();

});

// Mobile section labels lighten once they stick to the top of the screen
const stickyHeads = [...document.querySelectorAll('.mobile-heading')];
function updateStuck() {
  for (const h of stickyHeads) {
    const top = h.getBoundingClientRect().top;
    const sectionBottom = h.parentElement.getBoundingClientRect().bottom;
    h.classList.toggle('stuck', top <= 0.5 && sectionBottom > h.offsetHeight);
  }
}
addEventListener('scroll', updateStuck, { passive: true });
updateStuck();

// Highlight the nav item for the section in view
const navLinks = [...document.querySelectorAll('.nav a')];
const sections = navLinks.map(a => document.querySelector(a.getAttribute('href')));
function setActive() {
  const mid = innerHeight * 0.35;
  let current = sections[0];
  for (const s of sections) if (s.getBoundingClientRect().top <= mid) current = s;
  // At the very bottom, the last section wins
  if (innerHeight + scrollY >= document.body.scrollHeight - 4) current = sections[sections.length - 1];
  navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current.id));
}
addEventListener('scroll', setActive, { passive: true });
setActive();

// Hello in the languages of the markets I design for. Each greeting lights
// up its market on the map; hovering a pin or a country name takes over.
const greetings = [
  ['india', 'नमस्ते', 'hi'], ['uae', 'مرحبا', 'ar'], ['turkey', 'Merhaba', 'tr'], ['singapore', '你好', 'zh'],
  ['brazil', 'Olá', 'pt'], ['saudi', 'السلام عليكم', 'ar'], ['australia', 'G’day', 'en'], ['mexico', 'Hola', 'es'],
  ['egypt', 'أهلاً', 'ar'], ['southafrica', 'Sawubona', 'zu'],
];
const marketNames = Object.fromEntries([...document.querySelectorAll('.markets button')].map(b => [b.dataset.market, b.textContent]));
const hello = document.querySelector('.hello');
const helloWord = hello.querySelector('.hello-word');
const helloWhere = hello.querySelector('.hello-where');
const pins = [...document.querySelectorAll('.pin')];
const marketButtons = [...document.querySelectorAll('.markets button')];
const map = document.querySelector('.map');
const tip = document.querySelector('.map-tip');
let cycled = null, hovered = null, gi = -1;

function lightUp() {
  const key = hovered || cycled;
  pins.forEach(p => p.classList.toggle('active', p.dataset.market === key));
  marketButtons.forEach(b => b.classList.toggle('active', b.dataset.market === key));
}
function showTip(key) {
  if (!key) return tip.classList.remove('on');
  const pin = pins.find(p => p.dataset.market === key);
  const m = pin.getAttribute('transform').match(/translate\(([\d.]+) ([\d.]+)\)/);
  const g = greetings.find(x => x[0] === key);
  tip.textContent = `${marketNames[key]} · ${g[1]}`;
  const vb = pin.ownerSVGElement.viewBox.baseVal;
  tip.style.left = (m[1] / vb.width * 100) + '%';
  tip.style.top = (m[2] / vb.height * 100) + '%';
  tip.classList.add('on');
}
// Roll new text into a slot: the old word slides up and out, the new one
// rises in (letter by letter where the script allows it) and the slot's
// width eases to fit. Arabic and Devanagari stay whole so letters keep joining.
function roll(box, text, lang) {
  const old = box.querySelector('.roll');
  const next = document.createElement('span');
  next.className = 'roll';
  if (lang) { next.lang = lang; next.dir = lang === 'ar' ? 'rtl' : 'ltr'; }
  const splittable = /^[\p{Script=Latin}\p{Script=Han}\s’'-]+$/u.test(text);
  if (splittable) {
    for (const c of text) next.append(Object.assign(document.createElement('span'), { className: 'ch', textContent: c }));
  } else {
    next.textContent = text;
  }
  const from = box.getBoundingClientRect().width;
  Object.assign(next.style, { position: 'absolute', left: '0', top: '0' });
  box.append(next);
  const to = next.getBoundingClientRect().width;
  const settle = () => { old?.remove(); next.style.position = ''; box.style.width = ''; };
  if (reduceMotion || !old) return settle();

  const ease = 'cubic-bezier(0.65, 0, 0.35, 1)', dur = 600, stagger = 28;
  box.style.width = from + 'px';
  box.getBoundingClientRect(); // commit the start width before easing to the new one
  box.style.width = to + 'px';
  old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-100%)', opacity: 0 }],
    { duration: dur, easing: ease, fill: 'forwards' });
  const parts = splittable ? [...next.children] : [next];
  parts.forEach((el, i) => el.animate([{ transform: 'translateY(110%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
    { duration: dur, easing: ease, delay: i * stagger, fill: 'backwards' }));
  setTimeout(settle, dur + parts.length * stagger + 30);
}
function nextGreeting() {
  gi = (gi + 1) % greetings.length;
  const [key, word, lang] = greetings[gi];
  roll(helloWord, word, lang);
  roll(helloWhere, marketNames[key]);
  cycled = key;
  lightUp();
}
setTimeout(() => { nextGreeting(); setInterval(nextGreeting, 2600); }, 1800);

function hover(key) { hovered = key; lightUp(); showTip(key); }
pins.forEach(p => {
  p.addEventListener('pointerenter', () => hover(p.dataset.market));
  p.addEventListener('pointerleave', () => hover(null));
});
marketButtons.forEach(b => {
  b.addEventListener('pointerenter', () => hover(b.dataset.market));
  b.addEventListener('pointerleave', () => hover(null));
  b.addEventListener('focus', () => hover(b.dataset.market));
  b.addEventListener('blur', () => hover(null));
  b.addEventListener('click', () => hover(b.dataset.market)); // tap on touch screens
});

// Apple-style reveal: blocks start faded and slightly low, then darken and
// rise into place as they scroll up the screen. Tied to scroll position, so
// it reverses when scrolling back, and nearby blocks stagger naturally.
const reveals = reduceMotion ? [] :
  [...document.querySelectorAll('.section:not(#about) > p, .item, .map, .markets, .work-title, .project-title, .slide, .project-foot, .arrow-link')].map(el => {
    el.classList.add('reveal');
    return { el, y: 0 };
  });
function updateReveals() {
  const vh = innerHeight;
  for (const r of reveals) {
    // Undo our own offset so the measurement doesn't feed back into itself
    const top = r.el.getBoundingClientRect().top - r.y;
    const p = clamp((vh * 0.98 - top) / (vh * 0.3), 0, 1);
    const eased = 1 - Math.pow(1 - p, 2);
    r.y = (1 - eased) * 48;
    r.el.style.setProperty('--ro', (0.15 + 0.85 * eased).toFixed(3));
    r.el.style.setProperty('--ry', r.y.toFixed(1) + 'px');
  }
}

// First paint: everything above is defined, so run one full frame now
update();
