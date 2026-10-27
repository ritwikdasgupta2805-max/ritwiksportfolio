// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Dark / light toggle (remembers choice)
const root = document.documentElement;
document.querySelector('.theme-toggle').addEventListener('click', () => {
  const current = root.dataset.theme ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
});

// Mobile menu
const menuBtn = document.querySelector('.menu-toggle');
const links = document.querySelector('.nav-links');
menuBtn.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
});
links.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => {
    links.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', false);
  })
);

// Fade sections in as they scroll into view
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.section').forEach(s => {
  s.classList.add('reveal');
  observer.observe(s);
});
