document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('wishlist-list');
  const message = document.getElementById('wishlist-message');
  if (!isLoggedIn()) {
    message.textContent = 'Please log in to view your wishlist.';
    return;
  }

  try {
    const response = await api.get('/wishlist', true);
    const items = response.data || [];
    if (!items.length) {
      message.textContent = 'Your wishlist is empty.';
      return;
    }

    message.textContent = `${items.length} saved product${items.length === 1 ? '' : 's'}`;
    items.forEach(item => {
      const article = document.createElement('article');
      article.className = 'saved-product';
      const heading = document.createElement('h2');
      heading.textContent = item.name;
      const details = document.createElement('p');
      details.textContent = `${item.category || 'Product'} · $${Number(item.price).toFixed(2)}`;
      const view = document.createElement('a');
      view.className = 'btn btn--outline';
      view.href = `product.html?id=${item.product_id}`;
      view.textContent = 'View product';
      const remove = document.createElement('button');
      remove.className = 'btn btn--primary';
      remove.textContent = 'Remove';
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        await api.delete(`/wishlist/${item.product_id}`, true);
        article.remove();
        const remaining = container.children.length;
        message.textContent = remaining ? `${remaining} saved product${remaining === 1 ? '' : 's'}` : 'Your wishlist is empty.';
      });
      article.append(heading, details, view, remove);
      container.append(article);
    });
  } catch (error) {
    message.textContent = error.message;
  }
});
