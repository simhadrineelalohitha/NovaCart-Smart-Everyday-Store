// ════════════════════════════════════════════════════════════════
// js/checkout.js — Checkout Page Logic
// ════════════════════════════════════════════════════════════════
//
// 1. Reads the cart from localStorage and shows an order summary.
// 2. On "Place Order" click:
//    - If user is logged in: sends POST /api/orders to the backend.
//    - If not logged in: redirects to login.html.
// 3. On success: clears the cart and shows a confirmation message.
// ════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('checkout-container');
  const cart      = getCart();

  // Update nav auth links
  updateAuthNav();

  // Handle logout button
  const logoutBtn = document.getElementById('nav-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      removeToken();
      window.location.href = 'index.html';
    });
  }

  if (cart.length === 0) {
    container.innerHTML = `
      <p class="loading-text">Your cart is empty.</p>
      <a href="products.html" class="btn btn--primary" style="margin-top:1rem;">Shop Now</a>
    `;
    return;
  }

  renderCheckout(cart, container);
});

// ── updateAuthNav ─────────────────────────────────────────────
function updateAuthNav() {
  const loggedIn     = isLoggedIn();
  const loginLink    = document.getElementById('nav-login');
  const registerLink = document.getElementById('nav-register');
  const logoutLink   = document.getElementById('nav-logout');

  if (loginLink)    loginLink.style.display    = loggedIn ? 'none' : '';
  if (registerLink) registerLink.style.display = loggedIn ? 'none' : '';
  if (logoutLink)   logoutLink.style.display   = loggedIn ? ''     : 'none';
}

// ── renderCheckout ────────────────────────────────────────────
function renderCheckout(cart, container) {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let itemsHtml = '';
  cart.forEach(item => {
    itemsHtml += `
      <div class="checkout-item">
        <span class="checkout-item-name">${item.name}</span>
        <span class="checkout-item-qty">× ${item.quantity}</span>
        <span class="checkout-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="checkout-summary">
      <h2>Order Summary</h2>
      <div class="checkout-items">${itemsHtml}</div>
      <div class="checkout-total">
        <strong>Total: $${total.toFixed(2)}</strong>
      </div>
    </div>

    <div class="checkout-form-section">
      <h2>Shipping Details</h2>
      <form id="checkout-form">
        <div class="form-group">
          <label for="full-name">Full Name</label>
          <input type="text" id="full-name" placeholder="Rahul Sharma" required />
        </div>
        <div class="form-group">
          <label for="address">Delivery Address</label>
          <textarea id="address" rows="3" placeholder="123, Main Street, City, PIN" required></textarea>
        </div>
        <div class="form-group">
          <label for="phone">Phone Number</label>
          <input type="tel" id="phone" placeholder="9876543210" required />
        </div>
        <div id="checkout-message" class="auth-message" style="margin-bottom:.75rem;"></div>
        <button type="submit" class="btn btn--primary" id="place-order-btn">Place Order</button>
      </form>
    </div>
  `;

  document.getElementById('checkout-form').addEventListener('submit', handlePlaceOrder);
}

// ── handlePlaceOrder ──────────────────────────────────────────
async function handlePlaceOrder(e) {
  e.preventDefault();

  const msgBox = document.getElementById('checkout-message');
  const btn    = document.getElementById('place-order-btn');

  // Must be logged in to place an order
  if (!isLoggedIn()) {
    msgBox.textContent = 'Please log in to place an order.';
    msgBox.className   = 'auth-message error';
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Placing order…';
  msgBox.textContent = '';

  try {
    const data = await api.post('/orders', {}, true);

    // Success — clear cart and show confirmation
    clearCart();
    refreshCartBadge();

    document.getElementById('checkout-container').innerHTML = `
      <div class="order-success">
        <div class="success-icon">✅</div>
        <h2>Order Placed Successfully!</h2>
        <p>Order #${data.data.id} — Total: <strong>$${parseFloat(data.data.total_amount).toFixed(2)}</strong></p>
        <p style="color:#555; margin-top:.5rem;">Thank you for shopping with NovaCart!</p>
        <a href="tracking.html?orderId=${data.data.id}" class="btn btn--outline" style="margin-top:1.5rem;">Track Order</a>
        <a href="products.html" class="btn btn--primary" style="margin-top:1.5rem;">Continue Shopping</a>
      </div>
    `;
  } catch (err) {
    msgBox.textContent = err.message;
    msgBox.className   = 'auth-message error';
    btn.disabled    = false;
    btn.textContent = 'Place Order';
  }
}
