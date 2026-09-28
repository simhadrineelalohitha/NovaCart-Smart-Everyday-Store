// ════════════════════════════════════════════════════════════════
// js/api.js — Centralized API Utility + Cart Helpers
// ════════════════════════════════════════════════════════════════

// ── Backend Base URL ──────────────────────────────────────────
const API_BASE_URL = 'http://localhost:5000/api';

// ── Token Helpers ─────────────────────────────────────────────
function saveToken(token)  { localStorage.setItem('novacart_token', token); }
function getToken()        { return localStorage.getItem('novacart_token'); }
function removeToken()     {
  localStorage.removeItem('novacart_token');
  localStorage.removeItem('novacart_user');
}
function isLoggedIn()      { return Boolean(getToken()); }

// ── Core Fetch Wrapper ────────────────────────────────────────
async function apiRequest(endpoint, options = {}, auth = false) {
  const url     = `${API_BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (auth) {
    const token = getToken();
    if (!token) throw new Error('You must be logged in to perform this action.');
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const data     = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Something went wrong.');
  }
  return data;
}

// ── Convenience Methods ───────────────────────────────────────
const api = {
  get:    (endpoint, auth = false)       => apiRequest(endpoint, { method: 'GET' }, auth),
  post:   (endpoint, body, auth = false) => apiRequest(endpoint, { method: 'POST',   body: JSON.stringify(body) }, auth),
  put:    (endpoint, body, auth = false) => apiRequest(endpoint, { method: 'PUT',    body: JSON.stringify(body) }, auth),
  delete: (endpoint, auth = false)       => apiRequest(endpoint, { method: 'DELETE' }, auth),
};

// ════════════════════════════════════════════════════════════════
// LOCAL CART HELPERS
// ════════════════════════════════════════════════════════════════
// The cart is stored in localStorage as a JSON array:
//   [ { id, name, price, image_url, category, quantity } ]
//
// In Stage 4 this will sync to the backend API.
// For now it works entirely client-side so the UI is functional
// even before authentication is implemented.
// ════════════════════════════════════════════════════════════════

const CART_KEY = 'novacart_cart';

/** Read the cart from localStorage. Always returns an array. */
function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

/** Persist the cart array to localStorage and refresh badge. */
function saveCart(cartArray) {
  localStorage.setItem(CART_KEY, JSON.stringify(cartArray));
  refreshCartBadge();
}

/**
 * Add one unit of a product to the cart.
 * If the product already exists, increment its quantity.
 * Returns the new total quantity for that product.
 */
function addToCart(product) {
  const cart     = getCart();
  const existing = cart.find(item => item.id === product.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id:        product.id,
      name:      product.name,
      price:     product.price,
      image_url: product.image_url || '',
      category:  product.category  || '',
      quantity:  1,
    });
  }

  saveCart(cart);
  return existing ? existing.quantity : 1;
}

/** Remove a product from the cart completely. */
function removeFromCart(productId) {
  saveCart(getCart().filter(item => item.id !== productId));
}

/** Update the quantity of a product (removes it if qty ≤ 0). */
function updateCartQuantity(productId, quantity) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  if (quantity <= 0) { removeFromCart(productId); return; }
  item.quantity = quantity;
  saveCart(cart);
}

/** Get the total item count in the cart (sum of all quantities). */
function getCartCount() {
  return getCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
}

/** Clear the entire cart. */
function clearCart() {
  saveCart([]);
}

/** Update the cart badge in the navbar without a page reload. */
function refreshCartBadge() {
  const badge = document.getElementById('cart-count');
  if (!badge) return;
  const count        = getCartCount();
  badge.textContent  = count;
  badge.dataset.count = count;
}
