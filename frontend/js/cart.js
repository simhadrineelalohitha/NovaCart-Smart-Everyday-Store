// ════════════════════════════════════════════════════════════════
// js/cart.js — Shopping Cart Page Logic
// ════════════════════════════════════════════════════════════════
//
// The cart is stored in localStorage (defined in api.js).
// This page reads from localStorage and renders the cart items.
// The "Proceed to Checkout" button is only shown when the cart
// has at least one item.
// ════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  refreshCartBadge();

  // Handle logout button
  const logoutBtn = document.getElementById('nav-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      removeToken();
      window.location.href = 'index.html';
    });
  }

  // Show/hide login & logout links
  updateAuthNav();
});

// ── updateAuthNav ─────────────────────────────────────────────
// Shows logout link if logged in, login/register links otherwise.
function updateAuthNav() {
  const loggedIn     = isLoggedIn();
  const loginLink    = document.getElementById('nav-login');
  const registerLink = document.getElementById('nav-register');
  const logoutLink   = document.getElementById('nav-logout');

  if (loginLink)    loginLink.style.display    = loggedIn ? 'none' : '';
  if (registerLink) registerLink.style.display = loggedIn ? 'none' : '';
  if (logoutLink)   logoutLink.style.display   = loggedIn ? ''     : 'none';
}

// ── renderCart ────────────────────────────────────────────────
// Reads the cart from localStorage and builds the HTML table.
function renderCart() {
  const cart       = getCart();
  const container  = document.getElementById('cart-container');
  const summary    = document.getElementById('cart-summary');
  const totalEl    = document.getElementById('cart-total');
  const messageEl  = document.getElementById('cart-message');

  if (cart.length === 0) {
    if (messageEl) messageEl.style.display = 'block';
    if (summary)   summary.style.display   = 'none';
    return;
  }

  if (messageEl) messageEl.style.display = 'none';

  // Build the cart items HTML
  let html = `
    <table class="cart-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Price</th>
          <th>Quantity</th>
          <th>Subtotal</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  let total = 0;

  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    html += `
      <tr data-id="${item.id}">
        <td class="cart-product-cell">
          ${item.image_url
            ? `<img src="${item.image_url}" alt="${item.name}" class="cart-thumb" onerror="this.hidden=true" />`
            : `<span class="cart-thumb-fallback" aria-label="No image available">${item.name.charAt(0).toUpperCase()}</span>`}
          <span>${item.name}</span>
        </td>
        <td>${formatPrice(item.price)}</td>
        <td>
          <div class="qty-control">
            <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
          </div>
        </td>
        <td>${formatPrice(subtotal)}</td>
        <td>
          <button class="btn-remove" onclick="deleteItem(${item.id})">✕</button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // Update totals
  if (totalEl) totalEl.textContent = formatPrice(total);
  if (summary)  summary.style.display = 'block';
}

// ── changeQty ─────────────────────────────────────────────────
// Increment or decrement a cart item's quantity. Removes if qty → 0.
function changeQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    removeFromCart(productId);
  } else {
    updateCartQuantity(productId, newQty);
  }
  renderCart();
}

// ── deleteItem ────────────────────────────────────────────────
function deleteItem(productId) {
  removeFromCart(productId);
  renderCart();
}
