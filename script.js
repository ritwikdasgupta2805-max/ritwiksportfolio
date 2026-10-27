const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

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

document.querySelectorAll('.item, .case').forEach(card => {
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
  ticking = false;
}
addEventListener('scroll', requestTick, { passive: true });
update();

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

// Fade content in as it scrolls into view
if (!reduceMotion) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.section > p, .item, .case, .arrow-link').forEach(el => {
    el.classList.add('reveal');
    io.observe(el);
  });
}
