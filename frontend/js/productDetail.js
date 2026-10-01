// ════════════════════════════════════════════════════════════════
// js/productDetail.js — Single Product Detail Page Logic
// ════════════════════════════════════════════════════════════════
//
// Steps this file performs:
//   1. Read ?id=<number> from the URL
//   2. Validate the ID (numeric, present)
//   3. Show skeleton → fetch from API → render detail OR error
//   4. Populate all fields: image, name, category, description,
//      price, stock badge, quantity selector, buttons
//   5. Enforce quantity limits (1 … stock)
//   6. Add to Cart → localStorage via api.js helpers → toast
//   7. Update browser tab title and breadcrumb
//
// Depends on: api.js (must load before this file)

(function () {
  'use strict';

  // ════════════════════════
  // DOM REFS
  // ════════════════════════
  const skeleton     = document.getElementById('pd-skeleton');
  const errorBox     = document.getElementById('pd-error');
  const errorTitle   = document.getElementById('pd-error-title');
  const errorDesc    = document.getElementById('pd-error-desc');
  const errorIcon    = document.getElementById('pd-error-icon');
  const layout       = document.getElementById('pd-layout');
  const breadcrumbBar  = document.getElementById('breadcrumb-bar');
  const breadcrumbName = document.getElementById('breadcrumb-name');

  // Detail fields
  const imgEl        = document.getElementById('pd-image');
  const imgFallback  = document.getElementById('pd-image-fallback');
  const categoryEl   = document.getElementById('pd-category');
  const nameEl       = document.getElementById('pd-name');
  const priceEl      = document.getElementById('pd-price');
  const stockWrap    = document.getElementById('pd-stock-wrap');
  const stockLabel   = document.getElementById('pd-stock-label');
  const descEl       = document.getElementById('pd-description');
  const ratingValueEl = document.getElementById('pd-rating-value');
  const ratingStarsEl = document.getElementById('pd-rating-stars');
  const ratingCountEl = document.getElementById('pd-rating-count');
  const qualityEl = document.getElementById('pd-quality');
  const reviewForm = document.getElementById('review-form');
  const reviewLoginPrompt = document.getElementById('review-login-prompt');
  const reviewCta = document.getElementById('review-cta');
  const reviewStatus = document.getElementById('review-status');
  const writtenReviews = document.getElementById('written-reviews');

  // Quantity control
  const qtyInput     = document.getElementById('pd-qty');
  const qtyDec       = document.getElementById('pd-qty-dec');
  const qtyInc       = document.getElementById('pd-qty-inc');
  const qtyMax       = document.getElementById('pd-qty-max');
  const actionsEl    = document.getElementById('pd-actions');
  const oosMsgEl     = document.getElementById('pd-oos-msg');

  // Cart + toast
  const cartBtn      = document.getElementById('pd-cart-btn');
  const wishlistBtn  = document.getElementById('pd-wishlist-btn');
  const compareBtn   = document.getElementById('pd-compare-btn');
  const toastEl      = document.getElementById('toast');

  // Product data (set after fetch)
  let product        = null;
  let currentProductId = null;

  // ════════════════════════
  // BOOT
  // ════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    reviewForm.addEventListener('submit', submitReview);
    reviewForm.hidden = !isLoggedIn();
    reviewLoginPrompt.hidden = isLoggedIn();
    reviewCta.href = isLoggedIn() ? '#review-form' : 'login.html';
    if (!isLoggedIn()) reviewCta.textContent = 'Log in to review';
    if (wishlistBtn) wishlistBtn.addEventListener('click', () => toggleWishlist(currentProductId, wishlistBtn));
    if (compareBtn) compareBtn.addEventListener('click', () => toggleCompare(currentProductId, compareBtn));
    const params = new URLSearchParams(window.location.search);
    const rawId  = params.get('id');
    currentProductId = rawId;

    // Validate: must be a numeric ID
    if (!rawId || isNaN(Number(rawId)) || Number(rawId) <= 0) {
      showError(
        '🔍',
        'Invalid product link',
        'The product ID in this URL is not valid. Please go back and click a product from the listing.',
        false   // no retry for invalid ID
      );
      return;
    }

    loadProduct(rawId);
  });

  // Retry button in error state calls this
  window.retryLoad = function () {
    if (currentProductId) loadProduct(currentProductId);
  };

  // ════════════════════════
  // FETCH + RENDER
  // ════════════════════════
  async function loadProduct(id) {
    showSkeleton();

    try {
      const response = await api.get(`/products/${id}`);

      // Our API returns { success: true, data: { ... } }
      product = response.data || response;

      if (!product || !product.id) {
        showError('🔍', 'Product not found',
          `No product exists with ID ${id}. It may have been removed.`, false);
        return;
      }

      renderProduct(product);

    } catch (err) {
      // 404 from server → product doesn't exist
      if (err.message && err.message.toLowerCase().includes('not found')) {
        showError('🔍', 'Product not found',
          `No product with ID ${id} exists in the store.`, false);
      } else {
        showError('🔌', 'Couldn\'t reach the server',
          `Please make sure the backend is running. (${err.message})`, true);
      }
      console.error('[NovaCart] Product detail fetch failed:', err);
    }
  }

  // ════════════════════════
  // RENDER PRODUCT
  // ════════════════════════
  function renderProduct(p) {
    const stock   = parseInt(p.stock, 10);
    const inStock = stock > 0;
    const lowStock = inStock && stock <= 5;

    // ── Image ──────────────────────────────────────────────────
    imgEl.alt = p.name;
    imgEl.hidden = !p.image_url;
    imgFallback.hidden = Boolean(p.image_url);
    imgFallback.replaceChildren();
    const fallbackCategory = document.createElement('span');
    fallbackCategory.textContent = p.category || 'Product';
    const fallbackInitial = document.createElement('strong');
    fallbackInitial.textContent = p.name.charAt(0).toUpperCase();
    const fallbackNote = document.createElement('small');
    fallbackNote.textContent = 'Image unavailable';
    imgFallback.append(fallbackCategory, fallbackInitial, fallbackNote);
    imgEl.onload = () => { imgEl.hidden = false; imgFallback.hidden = true; };
    imgEl.onerror = () => { imgEl.hidden = true; imgFallback.hidden = false; };
    if (p.image_url) {
      imgEl.src = p.image_url;
    } else {
      imgEl.removeAttribute('src');
    }

    // ── Text fields ────────────────────────────────────────────
    categoryEl.textContent = p.category || 'General';
    nameEl.textContent     = p.name;
    priceEl.textContent    = formatPrice(p.price);
    descEl.textContent     = p.description || 'No description available for this product.';
    updateRatingSummary({
      rating_stars: p.rating_stars,
      review_count: p.review_count,
      written_review_count: 0,
      quality: p.quality,
    });
    loadWrittenReviews(p.id);

    // ── Stock badge ────────────────────────────────────────────
    let status, labelText;
    if (!inStock) {
      status    = 'out';
      labelText = 'Out of Stock';
    } else if (lowStock) {
      status    = 'low';
      labelText = `Low Stock — only ${stock} left`;
    } else {
      status    = 'in';
      labelText = `In Stock (${stock} available)`;
    }
    stockWrap.dataset.status  = status;
    stockLabel.textContent    = labelText;

    // ── Quantity selector ──────────────────────────────────────
    if (inStock) {
      qtyInput.min   = 1;
      qtyInput.max   = stock;
      qtyInput.value = 1;
      qtyMax.textContent = `Max: ${stock}`;
      wireQuantityControl(stock);
      actionsEl.style.display = '';
      oosMsgEl.style.display  = 'none';
    } else {
      // Hide quantity + cart, show OOS message
      actionsEl.style.display = 'none';
      oosMsgEl.style.display  = '';
    }

    // ── Cart button ────────────────────────────────────────────
    if (inStock && cartBtn) {
      cartBtn.addEventListener('click', handleAddToCart);
    }

    // ── Page title & breadcrumb ────────────────────────────────
    document.title = `${p.name} — NovaCart`;
    if (breadcrumbName) {
      // Truncate long names for the breadcrumb
      const shortName = p.name.length > 40 ? p.name.slice(0, 40) + '…' : p.name;
      breadcrumbName.textContent = shortName;
    }
    if (breadcrumbBar) breadcrumbBar.style.display = '';

    // ── Show layout ────────────────────────────────────────────
    hideSkeleton();
    layout.style.display = '';
  }

  function updateRatingSummary(summary) {
    const rating = Number(summary.rating_stars) || 0;
    const count = Number(summary.review_count) || 0;
    const writtenCount = Number(summary.written_review_count) || 0;
    ratingValueEl.textContent = rating.toFixed(1);
    ratingStarsEl.textContent = `${'★'.repeat(Math.round(rating))}${'☆'.repeat(5 - Math.round(rating))}`;
    ratingStarsEl.setAttribute('aria-label', `${rating.toFixed(1)} out of 5`);
    ratingCountEl.textContent = `${count.toLocaleString()} sample ratings · ${writtenCount} written reviews`;
    qualityEl.textContent = `Quality: ${summary.quality || 'Not rated'}`;
  }

  async function loadWrittenReviews(id) {
    try {
      const response = await api.get(`/products/${id}/reviews`);
      updateRatingSummary(response.summary);
      renderWrittenReviews(response.data || []);
    } catch (err) {
      writtenReviews.textContent = `Reviews could not be loaded: ${err.message}`;
    }
  }

  function renderWrittenReviews(reviews) {
    writtenReviews.replaceChildren();
    if (!reviews.length) {
      const empty = document.createElement('p');
      empty.className = 'pd-reviews__empty';
      empty.textContent = 'No written shopper reviews yet.';
      writtenReviews.append(empty);
      return;
    }

    reviews.forEach(review => {
      const article = document.createElement('article');
      article.className = 'pd-review';
      const heading = document.createElement('h3');
      heading.textContent = review.title;
      const stars = document.createElement('p');
      stars.className = 'pd-review__stars';
      stars.setAttribute('aria-label', `${review.rating} out of 5 stars`);
      stars.textContent = `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}`;
      const body = document.createElement('p');
      body.textContent = review.body;
      const byline = document.createElement('small');
      byline.textContent = `${review.reviewer_name} · ${new Date(review.created_at).toLocaleDateString()}`;
      article.append(heading, stars, body, byline);
      writtenReviews.append(article);
    });
  }

  async function submitReview(event) {
    event.preventDefault();
    reviewStatus.textContent = '';
    const formData = new FormData(reviewForm);
    try {
      const response = await api.post(`/products/${product.id}/reviews`, {
        rating: Number(formData.get('rating')),
        title: formData.get('title'),
        body: formData.get('body'),
      }, true);
      updateRatingSummary(response.summary);
      reviewForm.reset();
      await loadWrittenReviews(product.id);
      reviewStatus.textContent = 'Your review has been published.';
    } catch (err) {
      reviewStatus.textContent = err.message;
    }
  }

  // ════════════════════════
  // QUANTITY CONTROL
  // ════════════════════════
  function wireQuantityControl(maxStock) {

    // Clamp a value between 1 and maxStock
    function clamp(val) {
      return Math.min(Math.max(1, val), maxStock);
    }

    // Update button disabled states after every change
    function syncButtons(val) {
      qtyDec.disabled = val <= 1;
      qtyInc.disabled = val >= maxStock;
    }

    // ─ Decrement button ─────────────────────────────────────
    qtyDec.addEventListener('click', () => {
      const next = clamp(parseInt(qtyInput.value, 10) - 1);
      qtyInput.value = next;
      syncButtons(next);
    });

    // ─ Increment button ─────────────────────────────────────
    qtyInc.addEventListener('click', () => {
      const next = clamp(parseInt(qtyInput.value, 10) + 1);
      qtyInput.value = next;
      syncButtons(next);
    });

    // ─ Direct input ─────────────────────────────────────────
    qtyInput.addEventListener('input', () => {
      // Allow empty input while user is typing
    });

    qtyInput.addEventListener('change', () => {
      const raw  = parseInt(qtyInput.value, 10);
      const next = isNaN(raw) ? 1 : clamp(raw);
      qtyInput.value = next;
      syncButtons(next);
    });

    // ─ Prevent non-numeric keys (except navigation) ──────────
    qtyInput.addEventListener('keydown', (e) => {
      const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
      if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) {
        e.preventDefault();
      }
      // Enter key confirms
      if (e.key === 'Enter') {
        qtyInput.dispatchEvent(new Event('change'));
        qtyInput.blur();
      }
    });

    // Initial state
    syncButtons(1);
  }

  // ════════════════════════
  // ADD TO CART
  // ════════════════════════
  function handleAddToCart() {
    if (!product) return;

    const stock    = parseInt(product.stock, 10);
    const qty      = parseInt(qtyInput.value, 10);
    const safeQty  = Math.min(Math.max(1, qty), stock);

    // Add each unit (addToCart increments by 1 each call)
    let lastQty;
    for (let i = 0; i < safeQty; i++) {
      lastQty = addToCart(product);  // from api.js
    }

    // Button feedback
    const original = cartBtn.textContent;
    cartBtn.textContent = `✓ Added ${safeQty > 1 ? `×${safeQty}` : ''}!`;
    cartBtn.classList.add('added');
    cartBtn.disabled = true;

    setTimeout(() => {
      cartBtn.textContent = original;
      cartBtn.classList.remove('added');
      cartBtn.disabled = false;
    }, 1800);

    showToast(`"${product.name}" × ${safeQty} added to cart`);
  }

  // ════════════════════════
  // TOAST
  // ════════════════════════
  let toastTimer;
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  // ════════════════════════
  // UI STATE HELPERS
  // ════════════════════════
  function showSkeleton() {
    if (skeleton)  skeleton.style.display  = '';
    if (layout)    layout.style.display    = 'none';
    if (errorBox)  errorBox.style.display  = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
  }

  function hideSkeleton() {
    if (skeleton) skeleton.style.display = 'none';
  }

  /**
   * @param {string}  icon       - Emoji for the error icon
   * @param {string}  title      - Bold heading
   * @param {string}  desc       - Explanatory sentence
   * @param {boolean} showRetry  - Whether to show the Retry button
   */
  function showError(icon, title, desc, showRetry = true) {
    hideSkeleton();
    if (layout)   layout.style.display   = 'none';
    if (errorBox) {
      errorBox.style.display = '';
      if (errorIcon)  errorIcon.textContent  = icon;
      if (errorTitle) errorTitle.textContent = title;
      if (errorDesc)  errorDesc.textContent  = desc;

      // Show or hide the retry button
      const retryBtn = errorBox.querySelector('button');
      if (retryBtn) retryBtn.style.display = showRetry ? '' : 'none';
    }
  }

})();
