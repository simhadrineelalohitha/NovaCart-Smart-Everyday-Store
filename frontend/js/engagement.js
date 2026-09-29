function redirectToLogin() {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.href = `login.html?returnTo=${encodeURIComponent(returnTo)}`;
}

async function toggleWishlist(productId, button) {
  if (!isLoggedIn()) {
    redirectToLogin();
    return;
  }

  const saved = button.dataset.wishlisted === 'true';
  button.disabled = true;
  try {
    if (saved) {
      await api.delete(`/wishlist/${productId}`, true);
    } else {
      await api.post('/wishlist', { product_id: productId }, true);
    }
    button.dataset.wishlisted = String(!saved);
    button.textContent = saved ? '♡ Wishlist' : '♥ Saved';
  } catch (error) {
    if (error.message.toLowerCase().includes('already')) {
      button.dataset.wishlisted = 'true';
      button.textContent = '♥ Saved';
    } else {
      window.alert(error.message);
    }
  } finally {
    button.disabled = false;
  }
}

async function toggleCompare(productId, button) {
  if (!isLoggedIn()) {
    redirectToLogin();
    return;
  }

  const added = button.dataset.compared === 'true';
  button.disabled = true;
  try {
    if (added) {
      await api.delete(`/compare/${productId}`, true);
    } else {
      await api.post('/compare', { product_id: productId }, true);
    }
    button.dataset.compared = String(!added);
    button.textContent = added ? 'Compare' : 'Compared';
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
  }
}

window.toggleWishlist = toggleWishlist;
window.toggleCompare = toggleCompare;
