'use strict';

(function () {
  const { api, esc, fmtMoney, fmtDateTime, qsParam, toast } = window.App;
  const I = window.I18N;

  const lookupBox = document.getElementById('lookup-box');
  const orderBox = document.getElementById('order-box');
  const errorBox = document.getElementById('error-box');
  const form = document.getElementById('track-form');
  const codeInput = document.getElementById('code-input');

  const FLOW_PICKUP = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
  const FLOW_DELIVERY = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed'];

  let pollTimer = null;
  let currentCode = null;
  let lastOrder = null;

  function statusLabel(status) {
    return I.t('status_' + status);
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function friendlyError(err) {
    if (!navigator.onLine) return I.t('offlineTrack');
    const msg = (err && err.message) || '';
    // Uniform server 404 carries no detail; add a next-step hint instead.
    if (/not found|No order found/i.test(msg)) return msg + ' ' + I.t('invalidCodeHint');
    return msg;
  }

  async function loadOrder(code) {
    try {
      const data = await api.get('/api/orders/track/' + encodeURIComponent(code));
      render(data.order);
    } catch (err) {
      stopPolling();
      showLookup();
      showError(friendlyError(err));
    }
  }

  const TERMINAL_STATUSES = new Set(['completed', 'cancelled']);

  function render(order) {
    lastOrder = order;
    if (TERMINAL_STATUSES.has(order.status)) stopPolling();
    errorBox.classList.add('hidden');
    lookupBox.classList.add('hidden');
    orderBox.classList.remove('hidden');

    document.getElementById('order-head').innerHTML =
      '<div class="flex-between">' +
        '<div><h1 class="order-code">' + esc(order.code) + '</h1>' +
        '<p class="muted small mb-0">' + esc(order.restaurant_name) + ' &middot; ' +
        fmtDateTime(order.created_at) + '</p></div>' +
        '<span class="badge status-' + esc(order.status) + '">' + esc(statusLabel(order.status)) + '</span>' +
      '</div>';

    const flow = order.order_type === 'delivery' ? FLOW_DELIVERY.slice() : FLOW_PICKUP.slice();
    if (order.status === 'cancelled') {
      flow.push('cancelled');
    }
    const currentIdx = flow.indexOf(order.status);

    document.getElementById('timeline').innerHTML = flow.map((step, idx) => {
      const cls = step === order.status ? 'current' : idx < currentIdx ? 'done' : '';
      return '<li class="' + cls + '"><div class="tl-label">' + esc(statusLabel(step)) + '</div></li>';
    }).join('');

    const currency = order.currency;
    const rows = order.items.map((it) =>
      '<div class="total-row"><span>' + esc(it.quantity) + ' &times; ' + esc(it.item_name) +
      (((it.options || []).length)
        ? '<br><small>' + esc(it.options.map((o) => o.choice_name + (o.quantity > 1 ? ' ×' + o.quantity : '')).join(', ')) + '</small>'
        : '') +
      (it.is_preorder
        ? '<br><small>' + esc(I.t('preorderBadge')) + (it.preorder_note ? ': ' + esc(it.preorder_note) : '') + '</small>'
        : '') +
      '</span><span>' +
      fmtMoney(it.line_total_cents, currency) + '</span></div>'
    ).join('');

    const feeRow = order.order_type === 'delivery'
      ? '<div class="total-row"><span>' + esc(I.t('deliveryFee')) + '</span><span>' + fmtMoney(order.delivery_fee_cents, currency) + '</span></div>'
      : '';

    document.getElementById('order-items').innerHTML =
      '<h2 class="section-title">' + esc(I.t('orderSummary')) + '</h2>' + rows +
      feeRow +
      '<div class="total-row grand"><span>' + esc(I.t('total')) + '</span><span>' + fmtMoney(order.total_cents, currency) + '</span></div>';

    renderActions(order);
  }

  function canCancel(order) {
    return order.status === 'pending' || order.status === 'confirmed';
  }

  function renderActions(order) {
    const zone = document.getElementById('order-actions');
    const reorder = '/restaurant/' + encodeURIComponent(order.restaurant_slug) + '?reorder=' +
      encodeURIComponent(order.items.map((it) => it.menu_item_id + ':' + it.quantity).join(',')) +
      '&reorderFrom=' + encodeURIComponent(order.code);

    const btns = [];
    if (canCancel(order)) {
      btns.push(
        '<button id="cancel-order-btn" type="button" class="btn btn-danger">' + esc(I.t('cancelOrder')) + '</button>'
      );
    }
    btns.push(
      '<a class="btn btn-outline" href="' + esc(reorder) + '">' + esc(I.t('reorder')) + '</a>'
    );
    zone.innerHTML = '<div class="flex-between mt-2" style="gap:8px;justify-content:flex-end">' + btns.join('') + '</div>';

    const cancelBtn = document.getElementById('cancel-order-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        if (!confirm(I.t('cancelOrderConfirm'))) return;
        cancelBtn.disabled = true;
        try {
          const d = await api.post('/api/orders/cancel', { code: lastOrder.code });
          await loadOrder(d.order.code);
        } catch (err) {
          toast(err.message, 'error');
          cancelBtn.disabled = false;
        }
      });
    }
  }

  function startPolling(code) {
    stopPolling();
    currentCode = code;
    if (document.hidden) return;
    if (lastOrder && TERMINAL_STATUSES.has(lastOrder.status)) return;
    pollTimer = setInterval(() => {
      api.get('/api/orders/track/' + encodeURIComponent(code)).then((d) => render(d.order)).catch(() => {});
    }, 15000);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else if (currentCode && lastOrder && !TERMINAL_STATUSES.has(lastOrder.status)) {
      startPolling(currentCode);
      loadOrder(currentCode);
    }
  });

  function showLookup() {
    orderBox.classList.add('hidden');
    lookupBox.classList.remove('hidden');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = codeInput.value.trim().toUpperCase();
    if (!code) return;
    history.replaceState(null, '', '/track?code=' + encodeURIComponent(code));
    loadOrder(code).then(() => startPolling(code));
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    stopPolling();
    currentCode = null;
    lastOrder = null;
    history.replaceState(null, '', '/track');
    showLookup();
  });

  document.getElementById('refresh-btn').addEventListener('click', () => {
    if (currentCode) loadOrder(currentCode);
  });

  window.addEventListener('offline', () => showError(I.t('offlineTrack')));
  window.addEventListener('online', () => {
    if (currentCode) loadOrder(currentCode).then(() => startPolling(currentCode));
  });

  // Deep link support: /track?code=XXXX
  const initial = qsParam('code');
  if (initial && /^[A-Za-z0-9]{6,12}$/.test(initial)) {
    codeInput.value = initial.toUpperCase();
    loadOrder(initial.toUpperCase()).then(() => startPolling(initial.toUpperCase()));
  }

  // Re-render the visible order when the user switches language.
  I.onChange(() => {
    if (lastOrder && !orderBox.classList.contains('hidden')) render(lastOrder);
  });
})();
