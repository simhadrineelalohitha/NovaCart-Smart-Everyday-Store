// ════════════════════════════════════════════════════════════════
// js/productsPage.js — Products Listing Page Logic
// ════════════════════════════════════════════════════════════════
//
// What this file does (in order):
//   1. On page load, fetch categories and the first product page
//   2. Read URL query params (?category=X&sort=Y&q=Z) — so links
//      from other pages can pre-filter this page
//   3. Build category filter pills from the product data
//   4. Handle server-side search (with 300ms debounce)
//   5. Handle category filter pills (no reload)
//   6. Handle server-side sort (no reload)
//   7. Show / hide "Clear filters" button and active chips
//   8. Render product cards with View Details + Add to Cart
//   9. "Add to Cart" stores to localStorage and shows a toast
//  10. Handle all states: skeleton → grid | error | empty
//
// Depends on: api.js (must load before this file)

(function () {
  'use strict';

  // ════════════════════════
  // STATE
  // ════════════════════════
  const PAGE_SIZE = 24;
  let currentPage = 1;
  let totalProducts = 0;
  let requestSequence = 0;
  let state = {
    search:   '',
    category: 'all',
    sort:     'default',
  };

  // ════════════════════════
  // DOM REFS
  // ════════════════════════
  const searchInput   = document.getElementById('search-input');
  const searchClear   = document.getElementById('search-clear');
  const filterPills   = document.getElementById('filter-pills');
  const sortSelect    = document.getElementById('sort-select');
  const clearBtn      = document.getElementById('clear-btn');
  const activeChips   = document.getElementById('active-chips');
  const skeletonGrid  = document.getElementById('skeleton-grid');
  const productGrid   = document.getElementById('product-grid');
  const errorState    = document.getElementById('error-state');
  const emptyState    = document.getElementById('empty-state');
  const errorDesc     = document.getElementById('error-desc');
  const emptyDesc     = document.getElementById('empty-desc');
  const resultSummary = document.getElementById('result-summary');
  const toast         = document.getElementById('toast');
  const loadMoreButton = document.getElementById('load-more-products');

  // ════════════════════════
  // BOOT
  // ════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    readUrlParams();      // pre-populate state from URL (e.g. ?category=Electronics)
    loadProducts();       // fetch from API
    wireControls();       // attach event listeners to search/sort/clear
    if (loadMoreButton) loadMoreButton.addEventListener('click', showMoreProducts);
  });

  // ════════════════════════
  // READ URL QUERY PARAMS
  // ════════════════════════
  // Allows: products.html?category=Electronics&sort=price-asc&q=keyboard
  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('category')) state.category = params.get('category');
    if (params.get('sort'))     state.sort      = params.get('sort');
    if (params.get('q'))        state.search    = params.get('q');

    // Reflect in UI before products load
    if (state.search && searchInput) {
      searchInput.value = state.search;
      if (searchClear) searchClear.style.display = '';
    }
    if (state.sort !== 'default' && sortSelect) {
      sortSelect.value = state.sort;
    }
  }

  // ════════════════════════
  // FETCH PRODUCTS
  // ════════════════════════
  async function loadProducts() {
    showSkeleton();

    try {
      const response = await api.get('/products/categories');
      buildCategoryPills(Array.isArray(response.data) ? response.data : []);
      syncPillState();          // highlight the pre-selected pill (from URL)
      await applyFilters();     // render the first matching page

    } catch (err) {
      showError(
        `Could not connect to the server.<br/>` +
        `<small>Details: ${escapeHtml(err.message)}</small>`
      );
      console.error('[NovaCart] Product fetch failed:', err);
    }
  }

  // Expose on window so the "Retry" button in the HTML can call it
  window.loadProducts = loadProducts;

  // ════════════════════════
  // WIRE CONTROLS
  // ════════════════════════
  function wireControls() {
    // ── Search (debounced) ──────────────────────────────────────
    let debounceTimer;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.search = searchInput.value.trim();
          if (searchClear) searchClear.style.display = state.search ? '' : 'none';
          applyFilters();
        }, 300);
      });
    }

    // Clear × button inside search box
    if (searchClear) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        state.search = '';
        searchClear.style.display = 'none';
        searchInput.focus();
        applyFilters();
      });
    }

    // ── Sort dropdown ───────────────────────────────────────────
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        state.sort = sortSelect.value;
        applyFilters();
      });
    }

    // ── Category pills (delegated) ──────────────────────────────
    if (filterPills) {
      filterPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;
        state.category = pill.dataset.category;
        syncPillState();
        applyFilters();
      });
    }

    // ── Clear all button ────────────────────────────────────────
    if (clearBtn) {
      clearBtn.addEventListener('click', clearAllFilters);
    }
  }

  // ════════════════════════
  // APPLY FILTERS + SORT
  // ════════════════════════
  // This is the heart of the page — called every time any control changes.
  // It never makes a new API call; it works entirely on allProducts in memory.
  async function applyFilters(page = 1, append = false) {
    const requestId = ++requestSequence;
    if (!append) showSkeleton();

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort: state.sort });
    if (state.category !== 'all') params.set('category', state.category);
    if (state.search) params.set('q', state.search);

    try {
      const response = await api.get(`/products?${params.toString()}`);
      if (requestId !== requestSequence) return;
      const products = Array.isArray(response.data) ? response.data : [];
      totalProducts = Number(response.count) || 0;
      currentPage = Number(response.page) || page;

      if (append) {
        productGrid.insertAdjacentHTML('beforeend', products.map(buildCard).join(''));
        wireCartButtons(productGrid.children.length - products.length);
        if (!products.length && productGrid.children.length === 0) showEmpty();
      } else {
        renderProducts(products);
      }

      updateResultSummary(totalProducts);
      updateActiveChips();
      updateClearButton();
      updateLoadMoreButton();
    } catch (err) {
      if (requestId === requestSequence) {
        showError(`Could not connect to the server.<br/><small>Details: ${escapeHtml(err.message)}</small>`);
        console.error('[NovaCart] Product fetch failed:', err);
      }
    }
  }

  // Expose for the empty-state button
  window.clearAllFilters = clearAllFilters;

  function clearAllFilters() {
    state.search   = '';
    state.category = 'all';
    state.sort     = 'default';

    if (searchInput)  searchInput.value = '';
    if (searchClear)  searchClear.style.display = 'none';
    if (sortSelect)   sortSelect.value  = 'default';
    syncPillState();
    applyFilters();
    searchInput && searchInput.focus();
  }

  // ════════════════════════
  // RENDER PRODUCTS
  // ════════════════════════
  function renderProducts(products) {
    hideSkeleton();
    hideError();

    if (products.length === 0) {
      showEmpty();
      return;
    }

    hideEmpty();
    productGrid.innerHTML = products.map(buildCard).join('');
    productGrid.style.display = '';

    wireCartButtons(0);
  }

  function showMoreProducts() {
    if (currentPage * PAGE_SIZE < totalProducts) applyFilters(currentPage + 1, true);
  }

  function wireCartButtons(firstCardIndex) {
    Array.from(productGrid.children).slice(firstCardIndex).forEach(card => {
      const button = card.querySelector('.product-card__btn--cart');
      if (button) button.addEventListener('click', handleAddToCart);
    });
  }

  function updateLoadMoreButton() {
    if (!loadMoreButton) return;
    const remaining = Math.max(0, totalProducts - currentPage * PAGE_SIZE);
    loadMoreButton.hidden = remaining <= 0;
    loadMoreButton.textContent = `Show ${Math.min(PAGE_SIZE, remaining)} more products`;
  }

  // ════════════════════════
  // BUILD PRODUCT CARD HTML
  // ════════════════════════
  function buildCard(product) {
    const price    = Number(product.price);
    const displayPrice = formatPrice(price);
    const rating   = Number(product.rating_stars) || 0;
    const ratingCount = Number(product.review_count) || 0;
    const stock    = parseInt(product.stock, 10);
    const inStock  = stock > 0;
    const lowStock = inStock && stock <= 5;
    const safeId   = Number(product.id);
    const safeName = escapeHtml(product.name);
    const safeCat  = escapeHtml(product.category || 'General');
    const safeImg  = escapeHtml(product.image_url || '');
    const imageMarkup = product.image_url
      ? `<img class="product-card__image" src="${escapeHtml(product.image_url)}" alt="${safeName}" loading="lazy" onerror="this.hidden=true" />`
      : `<div class="product-card__image-fallback"><span>${safeCat}</span><strong>${safeName.charAt(0).toUpperCase()}</strong><small>Image unavailable</small></div>`;
    const ratingMarkup = `<div class="product-card__rating" aria-label="${rating.toFixed(1)} out of 5, ${ratingCount.toLocaleString()} ratings"><span aria-hidden="true">${'★'.repeat(Math.round(rating))}${'☆'.repeat(5 - Math.round(rating))}</span><span>${rating.toFixed(1)} (${ratingCount.toLocaleString()})</span></div>`;

    const stockLabel = inStock
      ? (lowStock ? `⚡ Only ${stock} left` : '✓ In Stock')
      : '✕ Out of Stock';
    const stockClass = inStock
      ? (lowStock ? 'product-card__stock--low' : '')
      : 'product-card__stock--out';

    return `
      <article class="product-card" role="listitem">

        <div class="product-card__img-wrap">
          ${imageMarkup}
          ${!inStock ? `
            <div class="product-card__oos" aria-hidden="true">
              <span class="product-card__oos-label">Out of Stock</span>
            </div>` : ''}
        </div>

        <div class="product-card__body">
          <p class="product-card__category">${safeCat}</p>
          <h3 class="product-card__name">${safeName}</h3>
          ${ratingMarkup}
          <p class="product-card__quality">Quality: ${escapeHtml(product.quality || 'Not rated')}</p>

          <div class="product-card__meta">
            <span class="product-card__price">${displayPrice}</span>
            <span class="product-card__stock ${stockClass}">${stockLabel}</span>
          </div>
        </div>

        <div class="product-card__actions">
          <button
            class="product-card__btn product-card__btn--view"
            onclick="window.location.href='product.html?id=${safeId}'"
            aria-label="View details for ${safeName}"
          >View Details</button>

          <button
            class="product-card__btn product-card__btn--cart"
            data-id="${safeId}"
            data-name="${safeName}"
            data-price="${price}"
            data-image="${safeImg}"
            data-category="${safeCat}"
            ${!inStock ? 'disabled' : ''}
            aria-label="Add ${safeName} to cart"
          >${inStock ? 'Add to Cart' : 'Unavailable'}</button>
          <button class="product-card__btn" onclick="event.stopPropagation(); toggleWishlist(${safeId}, this)">♡ Wishlist</button>
          <button class="product-card__btn" onclick="event.stopPropagation(); toggleCompare(${safeId}, this)">Compare</button>
        </div>

      </article>
    `;
  }

  // ════════════════════════
  // ADD TO CART HANDLER
  // ════════════════════════
  function handleAddToCart(e) {
    const btn  = e.currentTarget;
    if (btn.disabled) return;

    const product = {
      id:        Number(btn.dataset.id),
      name:      btn.dataset.name,
      price:     btn.dataset.price,
      image_url: btn.dataset.image,
      category:  btn.dataset.category,
    };

    // addToCart() is defined in api.js
    const qty = addToCart(product);

    // Visual feedback on the button
    const original = btn.textContent;
    btn.textContent = '✓ Added!';
    btn.classList.add('added');
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('added');
      btn.disabled = false;
    }, 1500);

    showToast(`"${product.name}" added to cart (×${qty})`);
  }

  // ════════════════════════
  // CATEGORY PILLS
  // ════════════════════════
  function buildCategoryPills(categories) {
    // Keep the "All" pill, append the rest
    const allPill = filterPills.querySelector('[data-category="all"]');
    filterPills.innerHTML = '';
    if (allPill) filterPills.appendChild(allPill);

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className        = 'pill';
      btn.dataset.category = cat;
      btn.textContent      = cat;
      filterPills.appendChild(btn);
    });
  }

  function syncPillState() {
    document.querySelectorAll('.pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.category === state.category);
    });
  }

  // ════════════════════════
  // ACTIVE CHIPS (summary row)
  // ════════════════════════
  function updateActiveChips() {
    if (!activeChips) return;
    activeChips.innerHTML = '';

    if (state.category !== 'all') {
      activeChips.appendChild(makeChip(`Category: ${state.category}`, () => {
        state.category = 'all';
        syncPillState();
        applyFilters();
      }));
    }

    if (state.search) {
      activeChips.appendChild(makeChip(`Search: "${state.search}"`, () => {
        state.search = '';
        if (searchInput)  searchInput.value = '';
        if (searchClear)  searchClear.style.display = 'none';
        applyFilters();
      }));
    }

    if (state.sort !== 'default') {
      const label = {
        'price-asc':  'Price ↑',
        'price-desc': 'Price ↓',
        'name-asc':   'Name A→Z',
        'name-desc':  'Name Z→A',
      }[state.sort] || state.sort;

      activeChips.appendChild(makeChip(`Sort: ${label}`, () => {
        state.sort = 'default';
        if (sortSelect) sortSelect.value = 'default';
        applyFilters();
      }));
    }
  }

  function makeChip(label, onRemove) {
    const span = document.createElement('span');
    span.className = 'chip';
    span.innerHTML = `${escapeHtml(label)}
      <button class="chip__remove" aria-label="Remove filter: ${escapeHtml(label)}">✕</button>`;
    span.querySelector('.chip__remove').addEventListener('click', onRemove);
    return span;
  }

  // ════════════════════════
  // CLEAR BUTTON VISIBILITY
  // ════════════════════════
  function updateClearButton() {
    if (!clearBtn) return;
    const hasFilter = state.search || state.category !== 'all' || state.sort !== 'default';
    clearBtn.style.display = hasFilter ? '' : 'none';
  }

  // ════════════════════════
  // RESULT SUMMARY LABEL
  // ════════════════════════
  function updateResultSummary(count) {
    if (!resultSummary) return;
    if (count === 0) {
      resultSummary.textContent = 'No products match your filters.';
      return;
    }
    const parts = [];
    if (state.category !== 'all') parts.push(`in ${state.category}`);
    if (state.search)             parts.push(`matching "${state.search}"`);
    const qualifier = parts.length ? ` ${parts.join(', ')}` : '';
    resultSummary.textContent =
      `${count} product${count !== 1 ? 's' : ''}${qualifier}`;
  }

  // ════════════════════════
  // UI STATE MANAGEMENT
  // ════════════════════════
  function showSkeleton() {
    if (skeletonGrid)  skeletonGrid.style.display  = '';
    if (productGrid)   productGrid.style.display   = 'none';
    if (errorState)    errorState.style.display    = 'none';
    if (emptyState)    emptyState.style.display    = 'none';
    if (resultSummary) resultSummary.textContent   = 'Loading…';
  }

  function hideSkeleton() {
    if (skeletonGrid) skeletonGrid.style.display = 'none';
  }

  function showError(html) {
    hideSkeleton();
    if (errorState)  errorState.style.display  = '';
    if (errorDesc)   errorDesc.innerHTML        = html;
    if (productGrid) productGrid.style.display  = 'none';
    if (emptyState)  emptyState.style.display   = 'none';
    if (resultSummary) resultSummary.textContent = '—';
  }

  function hideError() {
    if (errorState) errorState.style.display = 'none';
  }

  function showEmpty() {
    if (emptyState)  emptyState.style.display  = '';
    if (productGrid) productGrid.style.display  = 'none';

    // Customise the empty message depending on whether filters are active
    const hasFilter = state.search || state.category !== 'all';
    if (emptyDesc) {
      emptyDesc.textContent = hasFilter
        ? 'No products match your current search and filters. Try clearing them.'
        : 'No products have been added yet. Check back soon!';
    }
  }

  function hideEmpty() {
    if (emptyState) emptyState.style.display = 'none';
  }

  // ════════════════════════
  // TOAST NOTIFICATION
  // ════════════════════════
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // ════════════════════════
  // UTILITY — XSS prevention
  // ════════════════════════
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;');
  }

})();
