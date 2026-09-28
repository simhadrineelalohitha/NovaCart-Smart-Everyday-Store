// ════════════════════════════════════════════════════════════════
// js/navbar.js — Navigation Bar Behaviour
// ════════════════════════════════════════════════════════════════
//
// Handles:
//   1. Scroll shadow on the navbar
//   2. Mobile hamburger menu open/close
//   3. Closing the drawer when a link is clicked
//   4. Auth state — showing Login/Register vs Logout
//   5. Cart badge count from localStorage

(function () {
  'use strict';

  const navbar     = document.getElementById('navbar');
  const hamburger  = document.getElementById('hamburger');
  const drawer     = document.getElementById('nav-drawer');

  // ── 1. Scroll shadow ──────────────────────────────────────────
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  // ── 2. Hamburger toggle ───────────────────────────────────────
  if (hamburger && drawer) {
    hamburger.addEventListener('click', () => {
      const isOpen = drawer.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
      drawer.setAttribute('aria-hidden', String(!isOpen));
    });
  }

  // ── 3. Close drawer on drawer-link click ─────────────────────
  if (drawer) {
    drawer.querySelectorAll('.navbar__drawer-link').forEach(link => {
      link.addEventListener('click', () => {
        drawer.classList.remove('open');
        if (hamburger) {
          hamburger.setAttribute('aria-expanded', 'false');
          drawer.setAttribute('aria-hidden', 'true');
        }
      });
    });
  }

  // ── 4. Auth state — show/hide login vs logout ─────────────────
  // `isLoggedIn` and `removeToken` come from api.js which loads first
  function updateAuthState() {
    const loggedIn = typeof isLoggedIn === 'function' && isLoggedIn();

    const loginEl    = document.getElementById('nav-login');
    const registerEl = document.getElementById('nav-register');
    const logoutEl   = document.getElementById('nav-logout');
    const dLogin     = document.getElementById('drawer-login');
    const dRegister  = document.getElementById('drawer-register');
    const dLogout    = document.getElementById('drawer-logout');

    const show = (el) => el && (el.style.display = '');
    const hide = (el) => el && (el.style.display = 'none');

    if (loggedIn) {
      hide(loginEl); hide(registerEl);
      hide(dLogin);  hide(dRegister);
      show(logoutEl); show(dLogout);
    } else {
      show(loginEl); show(registerEl);
      show(dLogin);  show(dRegister);
      hide(logoutEl); hide(dLogout);
    }
  }

  // Wire up logout buttons
  ['nav-logout', 'drawer-logout'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof removeToken === 'function') removeToken();
        window.location.href = 'index.html';
      });
    }
  });

  // ── 5. Cart badge ─────────────────────────────────────────────
  function updateCartBadge() {
    const badge = document.getElementById('cart-count');
    if (!badge) return;

    const cart  = JSON.parse(localStorage.getItem('novacart_cart') || '[]');
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

    badge.textContent = count;
    badge.dataset.count = count;  // used by CSS to hide when 0
  }

  // Run on load
  updateAuthState();
  updateCartBadge();

  // Re-check if another script modifies localStorage
  window.addEventListener('storage', updateCartBadge);

})();
