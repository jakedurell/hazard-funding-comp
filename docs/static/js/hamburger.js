// ==========================================================
// Mobile Navigation
//
// Controls the responsive hamburger menu used on smaller
// screen sizes.
//
// Responsibilities:
// • Toggle navigation visibility
// • Update accessibility attributes
// • Close the menu when clicking outside
// ==========================================================

document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.getElementById('site-nav-toggle');
  const nav = document.getElementById('site-nav-links');
  if (!toggle || !nav) return; // safe on pages without the menu

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    const isShown = nav.classList.toggle('show');
    nav.setAttribute('aria-hidden', String(!isShown));
    toggle.setAttribute('aria-expanded', String(isShown));
  });

  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target) && !toggle.contains(e.target)) {
      if (nav.classList.contains('show')) {
        nav.classList.remove('show');
        nav.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
      }
    }
  });
});