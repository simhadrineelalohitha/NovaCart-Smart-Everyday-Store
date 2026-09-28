// ════════════════════════════════════════════════════════════════
// js/products.js — Homepage Product Listing
// ════════════════════════════════════════════════════════════════
//
// Responsibilities:
//   1. Fetch products from the backend API
//   2. Show skeleton → grid (success) | error box | empty box
//   3. Render product cards with image, name, price, stock
//   4. Category filtering (filter bar pills + category cards)
//   5. Scroll to #products when a category card is clicked
//
// Depends on: api.js  (must load before this script)

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────
  let allProducts    = [];   // full list from API
  let activeCategory = 'all';

  // ── DOM refs ──────────────────────────────────────────────────
  const grid          = document.getElementById('product-grid');
  const skeletonGrid  = document.getElementById('skeleton-grid');
  const errorState    = document.getElementById('error-state');
  const emptyState    = document.getElementById('empty-state');
  const errorMessage  = document.getElementById('error-message');
  const countLabel    = document.getElementById('product-count-label');
  const filterBar     = document.getElementById('filter-bar');

  // ── Boot ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    wireCategoryCards();
  });

  // ════════════════════════════════════════════════════════════════
  // LOAD PRODUCTS — fetch from backend, handle all states
  // ════════════════════════════════════════════════════════════════
  async function loadProducts() {
    showSkeleton();

    try {
      // api.get() comes from api.js; returns { success, count, data }
      const response = await api.get('/products');
      const products = response.data || response;   // handle both shapes

      allProducts = Array.isArray(products) ? products : [];

      hideSkeleton();

      if (allProducts.length === 0) {
        showEmpty();
        setCountLabel(0, 'all');
        return;
      }

      buildFilterBar(allProducts);
      renderProducts(allProducts);
      setCountLabel(allProducts.length, 'all');

    } catch (err) {
      hideSkeleton();
      showError(err.message);
      console.error('[NovaCart] Failed to load products:', err);
    }
  }

  // Make loadProducts globally accessible for the "Try Again" button
  window.loadProducts = loadProducts;

  // ════════════════════════════════════════════════════════════════
  // RENDER PRODUCTS
  // ════════════════════════════════════════════════════════════════
  function renderProducts(products) {
    hideAll();

    if (products.length === 0) {
      showEmpty();
      return;
    }

    grid.innerHTML = products.map(buildProductCard).join('');
    grid.style.display = '';
  }

  // ── Build one product card's HTML ─────────────────────────────
  function buildProductCard(product) {
    const price    = parseFloat(product.price).toFixed(2);
    const rating   = Number(product.rating_stars) || 0;
    const ratingCount = Number(product.review_count) || 0;
    const inStock  = parseInt(product.stock, 10) > 0;
    const lowStock = parseInt(product.stock, 10) <= 5 && inStock;

    // Safely escape user-controlled strings going into HTML attributes
    const safeName = escapeHtml(product.name);
    const imageMarkup = product.image_url
      ? `<img class="product-card__image" src="${escapeHtml(product.image_url)}" alt="${safeName}" loading="lazy" onerror="this.hidden=true" />`
      : `<div class="product-card__image-fallback"><span>${escapeHtml(product.category || 'Product')}</span><strong>${safeName.charAt(0).toUpperCase()}</strong><small>Image unavailable</small></div>`;
    const ratingMarkup = `<div class="product-card__rating" aria-label="${rating.toFixed(1)} out of 5, ${ratingCount.toLocaleString()} ratings"><span aria-hidden="true">${'★'.repeat(Math.round(rating))}${'☆'.repeat(5 - Math.round(rating))}</span><span>${rating.toFixed(1)} (${ratingCount.toLocaleString()})</span></div>`;

    return `
      <article class="product-card" role="listitem"
               onclick="window.location.href='product.html?id=${product.id}'"
               tabindex="0"
               onkeydown="if(event.key==='Enter')window.location.href='product.html?id=${product.id}'"
               aria-label="${safeName}, $${price}">

        <div class="product-card__img-wrap">
          ${imageMarkup}
          ${!inStock ? `
            <div class="product-card__oos" aria-label="Out of stock">
              <span class="product-card__oos-label">Out of Stock</span>
            </div>` : ''}
        </div>

        <div class="product-card__body">
          <p class="product-card__category">${escapeHtml(product.category || 'General')}</p>
          <h3 class="product-card__name">${safeName}</h3>
          ${ratingMarkup}
          <p class="product-card__quality">Quality: ${escapeHtml(product.quality || 'Not rated')}</p>

          <div class="product-card__footer">
            <span class="product-card__price">$${price}</span>
            <span class="product-card__stock ${lowStock ? 'product-card__stock--low' : ''}">
              ${inStock
                ? (lowStock ? `Only ${product.stock} left` : `In Stock`)
                : 'Unavailable'}
            </span>
          </div>

          <button
            class="btn btn--primary product-card__btn"
            onclick="event.stopPropagation(); window.location.href='product.html?id=${product.id}'"
            ${!inStock ? 'disabled' : ''}
          >
            ${inStock ? 'View Product' : 'Out of Stock'}
          </button>
        </div>
      </article>
    `;
  }

  // ════════════════════════════════════════════════════════════════
  // FILTER BAR — pill buttons populated from product categories
  // ════════════════════════════════════════════════════════════════
  function buildFilterBar(products) {
    // Extract sorted unique categories
    const categories = [...new Set(
      products.map(p => p.category).filter(Boolean)
    )].sort();

    // Clear existing pills (keep the "All" button)
    filterBar.innerHTML = `<button class="filter-btn active" data-category="all">All</button>`;

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className        = 'filter-btn';
      btn.dataset.category = cat;
      btn.textContent      = cat;
      filterBar.appendChild(btn);
    });

    // Attach click handler to all pills (including "All")
    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      const category = btn.dataset.category;
      setActiveFilter(category);
    });
  }

  // ── Apply a category filter ───────────────────────────────────
  function setActiveFilter(category) {
    activeCategory = category;

    // Update pill active state
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });

    // Update category card active state
    document.querySelectorAll('.category-card').forEach(card => {
      card.classList.toggle('active', card.dataset.filter === category);
    });

    const filtered = category === 'all'
      ? allProducts
      : allProducts.filter(p => p.category === category);

    renderProducts(filtered);
    setCountLabel(filtered.length, category);
  }

  // Make setActiveFilter accessible globally (used by empty-state button)
  window.setActiveFilter = setActiveFilter;

  // ── Category cards (the emoji cards above) ────────────────────
  function wireCategoryCards() {
    document.querySelectorAll('.category-card').forEach(card => {
      card.addEventListener('click', () => {
        const category = card.dataset.filter;
        setActiveFilter(category);
        // Smooth scroll to products section
        document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  // ════════════════════════════════════════════════════════════════
  // UI STATE HELPERS
  // ════════════════════════════════════════════════════════════════
  function showSkeleton() {
    if (skeletonGrid) skeletonGrid.style.display = '';
    if (grid)         grid.style.display = 'none';
    if (errorState)   errorState.style.display = 'none';
    if (emptyState)   emptyState.style.display  = 'none';
    setCountLabel(null);
  }

  function hideSkeleton() {
    if (skeletonGrid) skeletonGrid.style.display = 'none';
  }

  function hideAll() {
    if (grid)       grid.style.display       = 'none';
    if (errorState) errorState.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
  }

  function showError(msg) {
    if (errorState)  errorState.style.display  = '';
    if (errorMessage) errorMessage.textContent = msg || 'Could not reach the server.';
    if (grid)        grid.style.display        = 'none';
    if (emptyState)  emptyState.style.display  = 'none';
    setCountLabel(0, activeCategory);
  }

  function showEmpty() {
    if (emptyState)  emptyState.style.display  = '';
    if (grid)        grid.style.display        = 'none';
    if (errorState)  errorState.style.display  = 'none';
  }

  function setCountLabel(count, category) {
    if (!countLabel) return;
    if (count === null) {
      countLabel.textContent = 'Loading products…';
      return;
    }
    if (count === 0) {
      countLabel.textContent = category === 'all'
        ? 'No products yet.'
        : `No products in "${category}".`;
      return;
    }
    countLabel.textContent = category === 'all'
      ? `${count} products available`
      : `${count} product${count !== 1 ? 's' : ''} in ${category}`;
  }

  // ════════════════════════════════════════════════════════════════
  // UTILITY — XSS prevention
  // ════════════════════════════════════════════════════════════════
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;');
  }

})();
