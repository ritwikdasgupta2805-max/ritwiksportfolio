const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

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

document.querySelectorAll('.item, .fw-card').forEach(card => {
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
const fwGrid = document.querySelector('.fw-grid');
const cards = [...document.querySelectorAll('.fw-card')].map((el, i) => ({ el, speed: i % 2 ? -0.1 : 0.05 }));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function updateFeatured() {
  const vh = innerHeight;
  const twoCols = innerWidth > 640;
  // Left and right columns drift at different speeds, each as one block.
  // The grid itself isn't transformed, so its position is stable to measure.
  const g = fwGrid.getBoundingClientRect();
  const fromCenter = clamp(g.top + g.height / 2 - vh / 2, -vh * 0.7, vh * 0.7);
  for (const { el, speed } of cards) {
    el.style.setProperty('--lift', twoCols ? (fromCenter * speed).toFixed(1) + 'px' : '0px');
  }
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

// Apple-style reveal: blocks start faded and slightly low, then darken and
// rise into place as they scroll up the screen. Tied to scroll position, so
// it reverses when scrolling back, and nearby blocks stagger naturally.
const reveals = reduceMotion ? [] :
  [...document.querySelectorAll('.section > p, .item, .fw-card, .arrow-link')].map(el => {
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
