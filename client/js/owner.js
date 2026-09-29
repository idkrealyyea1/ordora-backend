'use strict';

/**
 * Platform owner dashboard: create/manage restaurants, admin accounts,
 * limits, activation and monitoring.
 */

(function () {
  const { api, esc, fmtMoney, fmtDateTime, debounce, toast, STATUS_LABELS } = window.App;
  const I = window.I18N;

  let page = 1;
  let search = '';
  let statusFilter = '';
  let currentRole = null;

  /* ---------------------------- bootstrap ---------------------------- */

  async function boot() {
    try {
      const me = await api.get('/api/auth/me');
      if (!me.user) {
        location.href = '/login.html';
        return;
      }
      if (me.user.role !== 'owner' && me.user.role !== 'staff') {
        location.href = '/admin.html';
        return;
      }
      currentRole = me.user.role;
    } catch (_) {
      location.href = '/login.html';
      return;
    }

    document.getElementById('logout-btn').addEventListener('click', async () => {
      await api.post('/api/auth/logout').catch(() => {});
      location.href = '/login.html';
    });

        document.getElementById('new-restaurant-btn').addEventListener('click', createModal);

    const dgForm = document.getElementById('delivery-form');
    dgForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('dg-name');
      const phoneInput = document.getElementById('dg-phone');
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      try {
        await api.post('/api/owner/delivery-groups', { name, phone: phoneInput.value.trim() });
        nameInput.value = '';
        phoneInput.value = '';
        await loadDeliveryGroups();
      } catch (err) { toast(err.message, 'error'); }
    });
    document.getElementById('search-input').addEventListener('input', debounce(() => {
      search = document.getElementById('search-input').value.trim();
      page = 1;
      loadRestaurants();
    }, 300));
    document.getElementById('status-filter').addEventListener('change', (e) => {
      statusFilter = e.target.value;
      page = 1;
      loadRestaurants();
    });
    document.getElementById('page-prev').addEventListener('click', () => {
      if (page > 1) { page--; loadRestaurants(); }
    });
    document.getElementById('page-next').addEventListener('click', () => { page++; loadRestaurants(); });

    const backdrop = document.getElementById('modal-backdrop');
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    document.getElementById('delivery-zone').addEventListener('click', async (e) => {
      const acctBtn = e.target.closest('[data-account]');
      if (acctBtn) { manageDeliveryAccount(acctBtn.getAttribute('data-account')); return; }
      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) { editDeliveryGroup(editBtn.getAttribute('data-edit')); return; }
      const btn = e.target.closest('[data-del]');
      if (!btn) return;
      if (!window.confirm(I.t('confirmDeleteGroup'))) return;
      try {
        await api.del('/api/owner/delivery-groups/' + btn.getAttribute('data-del'));
        await loadDeliveryGroups();
      } catch (err) { toast(err.message, 'error'); }
    });

    I18N.onChange(() => {
      loadOverview();
      loadRestaurants();
      loadDeliveryGroups();
      loadRequests();
    });

    await Promise.all([loadOverview(), loadRestaurants(), loadDeliveryGroups(), loadPricing(), loadRequests()]);

    // Requests filters
    const reqStatus = document.getElementById('requests-status');
    if(reqStatus) reqStatus.addEventListener('change', ()=>{ reqPage=1; loadRequests(); });
    const reqRefresh = document.getElementById('requests-refresh');
    if(reqRefresh) reqRefresh.addEventListener('click', loadRequests);
    const rp = document.getElementById('req-prev');
    if(rp) rp.addEventListener('click', ()=>{ if(reqPage>1){ reqPage--; loadRequests(); }});
    const rn = document.getElementById('req-next');
    if(rn) rn.addEventListener('click', ()=>{ reqPage++; loadRequests(); });

    // Pricing form — owner only
    const pricingForm = document.getElementById('pricing-form');
    if (pricingForm && !pricingForm.dataset.bound) {
      pricingForm.dataset.bound = '1';
      pricingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const priceMaj = parseFloat(document.getElementById('pricing-price').value);
        const cur = document.getElementById('pricing-currency').value;
        if (!Number.isFinite(priceMaj) || priceMaj < 0) { toast('Invalid price', 'error'); return; }
        try {
          await api.patch('/api/owner/platform-pricing', { pricingCents: Math.round(priceMaj * 100), pricingCurrency: cur });
          toast('Pricing saved', 'success');
          await loadPricing();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // Staff: hide delete/password UI, owner: load staff panel
    if (currentRole === 'owner') {
      loadStaff();
      const sf = document.getElementById('staff-form');
      if (sf && !sf.dataset.bound) {
        sf.dataset.bound = '1';
        sf.addEventListener('submit', async (e) => {
          e.preventDefault();
          try {
            await api.post('/api/owner/staff', {
              username: document.getElementById('staff-user').value.trim(),
              password: document.getElementById('staff-pass').value,
            });
            toast('Staff added', 'success');
            document.getElementById('staff-user').value = '';
            document.getElementById('staff-pass').value = '';
            loadStaff();
          } catch (err) { toast(err.message, 'error'); }
        });
      }
    } else if (currentRole === 'staff') {
      const sc = document.getElementById('staff-card');
      if (sc) sc.style.display = 'none';
      const ol = document.getElementById('offers-link');
      if (ol) ol.style.display = 'none';
      // hide delete buttons (server still blocks)
      document.querySelectorAll('[data-delete],[data-del]').forEach((b) => { b.style.display = 'none'; });
    }
  }

  function closeModal() {
    document.getElementById('modal-backdrop').classList.remove('open');
  }
  function openModal(html) {
    document.getElementById('modal-box').innerHTML = html;
    document.getElementById('modal-backdrop').classList.add('open');
  }

  /* ----------------------------- overview ----------------------------- */

  async function loadOverview() {
    try {
      const o = await api.get('/api/owner/overview');
      document.getElementById('overview-zone').innerHTML =
        '<div class="grid-stats mb-2">' +
          '<div class="stat"><div class="stat-label">' + I.t('ovRestaurants') + '</div><div class="stat-value">' + o.restaurantsTotal + '</div></div>' +
          '<div class="stat"><div class="stat-label">' + I.t('ovActive') + '</div><div class="stat-value">' + o.restaurantsActive + '</div></div>' +
          '<div class="stat"><div class="stat-label">' + I.t('ovOrdersToday') + '</div><div class="stat-value">' + o.ordersToday + '</div></div>' +
          '<div class="stat"><div class="stat-label">' + I.t('ovRevenueToday') + '</div><div class="stat-value">' + esc(String(fmtMoney(o.revenueTodayCents, 'USD'))) + '</div></div>' +
        '</div>';
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /* --------------------------- delivery groups ------------------------ */

  async function loadDeliveryGroups() {
    const zone = document.getElementById('delivery-zone');
    try {
      const data = await api.get('/api/owner/delivery-groups');
      if (!data.groups.length) {
        zone.innerHTML = '<div class="empty-state">' + I.t('noGroupsYetOwner') + '</div>';
        return;
      }
      zone.innerHTML =
        '<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>' + I.t('thName') + '</th><th>' + I.t('thPhone') + '</th><th>' + I.t('thRestaurants') + '</th><th></th>' +
        '</tr></thead><tbody>' +
        data.groups.map((g) =>
          '<tr>' +
            '<td><strong>' + esc(g.name) + '</strong>' +
              (g.notes ? '<div class="small muted">' + esc(g.notes) + '</div>' : '') + '</td>' +
            '<td class="muted">' + esc(g.phone || '&mdash;') + '</td>' +
            '<td>' + g.restaurantCount + '</td>' +
            '<td class="ta-r"><button type="button" class="btn btn-outline btn-sm" data-account="' + esc(g.id) + '">' + I.t('delAccountH') + '</button> ' +
              '<button type="button" class="btn btn-outline btn-sm" data-edit="' + esc(g.id) + '">' + I.t('bEdit') + '</button> ' +
              '<button type="button" class="btn btn-outline btn-sm" data-del="' + esc(g.id) + '">' + I.t('bDelete') + '</button></td>' +
          '</tr>'
        ).join('') +
        '</tbody></table></div>';
    } catch (err) { zone.innerHTML = '<div class="empty-state">' + esc(err.message) + '</div>'; }
  }

  async function editDeliveryGroup(id) {
    try {
      const data = await api.get('/api/owner/delivery-groups');
      const g = data.groups.find((x) => x.id === id);
      if (!g) { toast(I.t('noGroupsYetOwner'), 'error'); return; }
      openModal(
        '<div class="modal-head"><h2>' + I.t('mEditGroup') + '</h2><button type="button" class="modal-close">&times;</button></div>' +
        '<form id="dg-edit-form">' +
          '<div class="field"><label for="dg-edit-name">' + I.t('mCompanyName') + '</label><input id="dg-edit-name" maxlength="80" value="' + esc(g.name) + '" required></div>' +
          '<div class="field"><label for="dg-edit-phone">' + I.t('mCompanyPhone') + '</label><input id="dg-edit-phone" type="tel" maxlength="20" value="' + esc(g.phone || '') + '"></div>' +
          '<div class="field"><label for="dg-edit-notes">' + I.t('mNotes') + '</label><textarea id="dg-edit-notes" maxlength="300">' + esc(g.notes || '') + '</textarea></div>' +
          '<button type="submit" class="btn btn-block">' + I.t('mSave') + '</button>' +
        '</form>'
      );
      document.querySelector('.modal-close').addEventListener('click', closeModal);
      document.getElementById('dg-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api.patch('/api/owner/delivery-groups/' + id, {
            name: document.getElementById('dg-edit-name').value.trim(),
            phone: document.getElementById('dg-edit-phone').value.trim(),
            notes: document.getElementById('dg-edit-notes').value,
          });
          closeModal();
          toast(I.t('groupSaved'), 'success');
          await loadDeliveryGroups();
        } catch (err) { toast(err.message, 'error'); }
      });
    } catch (err) { toast(err.message, 'error'); }
  }

  async function manageDeliveryAccount(id) {
    try {
      const data = await api.get('/api/owner/delivery-groups');
      const g = data.groups.find((x) => x.id === id);
      if (!g) { toast(I.t('noGroupsYetOwner'), 'error'); return; }
      const acct = (g.accounts && g.accounts[0]) || null;

      if (!acct) {
        openModal(
          '<div class="modal-head"><h2>' + I.t('delAccountH') + ' — ' + esc(g.name) + '</h2><button type="button" class="modal-close">&times;</button></div>' +
          '<p class="muted small">' + I.t('noDelAccount') + '</p>' +
          '<form id="dac-create-form">' +
            '<div class="field"><label for="dac-user">' + I.t('dacUsername') + '</label><input id="dac-user" maxlength="40" placeholder="dlv_' + esc(g.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)) + '"></div>' +
            '<div class="field"><label for="dac-pass">' + I.t('dacPassword') + '</label><input id="dac-pass" type="text" maxlength="200" placeholder="' + esc(I.t('dacPassHint')) + '"></div>' +
            '<button type="submit" class="btn btn-block">' + I.t('dacCreate') + '</button>' +
          '</form>' +
          '<a class="btn btn-outline btn-block mt-1" href="/delivery.html" target="_blank" rel="noopener">' + I.t('dacOpenDash') + '</a>'
        );
        document.querySelector('.modal-close').addEventListener('click', closeModal);
        document.getElementById('dac-create-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const body = {};
          const u = document.getElementById('dac-user').value.trim();
          if (u) body.username = u;
          const p = document.getElementById('dac-pass').value;
          if (p) body.password = p;
          try {
            const res = await api.post('/api/owner/delivery-groups/' + id + '/account', body);
            closeModal();
            if (res.password) {
              openModal(
                '<div class="modal-head"><h2>' + I.t('dacCreated') + '</h2></div>' +
                '<p>' + I.t('dacUsernameL') + ' <strong>' + esc(res.account.username) + '</strong></p>' +
                '<p>' + I.t('dacPasswordL') + '</p><p class="order-code">' + esc(res.password) + '</p>' +
                '<a class="btn btn-block" href="/delivery.html" target="_blank" rel="noopener">' + I.t('dacOpenDash') + '</a>'
              );
            } else {
              toast(I.t('groupSaved'), 'success');
            }
            await loadDeliveryGroups();
          } catch (err) { toast(err.message, 'error'); }
        });
        return;
      }

      openModal(
        '<div class="modal-head"><h2>' + I.t('delAccountH') + ' — ' + esc(g.name) + '</h2><button type="button" class="modal-close">&times;</button></div>' +
        '<div class="rank-row"><span><strong>' + esc(acct.username) + '</strong>' +
          (acct.isActive ? '' : ' <span class="badge badge-closed">' + esc(I.t('mDisabled')) + '</span>') + '</span></div>' +
        '<div class="flex-between mt-2" style="gap:8px">' +
          '<button type="button" class="btn btn-outline btn-sm" id="dac-reset">' + I.t('mResetPw') + '</button>' +
          (acct.isActive
            ? '<button type="button" class="btn btn-danger btn-sm" id="dac-disable">' + I.t('bDisable') + '</button>'
            : '<button type="button" class="btn btn-success btn-sm" id="dac-enable">' + I.t('bEnable') + '</button>') +
          '<button type="button" class="btn btn-danger btn-sm" id="dac-delete">' + I.t('bDelete') + '</button>' +
          '<a class="btn btn-outline btn-sm" href="/delivery.html" target="_blank" rel="noopener">' + I.t('dacOpenDash') + '</a>' +
        '</div>'
      );
      document.querySelector('.modal-close').addEventListener('click', closeModal);

      document.getElementById('dac-reset').addEventListener('click', async () => {
        if (!window.confirm(I.t('confirmResetPw'))) return;
        try {
          const res = await api.post('/api/owner/delivery-groups/' + id + '/account/reset-password', {});
          closeModal();
          openModal(
            '<div class="modal-head"><h2>' + I.t('mPwReset') + '</h2></div>' +
            '<p>' + I.t('mNewTempPw') + '</p><p class="order-code">' + esc(res.password) + '</p>' +
            '<button type="button" class="btn btn-block" id="pw-done3">' + I.t('mSavedIt') + '</button>'
          );
          document.getElementById('pw-done3').addEventListener('click', closeModal);
        } catch (err) { toast(err.message, 'error'); }
      });

      const dis = document.getElementById('dac-disable');
      if (dis) dis.addEventListener('click', async () => {
        try {
          await api.patch('/api/owner/delivery-groups/' + id + '/account', { isActive: false });
          toast(I.t('toastAdminDisabled'), 'success');
          manageDeliveryAccount(id);
        } catch (err) { toast(err.message, 'error'); }
      });
      const en = document.getElementById('dac-enable');
      if (en) en.addEventListener('click', async () => {
        try {
          await api.patch('/api/owner/delivery-groups/' + id + '/account', { isActive: true });
          toast(I.t('toastAdminEnabled'), 'success');
          manageDeliveryAccount(id);
        } catch (err) { toast(err.message, 'error'); }
      });
      document.getElementById('dac-delete').addEventListener('click', async () => {
        if (!window.confirm(I.t('dacDeleteConfirm'))) return;
        try {
          await api.del('/api/owner/delivery-groups/' + id + '/account');
          closeModal();
          toast(I.t('dacDeleted'), 'success');
          await loadDeliveryGroups();
        } catch (err) { toast(err.message, 'error'); }
      });
    } catch (err) { toast(err.message, 'error'); }
  }


  async function loadRestaurants() {
    const zone = document.getElementById('restaurants-zone');
      zone.innerHTML = '<div class="empty-state">' + I.t('mLoading') + '</div>';
      try {
        const q = '?page=' + page + '&limit=20' +
          (search ? '&search=' + encodeURIComponent(search) : '') +
          (statusFilter ? '&status=' + statusFilter : '');
        const data = await api.get('/api/owner/restaurants' + q);

        zone.innerHTML = data.restaurants.length
          ? '<div class="table-wrap"><table class="data"><thead><tr>' +
            '<th>' + I.t('thName') + '</th><th>' + I.t('thSlug') + '</th><th>' + I.t('thMenu') + '</th><th>' + I.t('thStatus') + '</th><th>' + I.t('thCreated') + '</th><th>' + I.t('thActions') + '</th>' +
          '</tr></thead><tbody>' +
          data.restaurants.map((r) =>
            '<tr>' +
              '<td><strong>' + esc(r.name) + '</strong></td>' +
              '<td class="small muted">/' + esc(r.slug) + '</td>' +
              '<td>' + r.itemCount + ' / ' + r.maxMenuItems + '</td>' +
              '<td>' +
                (r.isActive
                  ? '<span class="badge badge-open">' + I.t('badgeActive') + '</span>'
                  : '<span class="badge badge-closed">' + I.t('badgeDeactivated') + '</span>') + ' ' +
                '<span class="badge">' + I.t('status_' + r.status) + '</span>' +
              '</td>' +
              '<td class="small muted">' + fmtDateTime(r.createdAt) + '</td>' +
              '<td><div class="flex-between">' +
                '<a class="btn btn-outline btn-sm" href="/restaurant/' + encodeURIComponent(r.slug) + '" target="_blank" rel="noopener">' + I.t('bPublic') + '</a>' +
                '<button type="button" class="btn btn-outline btn-sm" data-manage="' + esc(r.id) + '">' + I.t('bManage') + '</button>' +
                '<button type="button" class="btn btn-outline btn-sm" data-edit="' + esc(r.id) + '">' + I.t('bEdit') + '</button>' +
                (r.isActive
                  ? '<button type="button" class="btn btn-danger btn-sm" data-deactivate="' + esc(r.id) + '" data-name="' + esc(r.name) + '">' + I.t('bDisable') + '</button>'
                  : '<button type="button" class="btn btn-success btn-sm" data-activate="' + esc(r.id) + '">' + I.t('bEnable') + '</button>') +
                '<button type="button" class="btn btn-danger btn-sm" data-delete="' + esc(r.id) + '" data-name="' + esc(r.name) + '">' + I.t('bDelete') + '</button>' +
              '</div></td>' +
            '</tr>'
          ).join('') +
          '</tbody></table></div>'
        : '<div class="empty-state">' + I.t('noRestaurants') + '</div>';

      document.getElementById('page-info').textContent =
        I.t('pageInfo', { p: page, t: Math.max(1, Math.ceil(data.total / data.limit)), n: data.total });

      wireRows(data.restaurants);
      // ponytail: hide staff delete after every re-render (pagination/search re-creates DOM)
      if (currentRole === 'staff') {
        document.querySelectorAll('#restaurants-zone [data-delete],[data-deactivate],[data-activate]').forEach((b) => { b.style.display = 'none'; });
        document.querySelectorAll('#delivery-zone [data-del],[data-edit]').forEach((b) => { b.style.display = 'none'; });
      }
    } catch (err) {
      zone.innerHTML = '<div class="notice notice-error">' + esc(err.message) + '</div>';
    }
  }

  function findRestaurant(list, id) {
    return list.find((r) => r.id === id);
  }

  function wireRows(restaurants) {
    const zone = document.getElementById('restaurants-zone');

    zone.querySelectorAll('[data-manage]').forEach((b) =>
      b.addEventListener('click', () => manageModal(b.dataset.manage)));

    zone.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => editModal(findRestaurant(restaurants, b.dataset.edit))));

    zone.querySelectorAll('[data-deactivate]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm(I.t('confirmDeactivate', { name: b.dataset.name }))) return;
        await act(() => api.patch('/api/owner/restaurants/' + b.dataset.deactivate, { isActive: false }));
      }));

    zone.querySelectorAll('[data-activate]').forEach((b) =>
      b.addEventListener('click', async () => {
        await act(() => api.patch('/api/owner/restaurants/' + b.dataset.activate, { isActive: true }));
      }));

    zone.querySelectorAll('[data-delete]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm(I.t('confirmDeleteRest', { name: b.dataset.name }))) return;
        await act(() => api.del('/api/owner/restaurants/' + b.dataset.delete));
      }));
  }

  async function act(fn) {
    try {
      await fn();
      toast(I.t('toastDone'), 'success');
      closeModal();
      await Promise.all([loadOverview(), loadRestaurants()]);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /* ------------------------------ modals -------------------------------- */

  function createModal() {
    openModal(
      '<div class="modal-head"><h2>' + I.t('mNewRestaurant') + '</h2><button type="button" class="modal-close">&times;</button></div>' +
      '<form id="create-form">' +
        '<div class="field"><label for="cr-name">' + I.t('mRestName') + '</label><input id="cr-name" maxlength="80" required></div>' +
        '<div class="field"><label for="cr-slug">' + I.t('mSlug') + '</label><input id="cr-slug" maxlength="63" placeholder="' + I.t('mSlugHint') + '">' +
          '<div class="hint">' + I.t('mPublicPage') + '</div></div>' +
        '<div class="field"><label for="cr-max">' + I.t('mMaxItems') + '</label><input id="cr-max" type="number" min="1" max="10000" value="30" required></div>' +
        '<h3 class="section-title">' + I.t('mFirstAdmin') + '</h3>' +
        '<div class="field"><label for="cr-user">' + I.t('mAdminUser') + '</label><input id="cr-user" maxlength="40"></div>' +
        '<div class="field"><label for="cr-email">' + I.t('mAdminEmail') + '</label><input id="cr-email" type="email" maxlength="120"></div>' +
        '<div class="field"><label for="cr-pass">' + I.t('mAdminPass') + '</label><input id="cr-pass" type="text" maxlength="200" placeholder="' + I.t('mAdminPassHint') + '"></div>' +
        '<button type="submit" class="btn btn-block">' + I.t('mCreate') + '</button>' +
      '</form>'
    );
    document.querySelector('.modal-close').addEventListener('click', closeModal);

    document.getElementById('create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        name: document.getElementById('cr-name').value,
        slug: document.getElementById('cr-slug').value || undefined,
        maxMenuItems: Number(document.getElementById('cr-max').value),
      };
      const username = document.getElementById('cr-user').value.trim();
      if (username) {
        body.adminUsername = username;
        body.adminEmail = document.getElementById('cr-email').value.trim();
        const pw = document.getElementById('cr-pass').value;
        if (pw) body.adminPassword = pw;
      }
      try {
        const res = await api.post('/api/owner/restaurants', body);
        closeModal();
        if (res.admin && res.admin.generatedPassword) {
          openModal(
            '<div class="modal-head"><h2>' + I.t('mRestCreated') + '</h2></div>' +
            '<p>' + I.t('mNewTempPw') + '</p>' +
            '<p class="order-code">' + esc(res.admin.generatedPassword) + '</p>' +
            '<button type="button" class="btn btn-block" id="pw-done">' + I.t('mSavedIt') + '</button>'
          );
          document.getElementById('pw-done').addEventListener('click', closeModal);
        } else {
          toast(I.t('toastRestCreated'), 'success');
        }
        await Promise.all([loadOverview(), loadRestaurants()]);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  function editModal(r) {
    openModal(
      '<div class="modal-head"><h2>' + I.t('mEdit') + ' ' + esc(r.name) + '</h2><button type="button" class="modal-close">&times;</button></div>' +
      '<form id="edit-form">' +
        '<div class="field"><label for="ed-name">' + I.t('mName') + '</label><input id="ed-name" maxlength="80" value="' + esc(r.name) + '" required></div>' +
        '<div class="field"><label for="ed-slug">' + I.t('mSlug2') + '</label><input id="ed-slug" maxlength="63" value="' + esc(r.slug) + '" required></div>' +
        '<div class="field"><label for="ed-max">' + I.t('mMaxItems') + '</label><input id="ed-max" type="number" min="1" max="10000" value="' + r.maxMenuItems + '" required></div>' +
        '<button type="submit" class="btn btn-block">' + I.t('mSave') + '</button>' +
      '</form>'
    );
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await act(() => api.patch('/api/owner/restaurants/' + r.id, {
        name: document.getElementById('ed-name').value,
        slug: document.getElementById('ed-slug').value,
        maxMenuItems: Number(document.getElementById('ed-max').value),
      }));
    });
  }

  async function manageModal(id) {
    try {
      const d = await api.get('/api/owner/restaurants/' + id);
      const r = d.restaurant;
      const s = r.settings || {};

      openModal(
        '<div class="modal-head"><h2>' + esc(r.name) + '</h2><button type="button" class="modal-close">&times;</button></div>' +

        '<div class="grid-stats mb-2">' +
          '<div class="stat"><div class="stat-label">' + I.t('mMenuItems') + '</div><div class="stat-value">' + d.stats.itemCount + '</div></div>' +
          '<div class="stat"><div class="stat-label">' + I.t('mPendingOrders') + '</div><div class="stat-value">' + d.stats.pendingOrders + '</div></div>' +
          '<div class="stat"><div class="stat-label">' + I.t('mOrders7d') + '</div><div class="stat-value">' + d.stats.ordersLast7d + '</div></div>' +
          '<div class="stat"><div class="stat-label">' + I.t('mRevenue7d') + '</div><div class="stat-value">' + esc(String(fmtMoney(d.stats.revenueLast7dCents, s.currency || 'USD'))) + '</div></div>' +
        '</div>' +

        '<h3 class="section-title">' + I.t('mAdmins') + '</h3>' +
        d.admins.map((a) =>
          '<div class="rank-row"><span><strong>' + esc(a.username) + '</strong>' +
            (a.is_active ? '' : ' <span class="badge badge-closed">' + I.t('mDisabled') + '</span>') + '</span>' +
            '<span>' +
              '<button type="button" class="btn btn-outline btn-sm" data-reset-pw="' + esc(a.id) + '">' + I.t('mResetPw') + '</button> ' +
              (a.is_active
                ? '<button type="button" class="btn btn-danger btn-sm" data-disable-admin="' + esc(a.id) + '">' + I.t('bDisable') + '</button>'
                : '<button type="button" class="btn btn-success btn-sm" data-enable-admin="' + esc(a.id) + '">' + I.t('bEnable') + '</button>') +
            '</span></div>'
        ).join('') +
        '<form id="new-admin-form" class="mt-2">' +
          '<div class="form-row form-row-2">' +
            '<input id="na-user" placeholder="' + I.t('mNewAdminUser') + '" maxlength="40" required>' +
            '<input id="na-pass" placeholder="' + I.t('mNewAdminPass') + '" maxlength="200" required>' +
          '</div>' +
          '<button type="submit" class="btn btn-outline btn-block mt-1">' + I.t('mAddAdmin') + '</button>' +
        '</form>' +

        '<h3 class="section-title">' + I.t('mRecentOrders') + '</h3><div id="owner-orders" class="mb-2"><div class="empty-state small">' + I.t('mLoading') + '</div></div>'
      );
      document.querySelector('.modal-close').addEventListener('click', closeModal);

      // Recent orders inside the modal
      api.get('/api/owner/restaurants/' + id + '/orders?limit=5').then((res) => {
        const zone = document.getElementById('owner-orders');
          zone.innerHTML = res.orders.length
            ? res.orders.map((o) =>
                '<div class="rank-row"><span><strong>' + esc(o.code) + '</strong> · ' + esc(o.customer_name) + '</span>' +
                '<span><span class="badge status-' + esc(o.status) + '">' + I.t('status_' + o.status) + '</span> ' +
                esc(String(fmtMoney(o.total_cents, s.currency || 'USD'))) + '</span></div>'
              ).join('')
            : '<p class="muted small">' + I.t('mNoOrders') + '</p>';
      }).catch(() => {});

      document.getElementById('new-admin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api.post('/api/owner/restaurants/' + id + '/admins', {
            username: document.getElementById('na-user').value.trim(),
            password: document.getElementById('na-pass').value,
          });
           toast(I.t('toastAdminAdded'), 'success');
          manageModal(id);
        } catch (err) {
          toast(err.message, 'error');
        }
      });

      document.querySelectorAll('[data-reset-pw]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (!confirm(I.t('confirmResetPw'))) return;
          try {
            const res = await api.post('/api/owner/restaurants/' + id + '/admins/' + b.dataset.resetPw + '/reset-password', {});
            openModal(
              '<div class="modal-head"><h2>' + I.t('mPwReset') + '</h2></div>' +
              '<p>' + esc(I.t('mNewTempPw')) + '</p>' +
              '<p class="order-code">' + esc(res.password) + '</p>' +
              '<button type="button" class="btn btn-block" id="pw-done2">' + I.t('mSavedIt') + '</button>'
            );
            document.getElementById('pw-done2').addEventListener('click', () => { closeModal(); manageModal(id); });
          } catch (err) {
            toast(err.message, 'error');
          }
        }));

      document.querySelectorAll('[data-disable-admin]').forEach((b) =>
        b.addEventListener('click', async () => {
          try {
             await api.patch('/api/owner/restaurants/' + id + '/admins/' + b.dataset.disableAdmin, { isActive: false });
            toast(I.t('toastAdminDisabled'), 'success');
            manageModal(id);
          } catch (err) { toast(err.message, 'error'); }
        }));

      document.querySelectorAll('[data-enable-admin]').forEach((b) =>
        b.addEventListener('click', async () => {
          try {
              await api.patch('/api/owner/restaurants/' + id + '/admins/' + b.dataset.enableAdmin, { isActive: true });
            toast(I.t('toastAdminEnabled'), 'success');
            manageModal(id);
          } catch (err) { toast(err.message, 'error'); }
        }));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function loadPricing() {
    const zone = document.getElementById('pricing-zone');
    if (!zone) return;
    try {
      const data = await api.get('/api/owner/platform-pricing').catch(() => api.get('/api/pricing'));
      const p = data.pricing || data;
      const major = (p.pricing_cents / 100).toFixed(2);
      document.getElementById('pricing-price').value = major;
      document.getElementById('pricing-currency').value = p.pricing_currency || 'USD';
      zone.textContent = 'Current: ' + fmtMoney(p.pricing_cents, p.pricing_currency || 'USD') + ' / ' + (p.pricing_period || 'month') + ' — trial ' + (p.trial_days || 7) + ' days';
    } catch (err) {
      zone.textContent = err.message;
    }
  }

  let reqPage=1;
  async function loadRequests(){
    const zone=document.getElementById('requests-zone');
    if(!zone) return;
    const status=document.getElementById('requests-status')?.value || '';
    const q='?page='+reqPage+'&limit=10'+(status?'&status='+encodeURIComponent(status):'');
    zone.innerHTML='<div class="empty-state small">جاري التحميل…</div>';
    try{
      const data=await api.get('/api/owner/restaurant-requests'+q);
      const list=data.requests||[];
      const pendingAll = await api.get('/api/owner/restaurant-requests?limit=1&status=pending').catch(()=>({total:0}));
      const badge=document.getElementById('req-count-badge');
      if(badge){ const n=pendingAll.total||0; badge.textContent=n? n+' جديد':''; badge.style.display=n?'inline-block':'none'; }
      if(!list.length){ zone.innerHTML='<div class="empty-state small">لا توجد طلبات.</div>'; document.getElementById('req-page-info').textContent=''; return; }
      zone.innerHTML='<div class="table-wrap"><table class="data"><thead><tr><th>الكود</th><th>العميل</th><th>المطعم</th><th>الهاتف</th><th>الحالة</th><th>تاريخ</th><th></th></tr></thead><tbody>'+
        list.map(r=>'<tr><td><span class="order-code">'+esc(r.code)+'</span></td><td>'+esc(r.customer_name)+'<div class="muted small">'+esc(r.city||'')+'</div></td><td><strong>'+esc(r.restaurant_name)+'</strong></td><td class="small">'+esc(r.phone)+'<br>'+esc(r.whatsapp)+'</td><td><span class="badge '+(r.status==='pending'?'badge-closed':r.status==='approved'?'badge-open':'')+'">'+esc(r.status)+'</span></td><td class="small muted">'+esc(String(r.created_at).slice(0,10))+'</td><td><div style="display:flex;gap:4px;flex-wrap:wrap"><select data-req-status="'+esc(r.id)+'"><option value="pending"'+(r.status==='pending'?' selected':'')+'>pending</option><option value="contacted"'+(r.status==='contacted'?' selected':'')+'>contacted</option><option value="approved"'+(r.status==='approved'?' selected':'')+'>approved</option><option value="rejected"'+(r.status==='rejected'?' selected':'')+'>rejected</option></select><a class="btn btn-outline btn-sm" href="https://wa.me/'+encodeURIComponent(String(r.whatsapp).replace(/[^0-9]/g,''))+'" target="_blank" rel="noopener">واتساب</a><button type="button" class="btn btn-danger btn-sm" data-req-del="'+esc(r.id)+'">حذف</button></div>'+(r.notes?'<div class="muted small" style="margin-top:4px">'+esc(r.notes)+'</div>':'')+'</td></tr>').join('')+'</tbody></table></div>';
      document.getElementById('req-page-info').textContent='صفحة '+data.page+' من '+Math.max(1,Math.ceil(data.total/data.limit))+' ('+data.total+')';
      zone.querySelectorAll('[data-req-status]').forEach(sel=> sel.addEventListener('change', async ()=>{
        try{ await api.patch('/api/owner/restaurant-requests/'+sel.getAttribute('data-req-status'), {status: sel.value}); toast('تم التحديث','success'); }catch(e){ toast(e.message,'error'); }
      }));
      zone.querySelectorAll('[data-req-del]').forEach(b=> b.addEventListener('click', async ()=>{
        if(!confirm('حذف الطلب '+b.getAttribute('data-req-del')+'؟')) return;
        try{ await api.del('/api/owner/restaurant-requests/'+b.getAttribute('data-req-del')); toast('تم الحذف','success'); loadRequests(); }catch(e){ toast(e.message,'error'); }
      }));
    }catch(err){ zone.innerHTML='<div class="notice notice-error">'+esc(err.message)+'</div>'; }
  }

  async function loadStaff() {
    const zone = document.getElementById('staff-zone');
    if (!zone) return;
    try {
      const data = await api.get('/api/owner/staff');
      zone.innerHTML = data.staff.length
        ? data.staff.map((u) =>
            '<div class="rank-row"><span><strong>' + esc(u.username) + '</strong> ' + (u.is_active ? '' : '<span class="badge badge-closed">disabled</span>') + '</span>' +
            '<span>' +
              (u.is_active
                ? '<button type="button" class="btn btn-outline btn-sm" data-disable-staff="' + esc(u.id) + '">Disable</button> '
                : '<button type="button" class="btn btn-success btn-sm" data-enable-staff="' + esc(u.id) + '">Enable</button> ') +
              '<button type="button" class="btn btn-danger btn-sm" data-del-staff="' + esc(u.id) + '">Delete</button> ' +
              '<button type="button" class="btn btn-outline btn-sm" data-reset-staff="' + esc(u.id) + '">Reset pw</button>' +
            '</span></div>'
          ).join('')
        : '<p class="muted small">No staff yet.</p>';
      zone.querySelectorAll('[data-disable-staff]').forEach((b) => b.addEventListener('click', async () => {
        await api.patch('/api/owner/staff/' + b.dataset.disableStaff, { isActive: false }); loadStaff();
      }));
      zone.querySelectorAll('[data-enable-staff]').forEach((b) => b.addEventListener('click', async () => {
        await api.patch('/api/owner/staff/' + b.dataset.enableStaff, { isActive: true }); loadStaff();
      }));
      zone.querySelectorAll('[data-del-staff]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Delete staff ' + b.dataset.delStaff + '?')) return;
        await api.del('/api/owner/staff/' + b.dataset.delStaff); loadStaff();
      }));
      zone.querySelectorAll('[data-reset-staff]').forEach((b) => b.addEventListener('click', async () => {
        const res = await api.post('/api/owner/staff/' + b.dataset.resetStaff + '/reset-password', {});
        openModal('<div class="modal-head"><h2>New password</h2></div><p class="order-code">' + esc(res.password) + '</p><button type="button" class="btn btn-block" onclick="location.reload()">OK</button>');
      }));
    } catch (err) {
      zone.innerHTML = '<p class="muted small">' + esc(err.message) + '</p>';
    }
  }

  boot();
})();
