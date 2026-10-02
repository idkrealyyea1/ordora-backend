'use strict';

/* Self-service onboarding wizard: account → type → info → product →
   fulfillment → hours → review → done. Profile/type lists are fetched when
   the endpoints exist (US2) and fall back to built-in generics otherwise.
   Loaded as a plain <script> (CSP forbids inline scripts). */

(function () {
  const { api, esc, debounce } = window.App;
  const I = window.I18N;

  const SCREENS = ['account', 'type', 'info', 'product', 'fulfillment', 'hours', 'review', 'done'];
  const STATE_STEPS = { product: 'product', fulfillment: 'fulfillment', hours: 'hours', review: 'review' };
  const FALLBACK_TYPES = ['restaurant', 'cafe', 'bakery', 'dessert_shop', 'home_kitchen', 'cloud_kitchen', 'other'];
  const TYPE_LABEL = { restaurant: 'bt_restaurant', cafe: 'bt_cafe', bakery: 'bt_bakery', dessert_shop: 'bt_dessert', home_kitchen: 'bt_home', cloud_kitchen: 'bt_cloud', other: 'bt_other' };
  const SIGNUP_TYPES = ['restaurant', 'cafe', 'bakery', 'dessert_shop', 'home_kitchen', 'cloud_kitchen', 'other'];

  const stepEl = document.getElementById('su-step');
  const progressEl = document.getElementById('su-progress');
  const navEl = document.getElementById('su-nav');
  const backBtn = document.getElementById('su-back');
  const nextBtn = document.getElementById('su-next');
  const errorBox = document.getElementById('su-error');

  const draft = { email: '', username: '', password: '', businessType: '', businessName: '', slug: '' };
  let business = null;
  let types = null;
  let typeMeta = null;
  let profile = null;
  let postInfoOrder = ['product', 'fulfillment', 'hours', 'review'];
  let screen = 'account';

  function hasKey(key) { return I.t(key) !== key; }

  function fail(err) {
    errorBox.textContent = (err && err.message) || 'Request failed';
    errorBox.classList.remove('hidden');
    nextBtn.disabled = false;
  }

  function field(labelKey, inner, inputId) {
    return '<div class="field"><label' + (inputId ? ' for="' + inputId + '"' : '') + '>' +
      esc(I.t(labelKey)) + '</label>' + inner + '</div>';
  }

  function input(id, type, value, attrs) {
    return '<input id="' + id + '" type="' + type + '" value="' + esc(value || '') + '" ' + (attrs || '') + '>';
  }

  function paint() {
    errorBox.classList.add('hidden');
    const idx = SCREENS.indexOf(screen);
    progressEl.textContent = screen === 'done' ? '' : I.t('su_stepOf', { n: idx + 1, total: SCREENS.length - 1 });
    navEl.style.display = screen === 'done' ? 'none' : '';
    backBtn.style.visibility = idx === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = screen === 'review' ? I.t('su_finish') : I.t('su_continue');
    document.title = I.t(screen === 'account' ? 'su_accountTitle' : screen === 'done' ? 'su_doneTitle' : 'su_stepOf', { n: idx + 1, total: SCREENS.length - 1 }) + ' — Restivo';
    if (document.activeElement && stepEl.contains(document.activeElement)) document.activeElement.blur();
    const first = stepEl.querySelector('input, select, button');
    if (first) first.focus({ preventScroll: true });
  }

  async function loadProfile() {
    try {
      profile = await api.get('/api/onboarding/profile');
      const known = ['product', 'fulfillment', 'hours', 'review'];
      const ordered = (profile.flow || []).filter((s) => known.includes(s));
      if (ordered.length === known.length) postInfoOrder = ordered;
    } catch (_) { /* generic flow stands */ }
  }

  function nextAfter(current) {
    const i = postInfoOrder.indexOf(current);
    return postInfoOrder[Math.min(i + 1, postInfoOrder.length - 1)];
  }

  async function recordStep(step) {
    if (!business || business.onboardingStatus === 'completed') return;
    try {
      const s = await api.put('/api/onboarding/state', { step });
      business.onboardingStatus = s.onboardingStatus;
      business.onboardingStep = s.onboardingStep;
    } catch (_) { /* progress is best-effort; the data itself is saved */ }
  }

  /* ------------------------------- screens ------------------------------ */

  function showAccount() {
    stepEl.innerHTML =
      '<h1>' + esc(I.t('su_accountTitle')) + '</h1>' +
      '<p class="muted small">' + esc(I.t('su_accountDesc')) + '</p>' +
      field('su_email', input('f-email', 'email', draft.email, 'autocomplete="email" required'), 'f-email') +
      field('su_username', input('f-username', 'text', draft.username, 'autocomplete="username" required'), 'f-username') +
      field('su_password', input('f-password', 'password', '', 'autocomplete="new-password" required'), 'f-password' +
        '<p class="muted small">' + esc(I.t('su_passwordHint')) + '</p>');
  }

  function showType() {
    const list = types || FALLBACK_TYPES;
    const meta = (k) => (typeMeta && typeMeta[k]) || {};
    stepEl.innerHTML =
      '<h1>' + esc(I.t('su_typeTitle')) + '</h1>' +
      '<p class="muted small">' + esc(I.t('su_typeDesc')) + '</p>' +
      '<div role="radiogroup" aria-label="' + esc(I.t('su_typeTitle')) + '">' +
      list.map((t) => {
        const m = meta(t);
        const label = I.t(m.nameKey || TYPE_LABEL[t] || t);
        const desc = m.descKey && hasKey(m.descKey) ? ' <small class="muted">' + esc(I.t(m.descKey)) + '</small>' : '';
        const icon = m.icon ? '<span aria-hidden="true">' + esc(m.icon) + '</span> ' : '';
        return '<label class="radio-card"><input type="radio" name="bt" value="' + esc(t) + '"' +
          (draft.businessType === t ? ' checked' : '') + '> ' + icon + esc(label) + desc + '</label>';
      }).join('') + '</div>';
  }

  function showInfo() {
    stepEl.innerHTML =
      '<h1>' + esc(I.t('su_infoTitle')) + '</h1>' +
      '<p class="muted small">' + esc(I.t('su_infoDesc')) + '</p>' +
      field('su_bizName', input('f-bizname', 'text', draft.businessName, 'required'), 'f-bizname') +
      field('su_slug', input('f-slug', 'text', draft.slug, 'dir="ltr"'), 'f-slug' +
        '<p class="muted small" id="slug-hint" role="status" aria-live="polite"></p>');
    const nameEl = document.getElementById('f-bizname');
    const slugEl = document.getElementById('f-slug');
    const hint = document.getElementById('slug-hint');
    const check = debounce(async () => {
      const name = nameEl.value.trim();
      const typed = slugEl.value.trim();
      if (!name && !typed) { hint.textContent = ''; return; }
      try {
        const q = typed ? 'slug=' + encodeURIComponent(typed) : 'name=' + encodeURIComponent(name);
        const r = await api.get('/api/signup/slug-availability?' + q);
        hint.textContent = r.available ? I.t('su_slugOk') : I.t('su_slugTaken') + (r.suggestion ? ': ' + r.suggestion : '');
        if (!r.available && r.suggestion && !typed) slugEl.value = r.suggestion;
      } catch (_) { hint.textContent = ''; }
    }, 400);
    nameEl.addEventListener('input', check);
    slugEl.addEventListener('input', check);
  }

  async function showProduct() {
    let cats = [];
    try {
      const r = await api.get('/api/admin/categories');
      cats = r.categories || [];
    } catch (_) { /* first run: none yet */ }
    const pLabel = profile && profile.terminology && hasKey(profile.terminology.productLabelKey)
      ? I.t(profile.terminology.productLabelKey) : I.t('su_productTitle');
    const help = profile && (profile.helpKeys || []).find((k) => hasKey(k));
    stepEl.innerHTML =
      '<h1>' + esc(pLabel) + '</h1>' +
      '<p class="muted small">' + esc(I.t('su_productDesc')) + '</p>' +
      (help ? '<p class="muted small">' + esc(I.t(help)) + '</p>' : '') +
      field('su_productName', input('f-pname', 'text', '', 'required'), 'f-pname') +
      field('su_price', input('f-price', 'number', '', 'min="0" step="0.01" required'), 'f-price') +
      field('su_category',
        '<select id="f-cat">' + cats.map((c) => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('') +
        '<option value="__new">' + esc(I.t('su_newCategory')) + '</option></select>' +
        '<div id="new-cat-wrap" class="hidden mt-1">' + input('f-catname', 'text', '', 'placeholder="' + esc(I.t('su_catName')) + '"') + '</div>', 'f-cat') +
      '<label class="radio-card"><input id="f-avail" type="checkbox" checked> ' + esc(I.t('su_available')) + '</label>' +
      field('su_image', '<input id="f-img" type="file" accept="image/jpeg,image/png,image/webp">', 'f-img') +
      '<p class="mt-1"><button id="skip-product" type="button" class="btn btn-outline">' + esc(I.t('su_skip')) + '</button></p>';
    const sel = document.getElementById('f-cat');
    sel.addEventListener('change', () => {
      document.getElementById('new-cat-wrap').classList.toggle('hidden', sel.value !== '__new');
    });
    document.getElementById('skip-product').addEventListener('click', async () => {
      await recordStep('product');
      go('fulfillment');
    });
  }

  async function showFulfillment() {
    let s = { deliveryEnabled: true, deliveryFeeCents: 0 };
    try {
      const r = await api.get('/api/admin/settings');
      if (r.settings) s = r.settings;
    } catch (_) { /* defaults stand */ }
    // Profile default applies only before the owner has chosen (fresh settings row).
    if (profile && profile.defaults && s.deliveryFeeCents === 0) {
      if (profile.defaults.fulfillment === 'pickup') s.deliveryEnabled = false;
      if (profile.defaults.fulfillment === 'delivery') s.deliveryEnabled = true;
    }
    stepEl.innerHTML =
      '<h1>' + esc(I.t('su_fulfillTitle')) + '</h1>' +
      '<p class="muted small">' + esc(I.t('su_fulfillDesc')) + '</p>' +
      '<label class="radio-card"><input type="checkbox" checked disabled> ' + esc(I.t('su_pickup')) + '</label>' +
      '<label class="radio-card"><input id="f-delivery" type="checkbox"' + (s.deliveryEnabled ? ' checked' : '') + '> ' + esc(I.t('su_delivery')) + '</label>' +
      field('su_fee', input('f-fee', 'number', String((s.deliveryFeeCents || 0) / 100), 'min="0" step="0.01"'), 'f-fee');
  }

  async function showHours() {
    let rows = Array.from({ length: 7 }, (_, day) => ({ day, closed: false, opensAt: '09:00', closesAt: '22:00' }));
    try {
      const r = await api.get('/api/admin/hours');
      if (Array.isArray(r.hours) && r.hours.length === 7) rows = r.hours;
    } catch (_) { /* defaults stand */ }
    stepEl.innerHTML =
      '<h1>' + esc(I.t('su_hoursTitle')) + '</h1>' +
      '<p class="muted small">' + esc(I.t('su_hoursDesc')) + '</p>' +
      (profile && profile.defaults && hasKey(profile.defaults.hoursHintKey)
        ? '<p class="muted small">' + esc(I.t(profile.defaults.hoursHintKey)) + '</p>' : '') +
      rows.map((r) =>
        '<div class="field"><label>' + esc(I.t('day_' + r.day)) + '</label>' +
        '<div class="flex-between"><label class="radio-card"><input type="checkbox" data-day="' + r.day + '" class="h-closed"' +
        (r.closed ? ' checked' : '') + '> ' + esc(I.t('su_closed')) + '</label>' +
        '<span><small>' + esc(I.t('su_opens')) + '</small> <input type="time" class="h-open" data-day="' + r.day + '" value="' + esc(r.opensAt) + '"></span>' +
        '<span><small>' + esc(I.t('su_closes')) + '</small> <input type="time" class="h-close" data-day="' + r.day + '" value="' + esc(r.closesAt) + '"></span></div></div>'
      ).join('');
  }

  async function showReview() {
    let summary = '';
    try {
      const st = await api.get('/api/onboarding/state');
      const menu = await api.get('/api/restaurants/' + encodeURIComponent(st.business.slug) + '/menu');
      const items = (menu.items || []).slice(0, 5).map((i) => esc(i.name)).join(', ') || '—';
      summary = '<div class="card"><p><strong>' + esc(st.business.name) + '</strong><br><span class="muted small" dir="ltr">/restaurant/' +
        esc(st.business.slug) + '</span></p><p class="muted small">' + items + '</p></div>';
    } catch (_) { summary = ''; }
    stepEl.innerHTML =
      '<h1>' + esc(I.t('su_reviewTitle')) + '</h1>' +
      '<p class="muted small">' + esc(I.t('su_reviewDesc')) + '</p>' + summary;
  }

  async function showDone(payload) {
    navEl.style.display = 'none';
    progressEl.textContent = '';
    let qrImg = '';
    try {
      const qr = await api.get('/api/admin/qr');
      qrImg = '<img src="data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(qr.svg))) +
        '" alt="QR" width="220" height="220">';
    } catch (_) { /* QR is a bonus, never a blocker */ }
    const url = payload.storefrontUrl;
    stepEl.innerHTML =
      '<h1>' + esc(I.t('su_doneTitle')) + '</h1>' +
      '<p class="muted small">' + esc(I.t('su_doneDesc')) + '</p>' + qrImg +
      '<p class="mt-2"><a class="btn btn-primary" href="' + esc(url) + '">' + esc(I.t('su_openStore')) + '</a> ' +
      '<a class="btn btn-outline" href="/admin.html">' + esc(I.t('su_goDashboard')) + '</a></p>' +
      '<p><button id="share-btn" type="button" class="btn btn-outline">' + esc(I.t('su_shareStore')) + '</button></p>';
    document.getElementById('share-btn').addEventListener('click', () => {
      const abs = location.origin + url;
      if (navigator.share) navigator.share({ title: document.title, url: abs }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(abs).then(() => window.App.toast(I.t('su_linkCopied'), 'success'), () => {});
    });
  }

  /* ------------------------------ transitions ----------------------------- */

  async function go(next) {
    screen = next;
    errorBox.classList.add('hidden');
    nextBtn.disabled = false;
    if (next === 'account') showAccount();
    else if (next === 'type') showType();
    else if (next === 'info') showInfo();
    else if (next === 'product') await showProduct();
    else if (next === 'fulfillment') await showFulfillment();
    else if (next === 'hours') await showHours();
    else if (next === 'review') await showReview();
    paint();
  }

  async function submit() {
    errorBox.classList.add('hidden');
    nextBtn.disabled = true;
    try {
      if (screen === 'account') {
        draft.email = document.getElementById('f-email').value.trim();
        draft.username = document.getElementById('f-username').value.trim();
        draft.password = document.getElementById('f-password').value;
        if (!draft.email || !draft.username || !draft.password) throw new Error(I.t('su_accountDesc'));
        await go('type');
      } else if (screen === 'type') {
        const picked = stepEl.querySelector('input[name="bt"]:checked');
        if (!picked) throw new Error(I.t('su_typeDesc'));
        draft.businessType = picked.value;
        await go('info');
      } else if (screen === 'info') {
        draft.businessName = document.getElementById('f-bizname').value.trim();
        draft.slug = document.getElementById('f-slug').value.trim();
        if (draft.businessName.length < 2) throw new Error(I.t('su_bizName'));
        const res = await api.post('/api/signup', {
          email: draft.email, username: draft.username, password: draft.password,
          businessName: draft.businessName, businessType: draft.businessType,
          ...(draft.slug ? { slug: draft.slug } : {}),
        });
        business = { ...res.business, slug: res.business.slug };
        draft.password = '';
        await loadProfile();
        await recordStep('info');
        await go('product');
      } else if (screen === 'product') {
        await saveProduct();
        await recordStep('product');
        await go(nextAfter('product'));
      } else if (screen === 'fulfillment') {
        const delivery = document.getElementById('f-delivery').checked;
        const fee = Math.max(0, Math.round(parseFloat(document.getElementById('f-fee').value || '0') * 100));
        await api.patch('/api/admin/settings', { deliveryEnabled: delivery, deliveryFeeCents: fee });
        await recordStep('fulfillment');
        await go(nextAfter('fulfillment'));
      } else if (screen === 'hours') {
        const rows = Array.from({ length: 7 }, (_, day) => ({
          day,
          closed: stepEl.querySelector('.h-closed[data-day="' + day + '"]').checked,
          opensAt: stepEl.querySelector('.h-open[data-day="' + day + '"]').value || '09:00',
          closesAt: stepEl.querySelector('.h-close[data-day="' + day + '"]').value || '22:00',
        }));
        await api.put('/api/admin/hours', { hours: rows });
        await recordStep('hours');
        await go(nextAfter('hours'));
      } else if (screen === 'review') {
        await recordStep('review');
        const payload = await api.post('/api/onboarding/complete', {});
        business.onboardingStatus = 'completed';
        screen = 'done';
        await showDone(payload);
        paint();
      }
    } catch (err) {
      fail(err);
    }
  }

  async function saveProduct() {
    const name = document.getElementById('f-pname').value.trim();
    const price = parseFloat(document.getElementById('f-price').value);
    if (!name || !(price >= 0)) throw new Error(I.t('su_productDesc'));
    let categoryId = document.getElementById('f-cat').value;
    if (categoryId === '__new') {
      const catName = document.getElementById('f-catname').value.trim() || name;
      const created = await api.post('/api/admin/categories', { name: catName });
      categoryId = created.category.id;
    }
    const item = await api.post('/api/admin/items', {
      categoryId,
      name,
      priceCents: Math.round(price * 100),
      isAvailable: document.getElementById('f-avail').checked,
    });
    const file = document.getElementById('f-img').files[0];
    if (file) {
      const form = new FormData();
      form.append('image', file);
      try {
        await window.App.api.uploadWithProgress('/api/admin/images?type=items&itemId=' + encodeURIComponent(item.item.id), form);
      } catch (_) {
        // Photo is optional; the item itself is saved — say so plainly.
        window.App.toast(I.t('su_imgFail'), 'error');
      }
    }
  }

  backBtn.addEventListener('click', () => {
    const idx = SCREENS.indexOf(screen);
    if (idx > 0) go(SCREENS[idx - 1]);
  });
  nextBtn.addEventListener('click', submit);

  /* --------------------------------- boot --------------------------------- */

  (async function boot() {
    try {
      const t = await api.get('/api/business-types');
      if (t && Array.isArray(t.types)) {
        typeMeta = {};
        const keys = [];
        for (const x of t.types) {
          if (SIGNUP_TYPES.includes(x.key)) {
            keys.push(x.key);
            typeMeta[x.key] = x;
          }
        }
        if (keys.length) types = keys;
      }
    } catch (_) { /* US1 fallback list stands */ }
    try {
      const me = await api.get('/api/auth/me');
      if (me.user && me.user.restaurantId) {
        const st = await api.get('/api/onboarding/state');
        business = st.business;
        if (st.onboardingStatus === 'completed') {
          location.replace('/admin.html');
          return;
        }
        await loadProfile();
        // Resume at the next incomplete step.
        const order = postInfoOrder;
        const nextIdx = Math.min(order.indexOf(st.onboardingStep) + 1, order.length - 1);
        await go(st.onboardingStep === 'done' ? 'review' : order[Math.max(0, nextIdx)] || 'product');
        if (window.App.toast && st.next && st.next.length) window.App.toast(I.t('su_resume', { n: st.next.length }), 'info');
        return;
      }
    } catch (_) { /* fresh visitor: start at account */ }
    await go('account');
  })();

  if (window.I18N && window.I18N.onChange) window.I18N.onChange(() => {
    // Keep typed values across the language re-render.
    const stash = (id, key) => {
      const el = document.getElementById(id);
      if (el) draft[key] = el.value;
    };
    stash('f-email', 'email');
    stash('f-username', 'username');
    stash('f-bizname', 'businessName');
    stash('f-slug', 'slug');
    const picked = stepEl.querySelector('input[name="bt"]:checked');
    if (picked) draft.businessType = picked.value;
    go(screen);
  });
})();
