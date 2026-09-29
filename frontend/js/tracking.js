document.addEventListener('DOMContentLoaded', async () => {
  const message = document.getElementById('tracking-message');
  const timeline = document.getElementById('tracking-timeline');
  const orderId = new URLSearchParams(window.location.search).get('orderId');
  if (!isLoggedIn()) {
    message.textContent = 'Please log in to track an order.';
    return;
  }
  if (!orderId || !/^\d+$/.test(orderId)) {
    message.textContent = 'Enter a valid order number to track your order.';
    return;
  }

  try {
    const response = await api.get(`/orders/${orderId}/tracking`, true);
    const tracking = response.data;
    message.textContent = `Order #${tracking.order_id} · Current status: ${tracking.status}`;
    tracking.timeline.forEach(step => {
      const item = document.createElement('li');
      item.className = step.current ? 'tracking-step is-current' : (step.completed ? 'tracking-step is-complete' : 'tracking-step');
      item.textContent = step.status.charAt(0).toUpperCase() + step.status.slice(1);
      timeline.append(item);
    });
  } catch (error) {
    message.textContent = error.message;
  }
});
