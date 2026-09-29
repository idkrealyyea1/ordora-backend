'use strict';

/**
 * Restaurant admin dashboard: dashboard, live orders (SSE), menu,
 * settings, analytics and sharing. All data flows through the REST API.
 */

(function () {
  const { api, esc, fmtMoney, fmtDateTime, debounce, toast } = window.App;
  const I = window.I18N;

  function statusLabel(status) {
    return I.t('status_' + status);
  }

  /* ----------------------------- state ------------------------------ */

  let me = null;
  let info = null;          // { restaurant:{...}, settings:{...}, openNow }
  let currency = 'USD';
  let items = [];
  let categories = [];
  const ordersCache = new Map();

  /* --------------------------- bootstrap ---------------------------- */

  async function boot() {
    try {
      const meData = await api.get('/api/auth/me');
      if (!meData.user) {
        location.href = '/login.html';
        return;
      }
      if (meData.user.role === 'owner') {
        location.href = '/owner.html';
        return;
      }
      me = meData.user;
      if (me.role === 'staff' && !new URLSearchParams(location.search).get('restaurantId')) {
        location.href = '/owner.html';
        return;
      }
      if (me.role === 'staff') {
        // hide delete UI for staff (server still enforces)
        const s = document.createElement('style');
        s.textContent = '[data-del-cat],[data-del-item],[data-del-order],[data-del-booking],[data-delete] { display:none !important; }';
        document.head.appendChild(s);
        // auto-append ?restaurantId= to all admin API calls for platform staff
        const rid = new URLSearchParams(location.search).get('restaurantId');
        if (rid) {
          const wrap = (fn) => function(path, ...args) {
            if (typeof path === 'string' && path.startsWith('/api/admin')) {
              const sep = path.includes('?') ? '&' : '?';
              path = path + sep + 'restaurantId=' + encodeURIComponent(rid);
            }
            return fn.call(this, path, ...args);
          };
          api.get = wrap(api.get.bind(api));
          api.post = wrap(api.post.bind(api));
          api.patch = wrap(api.patch.bind(api));
          api.put = wrap(api.put.bind(api));
          api.del = wrap(api.del.bind(api));
          api.request = wrap(api.request.bind(api));
          const origUpload = api.uploadWithProgress;
          api.uploadWithProgress = function(path, fd, cb) {
            if (path.startsWith('/api/admin')) {
              const sep = path.includes('?') ? '&' : '?';
              path = path + sep + 'restaurantId=' + encodeURIComponent(rid);
            }
            return origUpload.call(api, path, fd, cb);
          };
        }
      }

      await reloadInfo();
      bindChrome();
      switchTab('dashboard');
      connectEvents();
    } catch (err) {
      toast(err.message || I.t('failedLoad'), 'error');
    }
  }

  async function reloadInfo() {
    info = await api.get('/api/admin/restaurant');
    currency = info.settings.currency;
    document.getElementById('restaurant-name').textContent = info.restaurant.name;
    document.title = info.restaurant.name + ' — Dashboard';

    const logo = document.getElementById('brand-logo');
    if (info.settings.logoPath) {
      logo.src = info.settings.logoPath;
      logo.classList.remove('hidden');
    }

    renderOpenBadge();
  }

  function renderOpenBadge() {
    const badge = document.getElementById('open-badge');
    badge.innerHTML = info.restaurant.status === 'open'
      ? '<span class="badge badge-open">' + esc(I.t('openBadge')) + '</span>'
      : '<span class="badge badge-closed">' + esc(info.restaurant.status === 'temporarily_closed' ? I.t('tempClosedBadge') : I.t('closedBadge')) + '</span>';
  }

  function bindChrome() {
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await api.post('/api/auth/logout').catch(() => {});
      location.href = '/login.html';
    });

    // Modal close
    const backdrop = document.getElementById('modal-backdrop');
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  function switchTab(tab) {
    document.querySelectorAll('.side-link, .tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    ['dashboard', 'orders', 'bookings', 'menu', 'settings', 'analytics', 'share'].forEach((t) => {
      document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab);
    });
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'orders') loadOrders();
    if (tab === 'bookings') loadBookings();
    if (tab === 'menu') loadMenu();
    if (tab === 'settings') loadSettings();
    if (tab === 'analytics') loadAnalytics();
    if (tab === 'share') loadShare();
  }

  /* ----------------------------- modal ------------------------------- */

  function openModal(html) {
    document.getElementById('modal-box').innerHTML = html;
    document.getElementById('modal-backdrop').classList.add('open');
  }
  function closeModal() {
    document.getElementById('modal-backdrop').classList.remove('open');
  }

  /* --------------------------- dashboard ----------------------------- */

  async function loadDashboard() {
    const zone = document.getElementById('tab-dashboard');
    try {
      const d = await api.get('/api/admin/dashboard');
      const usage = d.maxMenuItems ? d.itemCount + ' / ' + d.maxMenuItems : String(d.itemCount);

      zone.innerHTML =
        '<div class="grid-stats mb-2">' +
          statCard(I.t('ordersToday'), d.counts.ordersToday) +
          statCard(I.t('pendingL'), d.counts.pendingOrders) +
          statCard(I.t('revenueToday'), fmtMoney(d.counts.revenueTodayCents, currency)) +
          statCard(I.t('menuItemsL'), usage) +
        '</div>' +
        '<div class="card"><div class="flex-between"><h2 class="section-title">' + esc(I.t('restaurantStatus')) + '</h2>' +
        '<button id="goto-settings" type="button" class="btn btn-outline btn-sm">' + esc(I.t('change')) + '</button></div>' +
        '<p>' + statusText(d.openNow) + '</p></div>' +
        '<div class="card mt-2"><div class="flex-between"><h2 class="section-title">' + esc(I.t('subscriptionH')) + '</h2>' +
          '<span class="badge ' + (d.subscription && d.subscription.active ? 'badge-open' : 'badge-closed') + '">' +
            esc(I.t(d.subscription && d.subscription.active ? 'subActive' : 'subExpired')) + '</span></div>' +
          '<p class="muted small mt-1">' + esc(I.t('subPrice')) + '</p>' +
          (d.subscription && d.subscription.endsAt
            ? '<p class="muted small">' + esc(I.t('subExpires')) + ' ' + fmtDateTime(d.subscription.endsAt) + '</p>'
            : '<p class="muted small">' + esc(I.t('subRenewHint')) + '</p>') +
        '</div>' +
        '<h2 class="section-title mt-2">' + esc(I.t('pendingOrdersH')) + '</h2><div id="dash-pending"></div>';

      document.getElementById('goto-settings').addEventListener('click', () => switchTab('settings'));

      const list = document.getElementById('dash-pending');
      const { orders } = await api.get('/api/admin/orders?status=pending&limit=10');
      list.innerHTML = orders.length
        ? orders.map(orderCardHtml).join('')
        : '<div class="empty-state card">' + esc(I.t('noPending')) + '</div>';
      wireOrderActions(list);
    } catch (err) {
      zone.innerHTML = errorHtml(err);
    }
  }

  function statCard(label, value) {
    return '<div class="stat"><div class="stat-label">' + esc(String(label)) + '</div><div class="stat-value">' + esc(String(value)) + '</div></div>';
  }

  function statusText(openNow) {
    if (!info.restaurant.status || info.restaurant.status === 'open') {
      return openNow ? I.t('openAccepting') : I.t('openOutsideHours');
    }
    return I.t('closedNoOrders');
  }

  /* ----------------------------- orders ------------------------------ */

  const NEXT_ACTIONS = {
    pending: [['confirmed', 'actConfirm', 'btn-success'], ['cancelled', 'actCancel', 'btn-outline']],
    confirmed: [['preparing', 'actPreparing', 'btn-secondary'], ['cancelled', 'actCancel', 'btn-outline']],
    preparing: [['ready', 'actReady', 'btn-secondary'], ['cancelled', 'actCancel', 'btn-outline']],
    ready: null, // depends on order_type
    out_for_delivery: [['completed', 'actComplete', 'btn-success']],
    completed: [],
    cancelled: [],
  };

  function actionsFor(order) {
    let defs = NEXT_ACTIONS[order.status];
    if (order.status === 'ready') {
      defs = order.order_type === 'delivery'
        ? [['out_for_delivery', 'actOut', 'btn-secondary'], ['completed', 'actComplete', 'btn-success']]
        : [['completed', 'actComplete', 'btn-success']];
    }
    return defs || [];
  }

  function orderCardHtml(o) {
    const lines = o.items
      ? o.items.map((it) => '<li>' + esc(it.quantity) + ' &times; ' + esc(it.item_name) + '</li>').join('')
      : '';

    const actions = actionsFor(o).map(([next, labelKey, cls]) =>
      '<button type="button" class="btn btn-sm ' + cls + '" data-order="' + esc(o.id) + '" data-next="' + next + '">' + esc(I.t(labelKey)) + '</button>'
    ).join('');

    const canDelete = o.status === 'completed' || o.status === 'cancelled';
    const deleteBtn = canDelete
      ? '<button type="button" class="btn btn-danger btn-sm" data-del-order="' + esc(o.id) + '" data-code="' + esc(o.code) + '">' + esc(I.t('del')) + '</button>'
      : '';
    const actionsBar = (actions || deleteBtn)
      ? '<div class="order-actions">' + actions + deleteBtn + '</div>'
      : '';

    return (
      '<article class="card order-card" id="order-' + esc(o.id) + '">' +
        '<div class="order-head">' +
          '<span class="order-code">' + esc(o.code) + '</span>' +
          '<span class="badge status-' + esc(o.status) + '">' + esc(statusLabel(o.status)) + '</span>' +
        '</div>' +
        '<div class="order-meta mt-1">' +
          esc(o.customer_name) + ' &middot; ' + esc(o.customer_whatsapp) + ' &middot; ' +
          esc(o.order_type) + ' &middot; ' + fmtDateTime(o.created_at) +
        '</div>' +
        (o.items
          ? '<ul class="order-lines small">' + lines + '</ul>' +
            '<strong>' + esc(I.t('totalW')) + ' ' + fmtMoney(o.total_cents, currency) + '</strong>'
          : '<div class="mt-1"><button type="button" class="btn btn-outline btn-sm" data-expand="' + esc(o.id) + '">' + esc(I.t('details')) + '</button> <strong id="sum-' + esc(o.id) + '">' + fmtMoney(o.total_cents, currency) + '</strong></div>') +
        (o.notes ? '<p class="small mt-1"><em>' + esc(I.t('noteW')) + ' ' + esc(o.notes) + '</em></p>' : '') +
        actionsBar +
      '</article>'
    );
  }

  function wireOrderActions(rootEl) {
    rootEl.querySelectorAll('[data-order]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const res = await api.patch('/api/admin/orders/' + btn.dataset.order + '/status', { status: btn.dataset.next });
          toast(I.t('status_' + res.order.status) + ' ← ' + res.order.code, 'success');
          refreshCurrentOrdersView();
          if (!document.getElementById('tab-dashboard').classList.contains('hidden')) loadDashboard();
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });

    rootEl.querySelectorAll('[data-del-order]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(I.t('delOrderConfirm', { code: btn.dataset.code }))) return;
        btn.disabled = true;
        try {
          const id = btn.dataset.delOrder;
          await api.del('/api/admin/orders/' + id);
          toast(I.t('orderDeleted'), 'success');
          const card = document.getElementById('order-' + id);
          if (card) card.remove();
          refreshCurrentOrdersView();
          if (!document.getElementById('tab-dashboard').classList.contains('hidden')) loadDashboard();
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });

    rootEl.querySelectorAll('[data-expand]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = await api.get('/api/admin/orders/' + btn.dataset.expand);
          const el = document.getElementById('order-' + btn.dataset.expand);
          const head = el.querySelector('.order-head');
          if (!el.querySelector('.order-lines')) {
            head.insertAdjacentHTML('afterend',
              '<ul class="order-lines small">' +
              res.order.items.map((it) => '<li>' + esc(it.quantity) + ' &times; ' + esc(it.item_name) + ' — ' + fmtMoney(it.line_total_cents, currency) + '</li>').join('') +
              '</ul>');
          }
          btn.remove();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  }

  let ordersFilter = '';
  let ordersPage = 1;

  async function loadOrders() {
    const zone = document.getElementById('tab-orders');

    if (!zone.dataset.built) {
      zone.innerHTML =
        '<div class="flex-between mb-2">' +
          '<h1 class="section-title">' + esc(I.t('ordersTab')) + '</h1>' +
          '<select id="orders-filter">' +
            '<option value="">' + esc(I.t('allStatuses')) + '</option>' +
            ['pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled']
              .map((k) => '<option value="' + k + '">' + esc(statusLabel(k)) + '</option>').join('') +
          '</select>' +
        '</div>' +
        '<div id="orders-list"></div>' +
        '<div class="flex-between mt-2">' +
          '<button id="orders-prev" type="button" class="btn btn-outline btn-sm">' + esc(I.t('prev')) + '</button>' +
          '<span id="orders-page-info" class="muted small"></span>' +
          '<button id="orders-next" type="button" class="btn btn-outline btn-sm">' + esc(I.t('next')) + '</button>' +
        '</div>';
      zone.dataset.built = '1';
      document.getElementById('orders-filter').addEventListener('change', (e) => {
        ordersFilter = e.target.value;
        ordersPage = 1;
        fetchOrders();
      });
      document.getElementById('orders-prev').addEventListener('click', () => {
        if (ordersPage > 1) { ordersPage--; fetchOrders(); }
      });
      document.getElementById('orders-next').addEventListener('click', () => { ordersPage++; fetchOrders(); });
    }
    fetchOrders();
  }

  async function fetchOrders() {
    const list = document.getElementById('orders-list');
    list.innerHTML = '<div class="empty-state">' + esc(I.t('loading')) + '</div>';
    try {
      const q = '?page=' + ordersPage + '&limit=20' + (ordersFilter ? '&status=' + ordersFilter : '');
      const data = await api.get('/api/admin/orders' + q);

      // Cache full objects for SSE-driven updates.
      for (const summary of data.orders) ordersCache.set(summary.id, summary);

      const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
      ordersPage = Math.min(ordersPage, totalPages);

      list.innerHTML = data.orders.length
        ? data.orders.map(orderCardHtml).join('')
        : '<div class="empty-state card">' + esc(I.t('noOrders')) + '</div>';
      document.getElementById('orders-page-info').textContent =
        I.t('pageInfo', { p: ordersPage, t: totalPages, n: data.total });
      wireOrderActions(list);
    } catch (err) {
      list.innerHTML = errorHtml(err);
    }
  }

  function refreshCurrentOrdersView() {
    if (!document.getElementById('tab-orders').classList.contains('hidden')) fetchOrders();
  }

  /* --------------------------- bookings ------------------------------ */

  let bookingsFilter = '';
  let bookingsPage = 1;

  function formatBookingDate(value) {
    try { return new Date(value).toLocaleString(); } catch (_) { return String(value); }
  }

  function bookingStatusLabel(status) {
    const map = { pending: I.t('pendingL'), confirmed: I.t('bookingConfirmed'), cancelled: I.t('bookingCancelled'), completed: 'Completed', noshow: 'No-show' };
    return map[status] || status;
  }

  function bookingCardHtml(b) {
    const badgeClass = b.status === 'confirmed' ? 'badge-open' : b.status === 'pending' ? 'badge-warn' : 'badge-closed';
    return '<div class="card mb-1" data-booking="' + esc(b.id) + '">' +
      '<div class="flex-between">' +
        '<div><strong>' + esc(b.customer_name) + '</strong> <span class="badge ' + badgeClass + '">' + esc(bookingStatusLabel(b.status)) + '</span>' +
        '<div class="muted small">' + esc(b.customer_whatsapp) + (b.customer_phone ? ' · ' + esc(b.customer_phone) : '') + '</div>' +
        '<div class="muted small">' + esc(I.t('tablesCount')) + ': ' + esc(String(b.tables_count)) + ' · ' + esc(formatBookingDate(b.booked_at)) + '</div>' +
        (b.notes ? '<div class="muted small">' + esc(b.notes) + '</div>' : '') +
        '<div class="muted small">Code: ' + esc(b.code) + '</div></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">' + bookingActionsHtml(b) + '</div>' +
      '</div></div>';
  }

  function bookingActionsHtml(b) {
    if (b.status === 'pending') {
      return '<button type="button" class="btn btn-sm" data-confirm-booking="' + esc(b.id) + '">' + esc(I.t('confirmBooking')) + '</button> ' +
        '<button type="button" class="btn btn-outline btn-sm" data-confirm-wa="' + esc(b.id) + '">' + esc(I.t('confirmViaWhatsapp')) + '</button> ' +
        '<button type="button" class="btn btn-danger btn-sm" data-cancel-booking="' + esc(b.id) + '">' + esc(I.t('actCancel')) + '</button>';
    }
    if (b.status === 'confirmed') {
      return '<button type="button" class="btn btn-outline btn-sm" data-complete-booking="' + esc(b.id) + '">Completed</button> ' +
        '<button type="button" class="btn btn-danger btn-sm" data-cancel-booking="' + esc(b.id) + '">' + esc(I.t('actCancel')) + '</button>';
    }
    return '<button type="button" class="btn btn-danger btn-sm" data-del-booking="' + esc(b.id) + '">' + esc(I.t('del')) + '</button>';
  }

  function wireBookingActions(container) {
    container.querySelectorAll('[data-confirm-booking]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await api.patch('/api/admin/bookings/' + btn.dataset.confirmBooking + '/status', { status: 'confirmed' });
          toast(I.t('bookingConfirmed'), 'success');
          fetchBookings();
        } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
      });
    });
    container.querySelectorAll('[data-confirm-wa]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const id = btn.dataset.confirmWa;
          const card = btn.closest('[data-booking]');
          await api.patch('/api/admin/bookings/' + id + '/status', { status: 'confirmed' });
          const booking = (await api.get('/api/admin/bookings/' + id)).booking;
          const wa = (booking.customer_whatsapp || '').replace(/[^0-9]/g, '');
          const d = new Date(booking.booked_at);
          const dateStr = d.toLocaleDateString();
          const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const msg = I.t('whatsappConfirmMsg', { name: booking.customer_name, tables: String(booking.tables_count), date: dateStr, time: timeStr });
          toast(I.t('bookingConfirmed'), 'success');
          fetchBookings();
          if (wa) window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(msg), '_blank');
        } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
      });
    });
    container.querySelectorAll('[data-cancel-booking]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(I.t('bookingCancelled') + '?')) return;
        btn.disabled = true;
        try {
          await api.patch('/api/admin/bookings/' + btn.dataset.cancelBooking + '/status', { status: 'cancelled' });
          toast(I.t('bookingCancelled'), 'success');
          fetchBookings();
        } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
      });
    });
    container.querySelectorAll('[data-complete-booking]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await api.patch('/api/admin/bookings/' + btn.dataset.completeBooking + '/status', { status: 'completed' });
          toast('Completed', 'success');
          fetchBookings();
        } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
      });
    });
    container.querySelectorAll('[data-del-booking]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(I.t('del') + '?')) return;
        btn.disabled = true;
        try {
          await api.del('/api/admin/bookings/' + btn.dataset.delBooking);
          toast(I.t('bookingCancelled'), 'success');
          fetchBookings();
        } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
      });
    });
  }

  async function loadBookings() {
    const zone = document.getElementById('tab-bookings');
    if (!zone.dataset.built) {
      zone.innerHTML =
        '<div class="flex-between mb-2">' +
          '<h1 class="section-title">' + esc(I.t('bookingsTab')) + '</h1>' +
          '<select id="bookings-filter">' +
            '<option value="">' + esc(I.t('allStatuses')) + '</option>' +
            ['pending','confirmed','cancelled','completed','noshow'].map((k) => '<option value="' + k + '">' + esc(bookingStatusLabel(k)) + '</option>').join('') +
          '</select>' +
        '</div>' +
        '<div id="bookings-list"></div>' +
        '<div class="flex-between mt-2">' +
          '<button id="bookings-prev" type="button" class="btn btn-outline btn-sm">' + esc(I.t('prev')) + '</button>' +
          '<span id="bookings-page-info" class="muted small"></span>' +
          '<button id="bookings-next" type="button" class="btn btn-outline btn-sm">' + esc(I.t('next')) + '</button>' +
        '</div>';
      zone.dataset.built = '1';
      document.getElementById('bookings-filter').addEventListener('change', (e) => { bookingsFilter = e.target.value; bookingsPage = 1; fetchBookings(); });
      document.getElementById('bookings-prev').addEventListener('click', () => { if (bookingsPage > 1) { bookingsPage--; fetchBookings(); } });
      document.getElementById('bookings-next').addEventListener('click', () => { bookingsPage++; fetchBookings(); });
    }
    fetchBookings();
  }

  async function fetchBookings() {
    const list = document.getElementById('bookings-list');
    list.innerHTML = '<div class="empty-state">' + esc(I.t('loading')) + '</div>';
    try {
      const q = '?page=' + bookingsPage + '&limit=20' + (bookingsFilter ? '&status=' + bookingsFilter : '');
      const data = await api.get('/api/admin/bookings' + q);
      const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
      bookingsPage = Math.min(bookingsPage, totalPages);
      list.innerHTML = data.bookings.length ? data.bookings.map(bookingCardHtml).join('') : '<div class="empty-state card">' + esc(I.t('bookingsEmpty')) + '</div>';
      document.getElementById('bookings-page-info').textContent = I.t('pageInfo', { p: bookingsPage, t: totalPages, n: data.total });
      wireBookingActions(list);
    } catch (err) { list.innerHTML = errorHtml(err); }
  }

  function refreshBookingsView() {
    if (!document.getElementById('tab-bookings').classList.contains('hidden')) fetchBookings();
  }

  /* ------------------------- live updates (SSE) ----------------------- */

  let eventSource = null;

  function connectEvents() {
    if (eventSource) eventSource.close();
    eventSource = new EventSource('/api/admin/events');

    eventSource.addEventListener('order:new', () => {
      toast(I.t('newOrderToast'), 'success');
      refreshCurrentOrdersView();
      if (!document.getElementById('tab-dashboard').classList.contains('hidden')) loadDashboard();
    });
    eventSource.addEventListener('order:status', () => refreshCurrentOrdersView());
    eventSource.addEventListener('booking:new', () => {
      toast(I.t('newBookingToast'), 'success');
      refreshBookingsView();
      if (!document.getElementById('tab-dashboard').classList.contains('hidden')) loadDashboard();
    });
    eventSource.addEventListener('booking:status', () => refreshBookingsView());
    eventSource.onerror = () => {
      // EventSource retries automatically.
    };
    // FR-013: the server keeps no replay buffer, so reconcile views on every
    // (re)connect — anything missed during a disconnect is refetched.
    eventSource.onopen = () => {
      refreshCurrentOrdersView();
      refreshBookingsView();
      if (!document.getElementById('tab-dashboard').classList.contains('hidden')) loadDashboard();
    };
  }

  window.addEventListener('beforeunload', () => {
    if (eventSource) eventSource.close();
  });

  /* ------------------------------ menu -------------------------------- */

  async function loadMenu() {
    const zone = document.getElementById('tab-menu');
    zone.innerHTML = '<div class="empty-state">' + esc(I.t('loading')) + '</div>';
    try {
      const [catRes, itemRes] = await Promise.all([
        api.get('/api/admin/categories'),
        api.get('/api/admin/items'),
      ]);
      categories = catRes.categories;
      items = itemRes.items;
      renderMenuTab();
    } catch (err) {
      zone.innerHTML = errorHtml(err);
    }
  }

  function renderMenuTab() {
    const zone = document.getElementById('tab-menu');
    const limit = info.restaurant.maxMenuItems;
    const used = items.length;
    const nearLimit = limit - used <= Math.max(3, Math.ceil(limit * 0.1));

    zone.innerHTML =
      '<div class="flex-between mb-2">' +
        '<h1 class="section-title"><span data-i18n="menuTab">' + esc(I.t('menuTab')) + '</span> <span class="badge' + (nearLimit ? ' badge-closed' : '') + '">' + used + ' / ' + limit + '</span></h1>' +
        '<div><button id="add-category-btn" type="button" class="btn btn-outline btn-sm">' + esc(I.t('addCategory')) + '</button> ' +
        '<button id="add-item-btn" type="button" class="btn btn-sm"' + (used >= limit ? ' disabled title="' + esc(I.t('limitReachedT')) + '"' : '') + '>' + esc(I.t('addItem')) + '</button></div>' +
      '</div>' +
      '<div id="menu-tree"></div>';

    document.getElementById('add-category-btn').addEventListener('click', () => categoryModal());
    document.getElementById('add-item-btn').addEventListener('click', () => itemModal(null));

    const tree = document.getElementById('menu-tree');
    tree.innerHTML = categories.map((c) => {
      const catItems = items.filter((i) => i.category_id === c.id);
      return (
        '<section class="card">' +
          '<div class="flex-between mb-1">' +
            '<h2 class="section-title">' + esc(c.name) + ' <span class="muted small">(' + catItems.length + ')</span></h2>' +
            '<div>' +
              '<button type="button" class="btn btn-outline btn-sm" data-edit-cat="' + esc(c.id) + '">' + esc(I.t('rename')) + '</button> ' +
              '<button type="button" class="btn btn-danger btn-sm" data-del-cat="' + esc(c.id) + '">' + esc(I.t('del')) + '</button>' +
            '</div>' +
          '</div>' +
          (catItems.length
            ? '<div class="table-wrap"><table class="data"><thead><tr><th>Item</th><th>Price</th><th>Flags</th><th></th></tr></thead><tbody>' +
              catItems.map(itemRowHtml).join('') +
              '</tbody></table></div>'
            : '<p class="muted small">' + esc(I.t('noItemsInCat')) + '</p>') +
        '</section>'
      );
    }).join('');

    tree.querySelectorAll('[data-edit-cat]').forEach((b) =>
      b.addEventListener('click', () => categoryModal(categories.find((c) => c.id === b.dataset.editCat))));
    tree.querySelectorAll('[data-del-cat]').forEach((b) =>
      b.addEventListener('click', () => deleteCategory(b.dataset.delCat)));
    tree.querySelectorAll('[data-edit-item]').forEach((b) =>
      b.addEventListener('click', () => itemModal(items.find((i) => i.id === b.dataset.editItem))));
    tree.querySelectorAll('[data-del-item]').forEach((b) =>
      b.addEventListener('click', () => deleteItem(b.dataset.delItem)));
    tree.querySelectorAll('[data-toggle-item]').forEach((b) =>
      b.addEventListener('click', () => toggleAvailability(b.dataset.toggleItem, b.dataset.to === 'true')));
    tree.querySelectorAll('[data-pop-item]').forEach((b) =>
      b.addEventListener('click', () => togglePopular(b.dataset.popItem, b.dataset.pop === 'true')));

    if (categories.length === 0) {
      tree.innerHTML = '<div class="empty-state card">' + esc(I.t('createFirstCat')) + '</div>';
    }
  }

  function itemRowHtml(i) {
    return (
      '<tr>' +
        '<td><strong>' + esc(i.name) + '</strong>' +
          (i.description ? '<div class="muted small">' + esc(i.description.slice(0, 60)) + '</div>' : '') + '</td>' +
        '<td>' + fmtMoney(i.price_cents, currency) + '</td>' +
        '<td>' +
          (i.is_available
            ? ''
            : '<span class="badge badge-soldout">' + esc(I.t('soldOut')) + '</span> ') +
          (i.is_popular ? '<span class="badge badge-popular">' + esc(I.t('popular')) + '</span>' : '') +
        '</td>' +
        '<td>' +
          '<div class="flex-between">' +
            '<button type="button" class="btn btn-outline btn-sm" data-toggle-item="' + esc(i.id) + '" data-to="' + (!i.is_available) + '">' +
              (i.is_available ? esc(I.t('soldOutQ')) : esc(I.t('availableQ'))) + '</button>' +
            '<button type="button" class="btn btn-outline btn-sm" data-pop-item="' + esc(i.id) + '" data-pop="' + (!i.is_popular) + '">' +
              (i.is_popular ? esc(I.t('unmarkPop')) : esc(I.t('markPop'))) + '</button>' +
            '<button type="button" class="btn btn-outline btn-sm" data-edit-item="' + esc(i.id) + '">' + esc(I.t('edit')) + '</button>' +
            '<button type="button" class="btn btn-danger btn-sm" data-del-item="' + esc(i.id) + '">' + esc(I.t('del')) + '</button>' +
          '</div>' +
        '</td>' +
      '</tr>'
    );
  }

  function categoryModal(category) {
    openModal(
      '<div class="modal-head"><h2>' + esc(category ? I.t('renameCatH') : I.t('newCatH')) + '</h2>' +
        '<button type="button" class="modal-close" aria-label="Close">&times;</button></div>' +
      '<form id="category-form">' +
        '<div class="field"><label for="cat-name">' + esc(I.t('nameL')) + '</label>' +
          '<input id="cat-name" maxlength="60" required value="' + esc(category ? category.name : '') + '"></div>' +
        '<button type="submit" class="btn btn-block">' + esc(I.t('save')) + '</button>' +
      '</form>'
    );
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('category-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cat-name').value.trim();
      try {
        if (category) await api.patch('/api/admin/categories/' + category.id, { name });
        else await api.post('/api/admin/categories', { name });
        closeModal();
        toast(I.t('categorySaved'), 'success');
        loadMenu();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  async function deleteCategory(id) {
    const cat = categories.find((c) => c.id === id);
    if (!confirm(I.t('delCatConfirm', { name: cat.name }))) return;
    try {
      await api.del('/api/admin/categories/' + id);
      toast(I.t('catDeleted'), 'success');
      await reloadInfo();
      loadMenu();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function itemModal(item) {
    if (categories.length === 0) {
      toast(I.t('createFirstCat'), 'error');
      return;
    }
    const isNew = !item;

    openModal(
      '<div class="modal-head"><h2>' + esc(isNew ? I.t('newItemH') : I.t('editItemH')) + '</h2>' +
        '<button type="button" class="modal-close" aria-label="Close">&times;</button></div>' +
      '<form id="item-form">' +
        '<div class="field"><label for="it-name">' + esc(I.t('nameReq')) + '</label>' +
          '<input id="it-name" maxlength="100" required value="' + esc(item ? item.name : '') + '"></div>' +
        '<div class="field"><label for="it-desc">' + esc(I.t('descL')) + '</label>' +
          '<textarea id="it-desc" maxlength="500">' + esc(item ? item.description : '') + '</textarea></div>' +
        '<div class="form-row form-row-2">' +
          '<div class="field"><label for="it-price">' + esc(I.t('priceReq')) + '</label>' +
            '<input id="it-price" type="number" min="0" step="0.01" required value="' + (item ? (item.price_cents / 100).toFixed(2) : '') + '"></div>' +
          '<div class="field"><label for="it-cat">' + esc(I.t('catReq')) + '</label>' +
            '<select id="it-cat">' +
              categories.map((c) => '<option value="' + esc(c.id) + '"' +
                (item && item.category_id === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') +
            '</select></div>' +
        '</div>' +
        '<div class="checkbox-line mb-1"><input id="it-available" type="checkbox"' + (!item || item.is_available ? ' checked' : '') + '><label for="it-available">' + esc(I.t('availableL')) + '</label></div>' +
        '<div class="checkbox-line mb-1"><input id="it-popular" type="checkbox"' + (item && item.is_popular ? ' checked' : '') + '><label for="it-popular">' + esc(I.t('popularL')) + '</label></div>' +
        '<div class="field mt-2"><label for="it-image">' + esc(I.t('imageL')) + '</label>' +
          (!isNew && item.image_path ? '<img src="' + esc(item.image_path) + '" alt="" class="mb-1" width="120" height="90">' : '') +
          '<input id="it-image" type="file" accept="image/jpeg,image/png,image/webp">' +
          '<div class="hint">' + esc(I.t('imgHint')) + '</div>' +
          '<div id="it-image-progress" class="progress hidden"><div id="it-image-progress-fill" class="progress-fill"></div></div>' +
        '</div>' +
        '<button id="it-save" type="submit" class="btn btn-block">' + esc(isNew ? I.t('createItemBtn') : I.t('saveChangesBtn')) + '</button>' +
      '</form>'
    );
    document.querySelector('.modal-close').addEventListener('click', closeModal);

    document.getElementById('item-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('it-save');
      const priceMajor = parseFloat(document.getElementById('it-price').value);
      if (!Number.isFinite(priceMajor) || priceMajor < 0) {
        toast(I.t('invalidPrice'), 'error');
        return;
      }
      const body = {
        categoryId: document.getElementById('it-cat').value,
        name: document.getElementById('it-name').value.trim(),
        description: document.getElementById('it-desc').value.trim(),
        priceCents: Math.round(priceMajor * 100),
        isAvailable: document.getElementById('it-available').checked,
        isPopular: document.getElementById('it-popular').checked,
      };
      try {
        submitBtn.disabled = true;
        let saved;
        if (isNew) {
          saved = await api.post('/api/admin/items', body);
          toast(I.t('itemCreated'), 'success');
        } else {
          saved = await api.patch('/api/admin/items/' + item.id, body);
          toast(I.t('itemUpdated'), 'success');
        }
        // Upload image after save so it attaches immediately.
        const fileInput = document.getElementById('it-image');
        if (fileInput && fileInput.files[0]) {
          const file = await App.compressImage(fileInput.files[0], { max: 700, quality: 0.78 });
          const fd = new FormData();
          fd.append('image', file, 'item.webp');
          const prog = document.getElementById('it-image-progress');
          const fill = document.getElementById('it-image-progress-fill');
          if (prog) prog.classList.remove('hidden');
          submitBtn.textContent = I.t('uploadingPct', { p: 0 });
          await api.uploadWithProgress(
            '/api/admin/images?type=items&itemId=' + encodeURIComponent(saved.item.id),
            fd,
            (pct) => {
              if (fill) fill.style.width = pct + '%';
              submitBtn.textContent = I.t('uploadingPct', { p: pct });
            }
          );
          toast(I.t('imgCompressed'));
        }
        closeModal();
        await reloadInfo();
        loadMenu();
      } catch (err) {
        toast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = isNew ? I.t('createItemBtn') : I.t('saveChangesBtn');
        const prog = document.getElementById('it-image-progress');
        const fill = document.getElementById('it-image-progress-fill');
        if (prog) prog.classList.add('hidden');
        if (fill) fill.style.width = '0%';
      }
    });
  }

  async function deleteItem(id) {
    const item = items.find((i) => i.id === id);
    if (!confirm(I.t('delItemConfirm', { name: item.name }))) return;
    try {
      await api.del('/api/admin/items/' + id);
      toast(I.t('itemDeleted'), 'success');
      await reloadInfo();
      loadMenu();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function toggleAvailability(id, makeAvailable) {
    try {
      await api.patch('/api/admin/items/' + id, { isAvailable: makeAvailable });
      loadMenu();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function togglePopular(id, popular) {
    try {
      await api.patch('/api/admin/items/' + id, { isPopular: popular });
      loadMenu();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /* ---------------------------- settings ------------------------------ */

  const TIMEZONES = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Mexico_City', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'Europe/Istanbul', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg', 'Asia/Dubai',
    'Asia/Karachi', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo',
    'Asia/Singapore', 'Australia/Sydney', 'Pacific/Auckland',
  ];
  const DAY_KEYS = ['day_0', 'day_1', 'day_2', 'day_3', 'day_4', 'day_5', 'day_6'];

  async function loadSettings() {
    const zone = document.getElementById('tab-settings');
    zone.innerHTML = '<div class="empty-state">' + esc(I.t('loading')) + '</div>';
    try {
      const [res, hoursRes, dgRes] = await Promise.all([
        api.get('/api/admin/settings'),
        api.get('/api/admin/hours'),
        api.get('/api/admin/delivery-groups'),
      ]);
      const s = res.settings;

      zone.innerHTML =
        '<h1 class="section-title">' + esc(I.t('settingsTab')) + '</h1>' +

        '<section class="card"><h2>' + esc(I.t('profileS')) + '</h2>' +
          '<div class="field"><label for="st-desc">' + esc(I.t('descL2')) + '</label><textarea id="st-desc" maxlength="500">' + esc(s.description) + '</textarea></div>' +
          '<div class="field"><label for="st-name-en">' + esc(I.t('nameEnL')) + '</label><input id="st-name-en" type="text" maxlength="80" dir="ltr" value="' + esc(s.nameEn || '') + '"></div>' +
          '<div class="form-row form-row-2">' +
            '<div class="field"><label for="st-phone">' + esc(I.t('phoneL')) + '</label><input id="st-phone" type="tel" value="' + esc(s.phone) + '"></div>' +
            '<div class="field"><label for="st-wa">' + esc(I.t('whatsappL2')) + '</label><input id="st-wa" type="tel" value="' + esc(s.whatsapp) + '"></div>' +
          '</div>' +
          '<div class="field"><label for="st-address">' + esc(I.t('addressL')) + '</label><textarea id="st-address" maxlength="300">' + esc(s.address) + '</textarea></div>' +
          '<div class="form-row form-row-2">' +
            '<div class="field"><label for="st-tz">' + esc(I.t('timezoneL')) + '</label><select id="st-tz">' +
              TIMEZONES.map((tz) => '<option' + (tz === s.timezone ? ' selected' : '') + '>' + tz + '</option>').join('') +
            '</select></div>' +
            '<div class="field"><label for="st-cur">' + esc(I.t('currencyL')) + '</label><input id="st-cur" maxlength="3" value="' + esc(s.currency) + '"></div>' +
          '</div>' +
          '<div class="form-row form-row-2">' +
            '<div class="field"><label for="st-fee">' + esc(I.t('deliveryFeeL')) + '</label><input id="st-fee" type="number" min="0" step="0.01" value="' + (s.deliveryFeeCents / 100).toFixed(2) + '"></div>' +
            '<div class="field"><label>&nbsp;</label><div class="checkbox-line"><input id="st-delivery" type="checkbox"' + (s.deliveryEnabled !== false ? ' checked' : '') + '>' +
              '<label for="st-delivery">' + esc(I.t('deliveryL')) + '</label></div></div>' +
            '<div class="field"><label>&nbsp;</label><div class="checkbox-line"><input id="st-ignore-hours" type="checkbox"' + (s.ignoreOpeningHours ? ' checked' : '') + '>' +
              '<label for="st-ignore-hours">' + esc(I.t('ignoreHours')) + '</label></div></div>' +
          '</div>' +
        '</section>' +

        '<section class="card"><h2>' + esc(I.t('appearanceS')) + '</h2>' +
          '<div class="form-row form-row-2">' +
            '<div class="field"><label for="st-color1">' + esc(I.t('colorPrimary')) + '</label><input id="st-color1" type="color" value="' + esc(s.primaryColor) + '"></div>' +
            '<div class="field"><label for="st-color2">' + esc(I.t('colorSecondary')) + '</label><input id="st-color2" type="color" value="' + esc(s.secondaryColor) + '"></div>' +
          '</div>' +
          '<div class="form-row form-row-2">' +
            '<div class="field"><label for="st-hex1">HEX</label><input id="st-hex1" dir="ltr" maxlength="7" spellcheck="false" autocomplete="off" placeholder="#e11d48" value="' + esc(s.primaryColor) + '"></div>' +
            '<div class="field"><label for="st-hex2">HEX</label><input id="st-hex2" dir="ltr" maxlength="7" spellcheck="false" autocomplete="off" placeholder="#1f3439" value="' + esc(s.secondaryColor) + '"></div>' +
          '</div>' +
          '<p class="hint muted small">' + esc(I.t('presetHint')) + '</p>' +
          '<div class="preset-row" id="preset1"></div>' +
          '<div class="preset-row" id="preset2"></div>' +
          '<div id="theme-preview" class="theme-preview">' +
            '<div class="tp-block"><span class="tp-label">' + esc(I.t('tpLogo')) + '</span><span class="tp-logo" id="tp-logo">' + esc((info.restaurant.name || '?').trim().charAt(0)) + '</span></div>' +
            '<div class="tp-block"><span class="tp-label">' + esc(I.t('tpCover')) + '</span><span class="tp-cover"><i id="tp-tint"></i></span></div>' +
          '</div>' +
          '<div class="form-row form-row-2">' +
            '<div class="field"><label for="st-logo">' + esc(I.t('logoUpload')) + '</label><input id="st-logo" type="file" accept="image/jpeg,image/png,image/webp">' +
              (s.logoPath ? '<img src="' + esc(s.logoPath) + '" alt="Logo" width="64" height="64" class="mt-1">' : '') + '</div>' +
            '<div class="field"><label for="st-cover">' + esc(I.t('coverUpload')) + '</label><input id="st-cover" type="file" accept="image/jpeg,image/png,image/webp">' +
              (s.coverPath ? '<img src="' + esc(s.coverPath) + '" alt="Cover" width="96" height="54" class="mt-1">' : '') + '</div>' +
          '</div>' +
        '</section>' +

        '<section class="card"><h2>' + esc(I.t('statusS')) + '</h2>' +
          '<div class="field"><label for="st-status">' + esc(I.t('restaurantStatusL')) + '</label><select id="st-status">' +
            '<option value="open"' + (info.restaurant.status === 'open' ? ' selected' : '') + '>' + esc(I.t('stOpen')) + '</option>' +
            '<option value="closed"' + (info.restaurant.status === 'closed' ? ' selected' : '') + '>' + esc(I.t('stClosed')) + '</option>' +
            '<option value="temporarily_closed"' + (info.restaurant.status === 'temporarily_closed' ? ' selected' : '') + '>' + esc(I.t('stTemp')) + '</option>' +
          '</select></div>' +
        '</section>' +

        '<section class="card"><h2>' + esc(I.t('deliveryGroupsT')) + '</h2>' +
          (dgRes.groups.length
            ? '<p class="hint muted small mb-1">' + esc(I.t('chooseGroupsHint')) + '</p>' +
              '<div class="table-wrap"><table class="data"><tbody>' +
              dgRes.groups.map((g) =>
                '<tr><td><div class="checkbox-line"><input type="checkbox" id="dg-' + esc(g.id) + '"' + (g.selected ? ' checked' : '') + '>' +
                '<label for="dg-' + esc(g.id) + '">' + esc(g.name) +
                (g.phone ? '<span class="muted"> &middot; ' + esc(g.phone) + '</span>' : '') + '</label></div></td></tr>'
              ).join('') +
              '</tbody></table></div>'
            : '<p class="hint muted small">' + esc(I.t('noGroupsForSelection')) + '</p>') +
        '</section>' +

        '<section class="card"><h2>' + esc(I.t('hoursS')) + '</h2>' +
          '<div class="table-wrap"><table class="data hours-table" id="hours-table"><tbody>' +
          DAY_KEYS.map((key, idx) => {
            const h = hoursRes.hours.find((x) => x.day === idx) || { opensAt: '09:00', closesAt: '22:00' };
            return (
              '<tr data-day="' + idx + '"><td><div class="checkbox-line"><input id="hc-' + idx + '" type="checkbox"' + (!h.closed ? ' checked' : '') + '><label for="hc-' + idx + '">' + esc(I.t(key)) + '</label></div></td>' +
              '<td><input id="ho-' + idx + '" type="time" value="' + esc(h.opensAt) + '"></td>' +
              '<td><input id="hx-' + idx + '" type="time" value="' + esc(h.closesAt) + '"></td></tr>'
            );
          }).join('') +
          '</tbody></table></div>' +
          '<p class="hint muted small">' + esc(I.t('crossMidnight')) + '</p>' +
        '</section>' +

        '<button id="save-settings-btn" type="button" class="btn btn-block mb-3">' + esc(I.t('saveAll')) + '</button>';

      document.getElementById('save-settings-btn').addEventListener('click', saveSettings);

      const c1 = document.getElementById('st-color1');
      const c2 = document.getElementById('st-color2');
      renderThemePreview(c1.value, c2.value);
      c1.addEventListener('input', () => renderThemePreview(c1.value, c2.value));
      c2.addEventListener('input', () => renderThemePreview(c1.value, c2.value));
      wireColorField(c1, document.getElementById('st-hex1'), document.getElementById('preset1'));
      wireColorField(c2, document.getElementById('st-hex2'), document.getElementById('preset2'));
    } catch (err) {
      zone.innerHTML = errorHtml(err);
    }
  }

  const COLOR_PRESETS = ['#d84632', '#ed6b4c', '#f5c84b', '#27615f', '#1f3439', '#e11d48',
    '#7c3aed', '#2563eb', '#059669', '#ea580c', '#0e7490', '#be123c'];

  function wireColorField(colorInput, hexInput, presetBox) {
    const valid = (v) => /^#[0-9a-f]{6}$/i.test((v || '').trim());
    const refresh = () => renderThemePreview(
      document.getElementById('st-color1').value,
      document.getElementById('st-color2').value
    );
    if (hexInput) {
      hexInput.value = colorInput.value;
      hexInput.addEventListener('change', () => {
        let v = hexInput.value.trim();
        if (/^[0-9a-f]{6}$/i.test(v)) v = '#' + v;
        if (valid(v)) {
          colorInput.value = v.toLowerCase();
          hexInput.value = colorInput.value;
          refresh();
        } else {
          hexInput.value = colorInput.value;
          toast(I.t('hexInvalid'), 'error');
        }
      });
    }
    colorInput.addEventListener('input', () => { if (hexInput) hexInput.value = colorInput.value; });
    if (presetBox) {
      presetBox.innerHTML = COLOR_PRESETS.map((c) =>
        '<button type="button" class="preset-dot" data-color="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>'
      ).join('');
      presetBox.querySelectorAll('.preset-dot').forEach((b) => b.addEventListener('click', () => {
        colorInput.value = b.dataset.color;
        if (hexInput) hexInput.value = b.dataset.color;
        refresh();
      }));
    }
  }

  function renderThemePreview(primaryColor, secondaryColor) {
    const ok = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
    const set = (id, prop, val) => { const el = document.getElementById(id); if (el) el.style.setProperty(prop, val); };
    if (ok(primaryColor)) {
      set('tp-logo', 'background-color', primaryColor);
      try { set('tp-logo', 'color', window.App.theme.buildTokens(primaryColor, '#000000')['--on-primary']); } catch (_) { /* keep default */ }
    } else {
      set('tp-logo', 'background-color', '#d84632');
      set('tp-logo', 'color', '#fff9ed');
    }
    const rgb = window.App.theme.hexToRgb(secondaryColor);
    set('tp-tint', 'background-color', rgb ? 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.32)' : 'transparent');
  }

  async function saveSettings() {
    const feeVal = parseFloat(document.getElementById('st-fee').value);
    const settingsBody = {
      description: document.getElementById('st-desc').value,
      nameEn: document.getElementById('st-name-en').value.trim(),
      phone: document.getElementById('st-phone').value,
      whatsapp: document.getElementById('st-wa').value,
      address: document.getElementById('st-address').value,
      timezone: document.getElementById('st-tz').value,
      currency: document.getElementById('st-cur').value,
      primaryColor: document.getElementById('st-color1').value,
      secondaryColor: document.getElementById('st-color2').value,
      ignoreOpeningHours: document.getElementById('st-ignore-hours').checked,
      deliveryEnabled: document.getElementById('st-delivery').checked,
      ...(Number.isFinite(feeVal) ? { deliveryFeeCents: Math.max(0, Math.round(feeVal * 100)) } : {}),
    };

    const hoursBody = [];
    for (let d = 0; d < 7; d++) {
      hoursBody.push({
        day: d,
        closed: !document.getElementById('hc-' + d).checked,
        opensAt: document.getElementById('ho-' + d).value || '09:00',
        closesAt: document.getElementById('hx-' + d).value || '22:00',
      });
    }

    const status = document.getElementById('st-status').value;
    const logoFile = document.getElementById('st-logo').files[0];
    const coverFile = document.getElementById('st-cover').files[0];

    try {
      await api.patch('/api/admin/settings', settingsBody);
      await api.put('/api/admin/hours', { hours: hoursBody });

      const dgCbs = Array.prototype.slice.call(document.querySelectorAll('[id^="dg-"]'));
      if (dgCbs.length) {
        await api.put('/api/admin/delivery-groups', {
          groupIds: dgCbs.filter((cb) => cb.checked).map((cb) => cb.id.slice(3)),
        });
      }

      // Status lives on the restaurant record:
      if (status !== info.restaurant.status) {
        await setStatus(status);
      }
      if (logoFile) await uploadSettingImage(logoFile, 'logos');
      if (coverFile) await uploadSettingImage(coverFile, 'covers');

      toast(I.t('settingsSaved'), 'success');
      await reloadInfo();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function uploadSettingImage(file, type) {
    const isLogo = type === 'logos';
    const optimized = await App.compressImage(file, isLogo
      ? { max: 256, quality: 0.85 }
      : { max: 1600, quality: 0.75 });
    const fd = new FormData();
    fd.append('image', optimized, isLogo ? 'logo.webp' : 'cover.webp');
    await api.request('/api/admin/images?type=' + type, { method: 'POST', body: fd });
    toast(I.t('imgCompressed'));
  }

  /** Admins set their own restaurant status through the settings PATCH endpoint. */
  async function setStatus(status) {
    // Implemented server-side as part of admin settings: see admin.routes
    // PATCH /api/admin/status
    await api.request('/api/admin/status', { method: 'PATCH', body: { status } });
  }

  /* ---------------------------- analytics ------------------------------ */

  function hourBars(byHour) {
    if (!byHour || !byHour.length) return '<span class="muted small">' + esc(I.t('noSales')) + '</span>';
    const max = Math.max(1, ...byHour.map((r) => r.orders));
    const by = new Map(byHour.map((r) => [r.hour, r.orders]));
    const cols = [];
    for (let h = 0; h < 24; h++) {
      const n = by.get(h) || 0;
      cols.push(
        '<div class="bar-wrap" title="' + String(h).padStart(2, '0') + ':00 — ' + n + ' ' + esc(I.t('ordersWord')) + '">' +
          '<div class="bar" data-h="' + Math.round((n / max) * 100) + '"></div>' +
          '<span class="bar-label">' + (h % 6 === 0 ? h : '') + '</span></div>'
      );
    }
    return cols.join('');
  }

  async function loadAnalytics() {
    const zone = document.getElementById('tab-analytics');
    zone.innerHTML = '<div class="empty-state">' + esc(I.t('loading')) + '</div>';
    try {
      const days = Number(document.getElementById('an-days')?.value || 7);
      const a = await api.get('/api/admin/analytics?days=' + days);
      const maxOrders = Math.max(1, ...a.series.map((s) => s.orders));

      zone.innerHTML =
        '<div class="flex-between mb-2"><h1 class="section-title">' + esc(I.t('analyticsTab')) + '</h1>' +
          '<div class="flex-between" style="gap:8px">' +
          '<a class="btn btn-outline btn-sm" href="/api/admin/reports/orders.csv" download>' + esc(I.t('exportCsv')) + '</a>' +
          '<select id="an-days"><option value="7"' + (days === 7 ? ' selected' : '') + '>' + esc(I.t('last7')) + '</option>' +
          '<option value="30"' + (days === 30 ? ' selected' : '') + '>' + esc(I.t('last30')) + '</option>' +
          '<option value="90"' + (days === 90 ? ' selected' : '') + '>' + esc(I.t('last90')) + '</option></select></div></div>' +

        '<div class="grid-stats mb-2">' +
          statCard(I.t('totalOrders'), a.totals.orders) +
          statCard(I.t('revenueL'), fmtMoney(a.totals.revenueCents, currency)) +
          statCard(I.t('avOrderValue'), fmtMoney(a.averageOrderValueCents, currency)) +
          statCard(I.t('todaysOrders'), a.today.ordersToday) +
        '</div>' +

        '<section class="card"><h2>' + esc(I.t('dailyOrdersH')) + '</h2><div class="chart">' +
          a.series.map((s) =>
            '<div class="bar-wrap" title="' + esc(s.day) + ': ' + s.orders + ' ' + esc(I.t('ordersWord')) + '">' +
              '<div class="bar" data-h="' + Math.round((s.orders / maxOrders) * 100) + '"></div>' +
              '<span class="bar-label">' + esc(s.day.slice(5)) + '</span></div>'
          ).join('') +
        '</div></section>' +

        '<section class="card"><h2>' + esc(I.t('byHourH')) + '</h2><div class="chart nowrap-chart">' +
          hourBars(a.byHour) +
        '</div></section>' +

        '<section class="card"><h2>' + esc(I.t('byDowH')) + '</h2>' +
          (a.byDayOfWeek.length
            ? a.byDayOfWeek.map((r) =>
                '<div class="rank-row"><span>' + esc(I.t('day_' + r.dow)) + '</span>' +
                '<span><strong>' + r.orders + '</strong> ' + esc(I.t('ordersWord')) + ' · ' + fmtMoney(r.revenueCents, currency) + '</span></div>'
              ).join('')
            : '<p class="muted">' + esc(I.t('noSales')) + '</p>') +
        '</section>' +

        '<section class="card"><h2>' + esc(I.t('topItemsH')) + '</h2>' +
          (a.topItems.length
            ? a.topItems.map((t, i) =>
                '<div class="rank-row"><span>' + (i + 1) + '. ' + esc(t.item_name) + '</span>' +
                '<span><strong>' + t.units + '</strong> ' + esc(I.t('soldW')) + ' · ' + fmtMoney(t.revenueCents, currency) + '</span></div>'
              ).join('')
            : '<p class="muted">' + esc(I.t('noSales')) + '</p>') +
        '</section>';

      // CSP-safe bar heights via CSSOM.
      zone.querySelectorAll('.chart .bar').forEach((el) => {
        el.style.height = (el.dataset.h || 2) + '%';
        el.parentElement.style.justifyContent = 'flex-end';
      });

      document.getElementById('an-days').addEventListener('change', loadAnalytics);
    } catch (err) {
      zone.innerHTML = errorHtml(err);
    }
  }

  /* ------------------------------ share -------------------------------- */

  async function loadShare() {
    const zone = document.getElementById('tab-share');
    zone.innerHTML = '<div class="empty-state">' + esc(I.t('loading')) + '</div>';
    try {
      const qr = await api.get('/api/admin/qr');
      const svgDataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(qr.svg)));
      const publicUrl = location.origin + '/restaurant/' + encodeURIComponent(info.restaurant.slug);

      zone.innerHTML =
        '<h1 class="section-title">' + esc(I.t('shareYourRestaurant')) + '</h1>' +
        '<section class="card qr-box">' +
          '<img src="' + svgDataUri + '" alt="QR code to your menu" width="260" height="260">' +
          '<p class="muted small mt-1">' + esc(qr.url) + '</p>' +
          '<div class="flex-between mt-1">' +
            '<a class="btn btn-primary" href="/restaurant/' + encodeURIComponent(info.restaurant.slug) + '" target="_blank" rel="noopener">' + esc(I.t('openPublicPage')) + '</a>' +
            '<button id="copy-link-btn" type="button" class="btn btn-outline">' + esc(I.t('copyLink')) + '</button>' +
          '</div>' +
        '</section>';
      document.getElementById('copy-link-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(publicUrl).then(() => toast(I.t('linkCopied')), () => {});
      });
    } catch (err) {
      zone.innerHTML = errorHtml(err);
    }
  }

  function errorHtml(err) {
    return '<div class="notice notice-error mt-2">' + esc(err.message || I.t('somethingWrong')) + '</div>';
  }

  // Re-render the active tab when the user switches language.
  I.onChange(() => {
    renderOpenBadge();
    const active = document.querySelector('.side-link.active, .tab-btn.active');
    if (active) switchTab(active.dataset.tab);
  });

  boot();
})();
