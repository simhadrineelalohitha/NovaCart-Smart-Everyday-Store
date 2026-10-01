document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('compare-list');
  const message = document.getElementById('compare-message');
  const clearButton = document.getElementById('clear-compare');
  if (!isLoggedIn()) {
    message.textContent = 'Please log in to compare products.';
    return;
  }

  async function loadComparison() {
    try {
      const response = await api.get('/compare', true);
      const items = response.data || [];
      container.replaceChildren();
      message.textContent = items.length ? `${items.length} of 4 products selected` : 'No products selected for comparison.';
      clearButton.hidden = !items.length;
      items.forEach(item => {
        const article = document.createElement('article');
        article.className = 'compare-product';
        const heading = document.createElement('h2');
        heading.textContent = item.name;
        const details = document.createElement('p');
        details.textContent = `${item.category || 'Product'} · ${formatPrice(item.price)} · ${item.stock > 0 ? 'In stock' : 'Out of stock'}`;
        const view = document.createElement('a');
        view.className = 'btn btn--outline';
        view.href = `product.html?id=${item.product_id}`;
        view.textContent = 'View product';
        const remove = document.createElement('button');
        remove.className = 'btn btn--primary';
        remove.textContent = 'Remove';
        remove.addEventListener('click', async () => {
          await api.delete(`/compare/${item.product_id}`, true);
          loadComparison();
        });
        article.append(heading, details, view, remove);
        container.append(article);
      });
    } catch (error) {
      message.textContent = error.message;
    }
  }

  clearButton.addEventListener('click', async () => {
    clearButton.disabled = true;
    await api.delete('/compare/clear', true);
    clearButton.disabled = false;
    loadComparison();
  });
  loadComparison();
});
