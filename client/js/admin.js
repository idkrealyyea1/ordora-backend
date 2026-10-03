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
      applyEmphasis();
      switchTab('dashboard');
      connectEvents();
    } catch (err) {
      toast(err.message || I.t('failedLoad'), 'error');
    }
  }

  /* Per-type navigation emphasis (spec 013 US5): reorder nav buttons so the
     modules relevant to this business type come first. Visibility only —
     every route keeps its server-side authorization. */
  function applyEmphasis() {
    api.get('/api/onboarding/profile').then((p) => {
      const order = (p && p.dashboardEmphasis) || [];
      if (!order.length) return;
      for (const nav of document.querySelectorAll('.dash-side, .tabs-mobile')) {
        const btns = Array.from(nav.querySelectorAll('[data-tab]'));
        const rank = (b) => {
          if (b.dataset.tab === 'dashboard' || b.dataset.tab === 'share') return b.dataset.tab === 'dashboard' ? -1 : order.length + 1;
          const i = order.indexOf(b.dataset.tab);
          return i === -1 ? order.length : i;
        };
        btns
          .sort((a, b) => rank(a) - rank(b))
          .forEach((b) => nav.appendChild(b));
      }
    }).catch(() => { /* readers without a tenant keep default order */ });
  }

  /* Friendly business-type label (spec 013): never show raw snake_case to owners. */
  function bizLabel(t) {
    const map = {
      restaurant: 'bt_restaurant', cafe: 'bt_cafe', dessert_shop: 'bt_dessert', bakery: 'bt_bakery',
      cake_business: 'bt_cake', home_kitchen: 'bt_home', home_food_business: 'bt_home',
      cloud_kitchen: 'bt_cloud', small_food_business: 'bt_other',
    };
    return map[t] ? I.t(map[t]) : t;
  }

  async function reloadInfo() {
    info = await api.get('/api/admin/restaurant');
    currency = info.settings.currency;
    const bizType = (info.restaurant && info.restaurant.businessType) || 'restaurant';
    document.getElementById('restaurant-name').textContent =
      info.restaurant.name + (bizType === 'restaurant' ? '' : ' · ' + bizLabel(bizType));
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

  function initDrawer() {
    const burger = document.getElementById('nav-burger');
    const drawer = document.getElementById('nav-drawer');
    const overlay = document.getElementById('nav-overlay');
    if (!burger || !drawer) return;
    // Drawer header: business identity + explicit close (mobile-first polish).
    const drawerBrand = document.getElementById('nav-drawer-brand');
    const drawerClose = document.getElementById('nav-drawer-close');
    if (drawerBrand) drawerBrand.textContent = (info && info.restaurant && info.restaurant.name) || 'Restivo';
    // Mirror side links into the drawer so both stay in sync.
    for (const btn of document.querySelectorAll('.dash-side [data-tab]')) {
      const b = btn.cloneNode(true);
      b.classList.remove('active');
      b.setAttribute('data-drawer-tab', btn.dataset.tab);
      b.addEventListener('click', () => { closeDrawer(); switchTab(btn.dataset.tab); });
      drawer.appendChild(b);
    }
    function openDrawer() {
      drawer.hidden = false; overlay.hidden = false;
      requestAnimationFrame(() => drawer.classList.add('open'));
      document.body.classList.add('drawer-open');
      burger.setAttribute('aria-expanded', 'true');
    }
    function closeDrawer() {
      drawer.classList.remove('open');
      overlay.hidden = true;
      document.body.classList.remove('drawer-open');
      burger.setAttribute('aria-expanded', 'false');
      setTimeout(() => { if (!drawer.classList.contains('open')) drawer.hidden = true; }, 200);
    }
    burger.addEventListener('click', () => (drawer.classList.contains('open') ? closeDrawer() : openDrawer()));
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer(); });
    window.addEventListener('resize', () => { if (window.innerWidth >= 900) closeDrawer(); });

    // Capability-aware visibility: hide nav entries for disabled capabilities.
    api.get('/api/onboarding/capabilities').then((caps) => {
      const enabled = (caps && caps.capabilities) || {};
      document.querySelectorAll('[data-cap]').forEach((el) => {
        const key = el.dataset.cap;
        if (key === '__always') return;
        if (enabled[key] === false) el.style.display = 'none';
      });
      drawer.querySelectorAll('[data-cap]').forEach((el) => {
        const key = el.dataset.cap;
        if (key === '__always') return;
        if (enabled[key] === false) el.remove();
      });
    }).catch(() => { /* no tenant → keep all visible */ });
  }

  function bindChrome() {
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    initDrawer();
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
    document.querySelectorAll('.side-link, .tab-btn, [data-drawer-tab]').forEach((b) => {
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
    // Continuation banner for incomplete self-service setups (spec 013 US3).
    let banner = '';
    try {
      const st = await api.get('/api/onboarding/state');
      if (st.onboardingStatus === 'in_progress') {
        banner =
          '<section class="card" role="status"><h2 class="section-title">' +
            esc(I.t('su_readyPct', { n: st.completeness })) + '</h2>' +
            '<p class="muted small">' + esc(I.t('su_resume', { n: (st.next || []).length })) + '</p>' +
            '<p><a class="btn btn-primary" href="/signup.html">' + esc(I.t('su_resumeGo')) + '</a></p></section>';
      }
    } catch (_) { /* admins without a tenant or completed setups: no banner */ }
    // Grace renewal reminder (spec 014 US5): recovery-first, never a dead end.
    try {
      const sub = await api.get('/api/onboarding/subscription');
      if (sub.state === 'grace') {
        banner +=
          '<section class="card" role="status"><h2 class="section-title">' +
            esc(I.t('sub_grace')) + '</h2>' +
            '<p class="muted small">' + esc(I.t('sub_grace', { n: sub.daysLeft })) + '</p></section>';
      }
    } catch (_) { /* readers without a subscription row keep the default view */ }
    try {
      const d = await api.get('/api/admin/dashboard');
      const usage = d.maxMenuItems ? d.itemCount + ' / ' + d.maxMenuItems : String(d.itemCount);

      zone.innerHTML =
        banner +
        (d.itemCount === 0
          ? '<section class="card" role="status"><p class="muted">' + esc(I.t('su_emptyMenu')) +
            ' <button id="goto-menu" type="button" class="btn btn-outline btn-sm">' + esc(I.t('su_addFirst')) + '</button></p></section>'
          : '') +
        '<div class="grid-stats mb-2">' +
          statCard(I.t('ordersToday'), d.counts.ordersToday) +
          statCard(I.t('pendingL'), d.counts.pendingOrders) +
          statCard(I.t('revenueToday'), fmtMoney(d.counts.revenueTodayCents, currency)) +
          statCard(I.t('menuItemsL'), usage) +
        '</div>' +
        '<div class="card"><div class="flex-between"><h2 class="section-title">' + esc(I.t('restaurantStatus')) + '</h2>' +
        '<button id="goto-settings" type="button" class="btn btn-outline btn-sm">' + esc(I.t('change')) + '</button></div>' +
        '<p>' + statusText(d.openNow) + '</p></div>' +
        '<div class="card mt-2" role="status"><div class="flex-between"><h2 class="section-title">' + esc(I.t('subscriptionH')) + '</h2>' +
          subBadge(d.subscription) + '</div>' + subBody(d.subscription) +
        '</div>' +
        '<h2 class="section-title mt-2">' + esc(I.t('pendingOrdersH')) + '</h2><div id="dash-pending"></div>';

      document.getElementById('goto-settings').addEventListener('click', () => switchTab('settings'));
      const gotoMenu = document.getElementById('goto-menu');
      if (gotoMenu) gotoMenu.addEventListener('click', () => switchTab('menu'));

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

  /* Subscription card copy (spec 014): human-readable states, never jargon. */
  function subBadge(sub) {
    const on = sub && sub.active;
    const label = !sub ? I.t('subActive') : I.t({ trial: 'subTrial', active: 'subActive', grace: 'subGrace', expired: 'subExpired', cancelled: 'subCancelled', suspended: 'subSuspended' }[sub.state] || 'subActive');
    return '<span class="badge ' + (on ? 'badge-open' : 'badge-closed') + '">' + esc(label) + '</span>';
  }

  function subBody(sub) {
    if (!sub) return '<p class="muted small mt-1">' + esc(I.t('subPrice')) + '</p>';
    const plan = sub.plan ? esc(sub.plan.name) : '';
    const vars = { n: sub.daysLeft, date: sub.periodEndsAt ? fmtDateTime(sub.periodEndsAt) : '', plan };
    return '<p class="muted small mt-1">' + esc(I.t(sub.messageKey || 'sub_active_until', vars)) + '</p>';
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

    const isNew = o.status === 'pending' && highlightCode && o.code === highlightCode;
    const typeBadge = '<span class="badge">' + esc(o.order_type === 'delivery' ? I.t('delivery') : I.t('pickup')) + '</span>';
    const preorderBadge = o.has_preorder
      ? ' <span class="badge badge-popular">' + esc(I.t('preorderBadge')) + '</span>'
      : '';

    return (
      '<article class="card order-card' + (isNew ? ' order-new' : '') + '" id="order-' + esc(o.id) + '">' +
        '<div class="order-head">' +
          '<span class="order-code">' + esc(o.code) + '</span>' +
          '<span><span class="badge status-' + esc(o.status) + '">' + esc(statusLabel(o.status)) + '</span> ' +
          typeBadge + preorderBadge + '</span>' +
        '</div>' +
        '<div class="order-meta mt-1">' +
          esc(o.customer_name) + ' &middot; ' + esc(o.customer_whatsapp) + ' &middot; ' +
          fmtDateTime(o.created_at) + ' &middot; ' + esc(I.t('itemsCount', { n: o.total_units || 0 })) +
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
            const full = res.order;
            const wa = String(full.customer_whatsapp || '').replace(/\D/g, '');
            const contact =
              '<div class="order-meta mt-1">' + esc(full.customer_name || '') +
              (wa ? ' &middot; <a href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">' + esc(full.customer_whatsapp) + '</a>' : '') +
              (full.customer_phone ? ' &middot; ' + esc(full.customer_phone) : '') + '</div>' +
              (full.order_type === 'delivery' && full.customer_address
                ? '<div class="order-meta mt-1"><strong>' + esc(I.t('addrLabel')) + '</strong> ' + esc(full.customer_address) + '</div>'
                : '');
            head.insertAdjacentHTML('afterend', contact +
              '<ul class="order-lines small">' +
              full.items.map((it) => {
                const optNames = (it.options || []).map((o) => o.choice_name + (o.quantity > 1 ? ' ×' + o.quantity : '')).join(', ');
                return '<li>' + esc(it.quantity) + ' &times; ' + esc(it.item_name) +
                  (optNames ? ' <span class="muted">(' + esc(optNames) + ')</span>' : '') +
                  (it.is_preorder ? ' <span class="badge badge-popular">' + esc(I.t('preorderBadge')) + (it.preorder_note ? ': ' + esc(it.preorder_note) : '') + '</span>' : '') +
                  ' — ' + fmtMoney(it.line_total_cents, currency) + '</li>';
              }).join('') +
              '</ul>' +
              '<div class="small">' + esc(I.t('subtotal')) + ' ' + fmtMoney(full.subtotal_cents, currency) +
              (full.order_type === 'delivery' ? ' &middot; ' + esc(I.t('deliveryFee')) + ' ' + fmtMoney(full.delivery_fee_cents, currency) : '') +
              ' &middot; <strong>' + esc(I.t('totalW')) + ' ' + fmtMoney(full.total_cents, currency) + '</strong></div>');
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
  let highlightCode = null; // latest order:new code; highlighted while pending

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

    eventSource.addEventListener('order:new', (e) => {
      try {
        const payload = JSON.parse(e.data || '{}');
        if (payload.code) highlightCode = payload.code;
      } catch (_) { /* toast + refresh still apply */ }
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
        '<div class="checkbox-line mb-1"><input id="it-preorder" type="checkbox"' + (item && item.is_preorder ? ' checked' : '') + '><label for="it-preorder">' + esc(I.t('preorderBadge')) + '</label></div>' +
        '<div class="field"><label for="it-prenote">' + esc(I.t('preorderBadge')) + '</label>' +
          '<input id="it-prenote" maxlength="300" value="' + esc(item ? (item.preorder_note || '') : '') + '"></div>' +
        '<div class="field mt-2"><label for="it-image">' + esc(I.t('imageL')) + '</label>' +
          (!isNew && item.image_path ? '<img src="' + esc(item.image_path) + '" alt="" class="mb-1" width="120" height="90">' : '') +
          '<input id="it-image" type="file" accept="image/jpeg,image/png,image/webp">' +
          '<div class="hint">' + esc(I.t('imgHint')) + '</div>' +
          '<div id="it-image-progress" class="progress hidden"><div id="it-image-progress-fill" class="progress-fill"></div></div>' +
        '</div>' +
        '<button id="it-save" type="submit" class="btn btn-block">' + esc(isNew ? I.t('createItemBtn') : I.t('saveChangesBtn')) + '</button>' +
      '</form>' +
      (!isNew ? '<div id="item-options" class="mt-2"></div>' : '')
    );
    document.querySelector('.modal-close').addEventListener('click', closeModal);

    if (!isNew) loadItemOptions(item.id);

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
        isPreorder: document.getElementById('it-preorder').checked,
        preorderNote: document.getElementById('it-prenote').value.trim(),
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

  /* --------------------- product option groups --------------------- */

  async function loadItemOptions(itemId) {
    const zone = document.getElementById('item-options');
    if (!zone) return;
    try {
      const d = await api.get('/api/admin/option-groups?menuItemId=' + encodeURIComponent(itemId));
      const groups = d.groups || [];
      const withChoices = await Promise.all(groups.map(async (g) => ({
        group: g,
        choices: (await api.get('/api/admin/option-groups/' + g.id + '/choices')).choices || [],
      })));
      zone.innerHTML = '<h3 class="section-title">' + esc(I.t('optGroups')) + '</h3>' +
        withChoices.map(({ group: g, choices }) =>
          '<div class="card mb-1"><div class="flex-between"><strong>' + esc(g.name) + '</strong>' +
          '<span><span class="badge">' + esc(g.pricing) + '</span> ' +
          (g.is_required ? '<span class="badge badge-closed">' + esc(I.t('optRequired')) + '</span> ' : '') +
          '<span class="muted small">' + g.min_picks + '–' + g.max_picks + '</span> ' +
          '<button type="button" class="btn btn-danger btn-sm" data-del-group="' + esc(g.id) + '">' + esc(I.t('del')) + '</button></span></div>' +
          (choices.length
            ? '<div class="table-wrap"><table class="data"><tbody>' + choices.map((c) =>
              '<tr><td>' + esc(c.name) + '</td><td>' + fmtMoney(c.price_cents, currency) +
              '</td><td class="small muted">×' + c.max_quantity + (c.is_available ? '' : ' · ' + esc(I.t('soldOut'))) + '</td>' +
              '<td><button type="button" class="btn btn-danger btn-sm" data-del-choice="' + esc(g.id + '|' + c.id) + '">' +
              esc(I.t('del')) + '</button></td></tr>').join('') + '</tbody></table></div>'
            : '') +
          '<form data-choice-form="' + esc(g.id) + '" class="flex-between">' +
            '<input maxlength="60" required placeholder="' + esc(I.t('optChoices')) + '">' +
            '<input type="number" min="0" step="0.01" value="0" title="' + esc(I.t('optPrice')) + '">' +
            '<button type="submit" class="btn btn-outline btn-sm">' + esc(I.t('optAddChoice')) + '</button>' +
          '</form></div>'
        ).join('') +
        '<form id="group-form" class="card"><div class="form-row form-row-2">' +
          '<div class="field"><label>' + esc(I.t('optGroups')) + '</label>' +
            '<input id="ng-name" maxlength="60" required></div>' +
          '<div class="field"><label>' + esc(I.t('optPricing')) + '</label>' +
            '<select id="ng-pricing"><option value="adjust">adjust</option><option value="replace">replace</option></select></div>' +
        '</div><div class="form-row form-row-2">' +
          '<div class="field"><label>' + esc(I.t('optMinMax')) + '</label>' +
            '<input id="ng-min" type="number" min="0" max="99" value="0"> <input id="ng-max" type="number" min="1" max="99" value="1"></div>' +
          '<div class="field"><label>&nbsp;</label><div class="checkbox-line"><input id="ng-req" type="checkbox">' +
            '<label for="ng-req">' + esc(I.t('optRequired')) + '</label></div></div>' +
        '</div><button type="submit" class="btn btn-block">' + esc(I.t('optAddGroup')) + '</button></form>';

      zone.querySelectorAll('[data-del-group]').forEach((b) => b.addEventListener('click', async () => {
        try { await api.del('/api/admin/option-groups/' + b.dataset.delGroup); loadItemOptions(itemId); loadMenu(); }
        catch (err) { toast(err.message, 'error'); }
      }));
      zone.querySelectorAll('[data-del-choice]').forEach((b) => b.addEventListener('click', async () => {
        const [gid, cid] = b.dataset.delChoice.split('|');
        try { await api.del('/api/admin/option-groups/' + gid + '/choices/' + cid); loadItemOptions(itemId); }
        catch (err) { toast(err.message, 'error'); }
      }));
      zone.querySelectorAll('[data-choice-form]').forEach((f) => f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputs = f.querySelectorAll('input');
        const priceMajor = parseFloat(inputs[1].value);
        try {
          await api.post('/api/admin/option-groups/' + f.dataset.choiceForm + '/choices', {
            name: inputs[0].value.trim(),
            priceCents: Math.max(0, Math.round((Number.isFinite(priceMajor) ? priceMajor : 0) * 100)),
          });
          loadItemOptions(itemId);
        } catch (err) { toast(err.message, 'error'); }
      }));
      const gf = document.getElementById('group-form');
      if (gf) gf.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api.post('/api/admin/option-groups', {
            menuItemId: itemId,
            name: document.getElementById('ng-name').value.trim(),
            isRequired: document.getElementById('ng-req').checked,
            minPicks: Number(document.getElementById('ng-min').value),
            maxPicks: Number(document.getElementById('ng-max').value),
            pricing: document.getElementById('ng-pricing').value,
          });
          loadItemOptions(itemId);
          loadMenu();
        } catch (err) { toast(err.message, 'error'); }
      });
    } catch (err) {
      zone.innerHTML = '<p class="notice notice-error">' + esc(err.message) + '</p>';
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

  /* --------------------- push notifications ---------------------- */

  function pushSupported() {
    return ('Notification' in window) && ('serviceWorker' in navigator) && ('PushManager' in window);
  }

  function vapidKeyToBytes(base64) {
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function loadPushCard() {
    const box = document.getElementById('push-card-body');
    if (!box) return;
    if (!pushSupported()) {
      box.innerHTML = '<p class="muted small">' + esc(I.t('pushUnsupported')) + '</p>';
      return;
    }
    let cfg;
    try {
      cfg = await api.get('/api/admin/push-public-key');
    } catch (err) {
      box.innerHTML = errorHtml(err);
      return;
    }
    if (!cfg.enabled) {
      box.innerHTML = '<p class="muted small">' + esc(I.t('pushUnavailable')) + '</p>';
      return;
    }
    const perm = Notification.permission;
    let listHtml = '';
    try {
      const { subscriptions } = await api.get('/api/admin/push-subscriptions');
      listHtml = subscriptions.length
        ? '<ul class="order-lines small">' + subscriptions.map((s) =>
            '<li>' + esc(s.label || I.t('pushThisDevice')) + ' <span class="muted">· ' + esc(fmtDateTime(s.created_at)) + '</span> ' +
            '<button type="button" class="btn btn-outline btn-sm" data-unpush="' + esc(s.id) + '">' + esc(I.t('pushRemove')) + '</button></li>'
          ).join('') + '</ul>'
        : '<p class="muted small">' + esc(I.t('pushNoDevices')) + '</p>';
    } catch (err) {
      box.innerHTML = errorHtml(err);
      return;
    }
    box.innerHTML =
      '<p class="muted small">' + esc(I.t('pushBenefit')) + '</p>' +
      (perm === 'denied'
        ? '<p class="muted small">' + esc(I.t('pushDeniedHint')) + '</p>'
        : '<button id="push-enable-btn" type="button" class="btn btn-secondary btn-sm">' + esc(I.t('pushEnable')) + '</button>') +
      '<div class="mt-1">' + listHtml + '</div>';
    const enableBtn = document.getElementById('push-enable-btn');
    if (enableBtn) {
      enableBtn.addEventListener('click', async () => {
        enableBtn.disabled = true;
        try {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            toast(I.t('pushDeniedHint'), 'error');
            loadPushCard();
            return;
          }
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKeyToBytes(cfg.publicKey),
          });
          await api.post('/api/admin/push-subscriptions', {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.toJSON().keys.p256dh, auth: sub.toJSON().keys.auth },
            label: '',
          });
          toast(I.t('pushSubscribed'), 'success');
          loadPushCard();
        } catch (err) {
          toast(err.message, 'error');
          enableBtn.disabled = false;
        }
      });
    }
    box.querySelectorAll('[data-unpush]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await api.del('/api/admin/push-subscriptions/' + b.dataset.unpush);
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        } catch (_) { /* server row is the source of truth */ }
        toast(I.t('pushRemoved'), 'success');
        loadPushCard();
      } catch (err) {
        toast(err.message, 'error');
        b.disabled = false;
      }
    }));
  }

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
      // Capability visibility (spec 013 US4): delivery-companies controls are
      // disabled with guidance when the delivery capability is off.
      // Enforcement stays server-side (requireCapability).
      let deliveryCap = true;
      try {
        const caps = await api.get('/api/onboarding/capabilities');
        deliveryCap = !caps.capabilities || caps.capabilities.delivery !== false;
      } catch (_) { /* readers without a tenant keep full UI; server still gates */ }

      zone.innerHTML =
        '<h1 class="section-title">' + esc(I.t('settingsTab')) + '</h1>' +

        '<section class="card"><h2>' + esc(I.t('pushTitle')) + '</h2>' +
          '<div id="push-card-body"><p class="muted small">' + esc(I.t('loading')) + '</p></div>' +
        '</section>' +

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
            '<div class="field"><label for="st-cur">' + esc(I.t('currencyL')) + '</label><select id="st-cur">' +
              ['ILS', 'USD', 'EUR', 'GBP', 'JOD', 'SAR', 'AED', 'EGP'].map((c) => '<option value="' + c.toLowerCase() + '"' + (String(s.currency || 'USD').toUpperCase() === c ? ' selected' : '') + '>' + c + '</option>').join('') +
            '</select></div>' +
          '</div>' +
          '<div class="form-row form-row-2">' +
            '<div class="field"><label for="st-fee">' + esc(I.t('deliveryFeeL')) + '</label><input id="st-fee" type="number" min="0" step="0.01" value="' + (s.deliveryFeeCents / 100).toFixed(2) + '"></div>' +
            '<div class="field"><label>&nbsp;</label><div class="checkbox-line"><input id="st-delivery" type="checkbox"' + (s.deliveryEnabled !== false ? ' checked' : '') + '>' +
              '<label for="st-delivery">' + esc(I.t('deliveryL')) + '</label></div></div>' +
            '<div class="field"><label>&nbsp;</label><div class="checkbox-line"><input id="st-ignore-hours" type="checkbox"' + (s.ignoreOpeningHours ? ' checked' : '') + '>' +
              '<label for="st-ignore-hours">' + esc(I.t('ignoreHours')) + '</label></div></div>' +
            '<div class="field"><label>&nbsp;</label><div class="checkbox-line"><input id="st-free-ship" type="checkbox"' + (s.freeDeliveryEnabled ? ' checked' : '') + '>' +
              '<label for="st-free-ship">' + esc(I.t('freeShipL')) + '</label></div></div>' +
            '<div class="field"><label for="st-free-threshold">' + esc(I.t('freeShipThresholdL')) + '</label><input id="st-free-threshold" type="number" min="0" step="0.01" value="' + ((s.freeDeliveryThresholdCents || 0) / 100).toFixed(2) + '"></div>' +
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
          (deliveryCap ? '' : '<p class="notice notice-error">' + esc(I.t('capDeliveryOff')) + '</p>') +
          (dgRes.groups.length
            ? '<p class="hint muted small mb-1">' + esc(I.t('chooseGroupsHint')) + '</p>' +
              '<div class="table-wrap"><table class="data"><tbody>' +
              dgRes.groups.map((g) =>
                '<tr><td><div class="checkbox-line"><input type="checkbox" id="dg-' + esc(g.id) + '"' + (g.selected ? ' checked' : '') + (deliveryCap ? '' : ' disabled') + '>' +
                '<label for="dg-' + esc(g.id) + '">' + esc(g.name) +
                (g.phone ? '<span class="muted"> &middot; ' + esc(g.phone) + '</span>' : '') + '</label></div></td></tr>'
              ).join('') +
              '</tbody></table></div>'
            : '<p class="hint muted small">' + esc(I.t('noGroupsForSelection')) + '</p>') +
        '</section>' +

        '<section class="card"><h2>' + esc(I.t('heroImages')) + '</h2>' +
          '<div id="hero-list" class="muted small">Loading…</div>' +
          '<div class="hero-add">' +
            '<button id="hero-upload-btn" type="button" class="hero-add-btn">' +
              '<span class="hero-add-plus" aria-hidden="true">+</span>' +
              '<span>' + esc(I.t('uploadHeroImage')) + '</span>' +
            '</button>' +
            '<input id="hero-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>' +
            '<p class="hint muted small">' + esc(I.t('heroFormatsHint')) + '</p>' +
          '</div>' +
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
      loadPushCard();
      loadHeroList();
      document.getElementById('hero-upload-btn').addEventListener('click', uploadHero);
      // Clicking anywhere in the add zone opens the picker (no raw input shown).
      document.querySelector('.hero-add').addEventListener('click', (e) => {
        if (e.target.closest('#hero-upload-btn')) return;
        document.getElementById('hero-file').click();
      });

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
    const thresholdVal = parseFloat(document.getElementById('st-free-threshold').value);
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
      freeDeliveryEnabled: document.getElementById('st-free-ship').checked,
      ...(Number.isFinite(thresholdVal) ? { freeDeliveryThresholdCents: Math.max(0, Math.round(thresholdVal * 100)) } : {}),
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

  async function loadHeroList() {
    const zone = document.getElementById('hero-list');
    if (!zone) return;
    try {
      const { heroImages } = await api.get('/api/admin/hero-images');
      if (!heroImages.length) { zone.textContent = esc(I.t('noHeroImages')); return; }
      zone.innerHTML = heroImages.map((h) =>
        '<div class="flex-between mb-1 hero-row" style="align-items:center" data-hero-id="' + esc(h.id) + '">' +
        '<img src="' + esc(h.image_path) + '" alt="" width="88" height="56" style="object-fit:cover;border-radius:10px">' +
        '<span class="small">' + (h.is_primary ? '<b class="hero-primary">' + esc(I.t('heroPrimary')) + '</b>' : '') + '</span>' +
        (h.is_primary ? '' : '<button type="button" class="btn btn-outline btn-sm" data-hero-primary>' + esc(I.t('heroMakePrimary')) + '</button>') +
        '<button type="button" class="btn btn-outline btn-sm" data-hero-remove>' + esc(I.t('heroRemove')) + '</button></div>'
      ).join('');
      zone.querySelectorAll('[data-hero-primary]').forEach((b) => b.addEventListener('click', async () => {
        const id = b.closest('[data-hero-id]').dataset.heroId;
        await api.request('/api/admin/hero-images/' + id, { method: 'PATCH', body: { isPrimary: true } });
        loadHeroList();
      }));
      zone.querySelectorAll('[data-hero-remove]').forEach((b) => b.addEventListener('click', async () => {
        const id = b.closest('[data-hero-id]').dataset.heroId;
        await api.request('/api/admin/hero-images/' + id, { method: 'DELETE' });
        loadHeroList();
      }));
    } catch (err) { zone.textContent = err.message; }
  }

  async function uploadHero() {
    const f = document.getElementById('hero-file').files[0];
    if (!f) return toast('Choose an image first', 'error');
    const optimized = await App.compressImage(f, { max: 1600, quality: 0.75 });
    const fd = new FormData();
    fd.append('image', optimized, 'hero.webp');
    try {
      await api.request('/api/admin/images?type=hero', { method: 'POST', body: fd });
      document.getElementById('hero-file').value = '';
      loadHeroList();
    } catch (err) { toast(err.message, 'error'); }
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

  let analyticsPeriod = { preset: '7d' };

  async function loadAnalytics() {
    const zone = document.getElementById('tab-analytics');
    zone.innerHTML = '<div class="empty-state">' + esc(I.t('loading')) + '</div>';
    try {
      const q = analyticsPeriod.preset
        ? '?preset=' + encodeURIComponent(analyticsPeriod.preset)
        : '?from=' + encodeURIComponent(analyticsPeriod.from) + '&to=' + encodeURIComponent(analyticsPeriod.to);
      const a = await api.get('/api/admin/analytics' + q);
      const maxOrders = Math.max(1, ...a.series.map((s) => s.orders));
      const revEntries = Object.entries(a.revenueByCurrency || {});
      const revenueLine = revEntries.length
        ? revEntries.map(([cur, fig]) => fmtMoney(fig.revenueCents, cur)).join(' · ')
        : fmtMoney(a.totals.revenueCents, currency);
      const aovLine = revEntries.length
        ? revEntries.map(([cur, fig]) => fmtMoney(
          fig.orders > 0 ? Math.round(fig.revenueCents / fig.orders) : 0, cur)).join(' · ')
        : fmtMoney(a.averageOrderValueCents, currency);

      zone.innerHTML =
        '<div class="flex-between mb-2"><h1 class="section-title">' + esc(I.t('analyticsTab')) + '</h1>' +
          '<div class="flex-between" style="gap:8px">' +
          '<a class="btn btn-outline btn-sm" href="/api/admin/reports/orders.csv" download>' + esc(I.t('exportCsv')) + '</a>' +
          '<select id="an-preset">' +
            '<option value="today"' + (analyticsPeriod.preset === 'today' ? ' selected' : '') + '>' + esc(I.t('presetToday')) + '</option>' +
            '<option value="7d"' + (analyticsPeriod.preset === '7d' ? ' selected' : '') + '>' + esc(I.t('last7')) + '</option>' +
            '<option value="30d"' + (analyticsPeriod.preset === '30d' ? ' selected' : '') + '>' + esc(I.t('last30')) + '</option>' +
            '<option value="custom"' + (!analyticsPeriod.preset ? ' selected' : '') + '>' + esc(I.t('customRange')) + '</option>' +
          '</select></div></div>' +
        '<div class="card mb-2" id="an-custom"' + (analyticsPeriod.preset ? ' style="display:none"' : '') + '>' +
          '<div class="flex-between" style="gap:8px">' +
            '<label>' + esc(I.t('fromDate')) + ' <input type="date" id="an-from" value="' + esc(analyticsPeriod.from || '') + '"></label>' +
            '<label>' + esc(I.t('toDate')) + ' <input type="date" id="an-to" value="' + esc(analyticsPeriod.to || '') + '"></label>' +
            '<button id="an-apply" type="button" class="btn btn-secondary btn-sm">' + esc(I.t('applyBtn')) + '</button>' +
          '</div></div>' +

        '<div class="grid-stats mb-2">' +
          statCard(I.t('totalOrders'), a.totals.orders) +
          statCard(I.t('revenueL'), revenueLine) +
          statCard(I.t('avOrderValue'), aovLine) +
          statCard(I.t('todaysOrders'), a.today.ordersToday) +
        '</div>' +

        '<section class="card"><h2>' + esc(I.t('pickupDeliveryH')) + '</h2>' +
          '<div class="rank-row"><span>' + esc(I.t('pickup')) + '</span><span><strong>' + (a.pickupVsDelivery ? a.pickupVsDelivery.pickup : 0) + '</strong> ' + esc(I.t('ordersWord')) + '</span></div>' +
          '<div class="rank-row"><span>' + esc(I.t('delivery')) + '</span><span><strong>' + (a.pickupVsDelivery ? a.pickupVsDelivery.delivery : 0) + '</strong> ' + esc(I.t('ordersWord')) + '</span></div>' +
        '</section>' +

        '<section class="card"><h2>' + esc(I.t('statusBreakdownH')) + '</h2>' +
          (a.statusSplit
            ? Object.entries(a.statusSplit).map(([st, n]) =>
                '<div class="rank-row"><span>' + esc(statusLabel(st)) + '</span><span><strong>' + n + '</strong> ' + esc(I.t('ordersWord')) + '</span></div>'
              ).join('')
            : '<p class="muted">' + esc(I.t('noSales')) + '</p>') +
        '</section>' +

        '<section class="card"><h2>' + esc(I.t('preorderBreakdownH')) + '</h2>' +
          '<div class="rank-row"><span>' + esc(I.t('normalLabel')) + '</span><span><strong>' + (a.preorderSplit ? a.preorderSplit.normal : 0) + '</strong> ' + esc(I.t('ordersWord')) + '</span></div>' +
          '<div class="rank-row"><span>' + esc(I.t('preorderBadge')) + '</span><span><strong>' + (a.preorderSplit ? a.preorderSplit.preorder : 0) + '</strong> ' + esc(I.t('ordersWord')) + '</span></div>' +
        '</section>' +

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
                '<div class="rank-row"><span>' + (i + 1) + '. ' + esc(t.name || t.item_name) + '</span>' +
                '<span><strong>' + (t.quantity ?? t.units) + '</strong> ' + esc(I.t('soldW')) + ' · ' + fmtMoney(t.revenueCents, currency) + '</span></div>'
              ).join('')
            : '<p class="muted">' + esc(I.t('noSales')) + '</p>') +
        '</section>';

      // CSP-safe bar heights via CSSOM.
      zone.querySelectorAll('.chart .bar').forEach((el) => {
        el.style.height = (el.dataset.h || 2) + '%';
        el.parentElement.style.justifyContent = 'flex-end';
      });

      document.getElementById('an-preset').addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          analyticsPeriod = { from: analyticsPeriod.from, to: analyticsPeriod.to };
        } else {
          analyticsPeriod = { preset: e.target.value };
        }
        loadAnalytics();
      });
      const applyBtn = document.getElementById('an-apply');
      if (applyBtn) {
        applyBtn.addEventListener('click', () => {
          analyticsPeriod = {
            from: document.getElementById('an-from').value,
            to: document.getElementById('an-to').value,
          };
          loadAnalytics();
        });
      }
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
