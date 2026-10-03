'use strict';

/**
 * Real storefront in the Restivo design language (same look as the landing
 * live-demo, backed by live API data). SERVER computes all totals.
 */

(function () {
  const { api, esc, fmtMoney, qsParam, toast, theme } = window.App;
  const FOOD = '/images/restivo-food-table.jpg';

  /* ------------------------- resolve slug -------------------------- */
  let slug = qsParam('r');
  if (!slug && location.pathname.startsWith('/restaurant/')) {
    slug = decodeURIComponent(location.pathname.split('/')[2] || '');
  }
  slug = (slug || '').toLowerCase();

  /* --------------------------- language ---------------------------- */
  const T = {
    ar: {
      open: 'مفتوح الآن', closed: 'مغلق حاليًا', share: 'شارك القائمة', book: 'احجز طاولة',
      menuEye: 'قائمتنا', menuTitle: 'تصفّح أطباقنا واختر ما تشتهي',
      search: 'ابحث عن طبقك المفضل...', all: 'كل القائمة', popular: 'الأكثر طلبًا',
      featured: 'أطباق نوصي بها', full: 'القائمة كاملة', add: 'أضف للطلب',
      cart: 'طلبك', items: 'أصناف', total: 'الإجمالي', subtotal: 'المجموع الفرعي',
      deliveryFee: 'رسوم التوصيل', pickup: 'استلام', delivery: 'توصيل',
      deliveryBy: 'التوصيل بواسطة', sendWA: 'أكمل طلبك عبر واتساب', sendSite: 'تأكيد الطلب',
      ready: 'طلبك جاهز للإرسال', sentHint: 'يفتح واتساب لتختار جهة الاتصال وترسل طلبك.',
      yourName: 'الاسم', waNumber: 'رقم الواتساب', phoneOpt: 'رقم الهاتف (اختياري)',
      addrDelivery: 'عنوان التوصيل', addrOpt: 'العنوان (اختياري)', notesOpt: 'ملاحظات (اختياري)',
      keepBrowsing: 'مواصلة التصفح', cartEmpty: 'سلتك فارغة', cartEmptyHint: 'تصفح القائمة وأضف ما يعجبك.',
      placedHead: 'تم استلام طلبك', showCode: 'أظهر هذا الرمز عند الاستلام أو تتبع طلبك به:',
      trackMyOrder: 'تتبع طلبي', done: 'حسنًا', linkCopied: 'تم نسخ رابط المنيو',
      reorderAdjusted: 'بعض الأصناف تغيّرت أو لم تعد متوفرة — راجع سلتك قبل التأكيد.',
      orderSummary: 'ملخص الطلب',
      nextSteps: 'احتفظ بهذا الرمز. سنبدأ بتجهيز طلبك فورًا ويمكنك تتبع حالته في أي وقت.',
      enterNameAndWa: 'الرجاء إدخال الاسم ورقم الواتساب', addrRequired: 'الرجاء إدخال عنوان التوصيل',
      noWA: 'الواتساب غير متوفر لهذا المطعم', closedNotice: 'المطعم مغلق حاليًا — يمكنك التصفح وإتمام الطلب عند الافتتاح.',
      subStoreExpired: 'الطلبات متوقفة مؤقتًا — يمكنك تصفح القائمة.',
      subStoreSuspended: 'المتجر غير متاح حاليًا — يمكنك تصفح القائمة.',
      noMatch: 'لا توجد أصناف مطابقة.', menuEmpty: 'لا توجد أصناف متاحة حاليًا.',
      soldOut: 'نفد', top: '★ مميز', bookTitle: 'احجز طاولة', bookDesc: 'أخبرنا بتفاصيل زيارتك وسنؤكد حجزك.',
      bkName: 'الاسم', bkWA: 'واتساب', bkPhone: 'هاتف (اختياري)', bkTables: 'عدد الطاولات',
      bkDate: 'التاريخ', bkTime: 'الوقت', bkNotes: 'ملاحظات', bookNow: 'تأكيد الحجز',
      bookingCreated: 'تم إرسال طلب الحجز', close: 'إغلاق', currencies: 'ر.س',
      optRequired: 'مطلوب', optNeedMore: 'أكمل الاختيارات المطلوبة قبل الإضافة',
      optOptional: 'اختياري', optChoose: 'اختر',
      freeShipMore: 'أضف بقيمة {x} لتحصل على توصيل مجاني', freeShipUnlocked: 'رائع! التوصيل مجاني لطلبك',
      free: 'مجاني', searchLabel: 'بحث', langName: 'العربية',
      preorderBadge: 'طلب مسبق',
    },
    en: {
      open: 'Open now', closed: 'Currently closed', share: 'Share menu', book: 'Book a table',
      menuEye: 'THE MENU', menuTitle: 'Explore the menu and find your favorite',
      search: 'Search for a dish...', all: 'Full menu', popular: 'Most ordered',
      featured: 'Guest favorites', full: 'The full menu', add: 'Add to order',
      cart: 'Your order', items: 'items', total: 'Total', subtotal: 'Subtotal',
      deliveryFee: 'Delivery fee', pickup: 'Pickup', delivery: 'Delivery',
      deliveryBy: 'Delivered by', sendWA: 'Continue in WhatsApp', sendSite: 'Place order',
      ready: 'Your order is ready to send', sentHint: 'WhatsApp will open so you can choose where to send it.',
      yourName: 'Name', waNumber: 'WhatsApp number', phoneOpt: 'Phone (optional)',
      addrDelivery: 'Delivery address', addrOpt: 'Address (optional)', notesOpt: 'Notes (optional)',
      keepBrowsing: 'Keep browsing', cartEmpty: 'Your cart is empty', cartEmptyHint: 'Browse the menu and add what you like.',
      placedHead: 'Order received', showCode: 'Show this code at pickup or use it to track your order:',
      trackMyOrder: 'Track my order', done: 'Done', linkCopied: 'Menu link copied',
      reorderAdjusted: 'Some items changed or are no longer available — review your cart before confirming.',
      orderSummary: 'Order summary',
      nextSteps: 'Keep this code. We will start preparing your order right away and you can track its status anytime.',
      enterNameAndWa: 'Please enter your name and WhatsApp number', addrRequired: 'Please enter the delivery address',
      noWA: 'WhatsApp is not available for this restaurant', closedNotice: 'The restaurant is currently closed — feel free to browse.',
      subStoreExpired: 'Ordering is paused for now — feel free to browse the menu.',
      subStoreSuspended: 'This store is currently unavailable — feel free to browse the menu.',
      noMatch: 'No dishes match your search.', menuEmpty: 'No items available right now.',
      soldOut: 'Sold out', top: '★ Top', bookTitle: 'Book a table', bookDesc: 'Tell us about your visit and we will confirm.',
      bkName: 'Name', bkWA: 'WhatsApp', bkPhone: 'Phone (optional)', bkTables: 'Tables',
      bkDate: 'Date', bkTime: 'Time', bkNotes: 'Notes', bookNow: 'Confirm booking',
      bookingCreated: 'Booking request sent', close: 'Close', currencies: '',
      optRequired: 'Required', optNeedMore: 'Please complete the required choices first',
      optOptional: 'Optional', optChoose: 'Choose',
      freeShipMore: 'Add {x} more for free delivery', freeShipUnlocked: 'Free delivery unlocked',
      free: 'Free', searchLabel: 'Search', langName: 'English',
      preorderBadge: 'Pre-order',
    },
  };
  let lang = 'ar';
  try { lang = localStorage.getItem('restivo-lang') || 'ar'; } catch (_) { /* ignore */ }
  if (lang !== 'ar' && lang !== 'en') lang = 'ar';
  const t = () => T[lang];

  function setLang(next) {
    lang = next;
    try { localStorage.setItem('restivo-lang', lang); } catch (_) { /* ignore */ }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    renderAll();
    if (view) document.title = (lang === 'en' && view.settings.nameEn) ? view.settings.nameEn : view.name;
  }

  /* ----------------------------- state ----------------------------- */
  const CART_KEY = 'cart_' + slug;
  let view = null;
  let cart = loadCart();
  let orderType = loadOrderType();
  let activeCategory = 'all';
  let searchTerm = '';
  let cartOpen = false;
  let sent = false;
  let bookingOpen = false;
  let co = { name: '', wa: '', phone: '', address: '', notes: '' };

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
      const clean = {};
      for (const [k, v] of Object.entries(raw)) {
        if (Number.isInteger(v) && v > 0 && v <= 99) clean[k] = v;
        else if (v && Number.isInteger(v.qty) && v.qty > 0 && v.qty <= 99 && Array.isArray(v.selections)) {
          clean[k] = { qty: v.qty, selections: v.selections };
        }
      }
      return clean;
    } catch (_) { return {}; }
  }
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (_) {} }
  function loadOrderType() {
    try { return localStorage.getItem('ordertype_' + slug) || 'pickup'; } catch (_) { return 'pickup'; }
  }

  if (!slug) {
    document.getElementById('live-content').innerHTML =
      '<div class="live-alert error">Restaurant not found</div>';
    return;
  }

  /* --------------------------- derived ----------------------------- */
  const money = (cents) => fmtMoney(cents, (view && view.settings && view.settings.currency) || 'USD', lang);
  // Pending option picks per item (card pickers only; server re-validates all).
  const picks = {};
  const pickMap = (itemId) => picks[itemId] || (picks[itemId] = {});
  // Display-only unit estimate from definitions (server computes truth).
  function estimateUnit(item, sels) {
    let unit = item.price_cents;
    const groups = {};
    for (const g of (item.options || [])) groups[g.id] = g;
    for (const sel of (sels || [])) {
      const g = groups[sel.groupId];
      if (!g) continue;
      if (g.pricing === 'replace' && sel.choices.length) {
        const c = (g.choices || []).find((x) => x.id === sel.choices[0].choiceId);
        if (c) unit = c.price_cents;
      } else {
        for (const line of sel.choices) {
          const c = (g.choices || []).find((x) => x.id === line.choiceId);
          if (c) unit += c.price_cents * line.quantity;
        }
      }
    }
    return unit;
  }
  const normSels = (sels) => (sels || []).map((s) => ({
    groupId: s.groupId,
    choices: (s.choices || []).map((c) => ({ choiceId: c.choiceId, quantity: c.quantity })),
  }));
  function cartEntries() {
    if (!view) return [];
    return Object.entries(cart)
      .map(([key, v]) => {
        const legacyQty = Number.isInteger(v) ? v : 0;
        const itemId = legacyQty ? key : key.split('#')[0];
        const item = view.items.find((i) => i.id === itemId);
        if (!item || !item.is_available) return null;
        const qty = legacyQty || (v.qty || 0);
        if (!qty) return null;
        return { key, item, qty, selections: legacyQty ? [] : normSels(v.selections) };
      })
      .filter(Boolean);
  }
  const subtotalCents = () => cartEntries().reduce((s, e) => s + estimateUnit(e.item, e.selections) * e.qty, 0);
  // Display-only fee mirror (server recomputes authoritatively at checkout).
  const feeCents = () => {
    if (orderType !== 'delivery') return 0;
    const s = (view && view.settings) || {};
    if (s.freeDeliveryEnabled === true && subtotalCents() >= Number(s.freeDeliveryThresholdCents || 0)) return 0;
    return Number(s.deliveryFeeCents || 0);
  };
  const totalUnits = () => cartEntries().reduce((s, e) => s + e.qty, 0);
  // D4: delivery availability is the restaurant's own setting toggle, not company linkage.
  const hasDelivery = () => !view || !view.settings || view.settings.deliveryEnabled !== false;

  /* ---------------------------- render ----------------------------- */
  const $head = () => document.getElementById('live-head');
  const $content = () => document.getElementById('live-content');
  const $bar = () => document.getElementById('live-cart-btn');
  const $overlay = () => document.getElementById('cart-root');

  function renderAll() {
    if (!view) return;
    if (!hasDelivery()) orderType = 'pickup';
    renderHead();
    renderContent();
    renderBar();
    renderOverlay();
  }

  function renderHead() {
    const other = lang === 'ar' ? 'en' : 'ar';
    const flag = other === 'ar' ? '🇸🇦' : '🇺🇸';
    const fulfillment = hasDelivery()
      ? '<div class="mode-seg" role="group" aria-label="' + esc(t().delivery) + '/' + esc(t().pickup) + '">' +
        '<button data-mode="delivery"' + (orderType === 'delivery' ? ' class="active" aria-pressed="true"' : ' aria-pressed="false"') + '>' + esc(t().delivery) + '</button>' +
        '<button data-mode="pickup"' + (orderType === 'pickup' ? ' class="active" aria-pressed="true"' : ' aria-pressed="false"') + '>' + esc(t().pickup) + '</button></div>'
      : '';
    // Language pinned to the far end; search + fulfilment pinned opposite.
    // `margin-inline-start:auto` on the group keeps them at the edges in
    // both RTL and LTR without duplicating direction-specific CSS.
    $head().innerHTML =
      '<div class="topbar">' +
      '<button class="lang-seg" id="lang-btn" aria-label="Language / اللغة"><span aria-hidden="true">' + flag + '</span> ' + esc(T[other].langName) + '</button>' +
      '<div class="topbar-actions">' +
      '<button class="search-toggle" id="search-toggle" aria-label="' + esc(t().searchLabel) + '" aria-expanded="false">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>' +
      fulfillment +
      '</div></div>';
    document.getElementById('lang-btn').addEventListener('click', () => setLang(other));
    document.getElementById('search-toggle').addEventListener('click', () => {
      const bar = document.getElementById('searchbar');
      const open = bar.classList.toggle('open');
      document.getElementById('search-toggle').setAttribute('aria-expanded', String(open));
      const input = document.getElementById('menu-search');
      if (open) input.focus();
      else if (input.value) { input.value = ''; searchTerm = ''; updateGrids(); }
    });
    $head().querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setOrderType(b.dataset.mode)));
  }

  function setOrderType(next) {
    if (next !== 'delivery' && next !== 'pickup') return;
    if (next === 'delivery' && !hasDelivery()) next = 'pickup';
    if (orderType === next) return;
    orderType = next;
    try { localStorage.setItem('ordertype_' + slug, orderType); } catch (_) {}
    renderHead();
    renderBar();
    if (cartOpen) renderOverlay();
  }

  /* Restaurant brand colors: logo tile (primary) + cover tint (secondary).
     Design chrome stays fixed — these are identity slots only. */
  function brand() {
    const s = (view && view.settings) || {};
    const out = { logoBg: null, logoFg: '#fff9ed', tint: null };
    if (/^#[0-9a-f]{6}$/i.test(s.primaryColor || '')) {
      out.logoBg = s.primaryColor;
      try { out.logoFg = theme.buildTokens(s.primaryColor, '#000000')['--on-primary']; } catch (_) { /* keep default */ }
    }
    if (/^#[0-9a-f]{6}$/i.test(s.secondaryColor || '')) {
      const rgb = theme.hexToRgb(s.secondaryColor);
      if (rgb) out.tint = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.28)';
    }
    return out;
  }

/* Category iconography: a curated inline SVG set drawn in the brand colour.
     Emoji read as cheap buttons at this size; these inherit `color` from CSS so
     they follow the active/brand state with no extra rules. Same keyword match
     as before — only the glyph changed. Decorative aid only. */
  const ICONS = {
    burger: '<path d="M4 9h16M5 13h14M6 17h12" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/><path d="M4 9a8 4 0 0 1 16 0" fill="currentColor" opacity=".28"/>',
    pizza: '<path d="M12 3 21 19H3L12 3Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="10" cy="13" r="1.6" fill="currentColor"/><circle cx="14.5" cy="16" r="1.4" fill="currentColor"/>',
    fries: '<path d="M8 9h8l-1.2 11H9.2L8 9Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M10 9V4m4 5V4m-2 5V5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/>',
    drink: '<path d="M7 6h10l-1.4 13a2 2 0 0 1-2 1.8h-3.2a2 2 0 0 1-2-1.8L7 6Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M6.5 10h11" stroke="currentColor" stroke-width="1.9"/>',
    coffee: '<path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M16 11h2a2.4 2.4 0 0 1 0 5h-2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M8 3v2.5M12 3v2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    tea: '<path d="M5 10h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-6Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M17 12h1.6a2 2 0 0 1 0 4H17" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M9 6.5c1.6-1 1.6-2 0-3M12.5 6.5c1.6-1 1.6-2 0-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
    dessert: '<path d="M5 11h14l-1.6 8a2 2 0 0 1-2 1.6H8.6a2 2 0 0 1-2-1.6L5 11Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 11V6m0 0a3 3 0 0 0 3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    ice: '<path d="M12 4a2 2 0 1 1 2 2h-4a2 2 0 1 1 2-2Zm0 0v13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/><path d="M8 20h8l-4-3-4 3Z" fill="currentColor" opacity=".28"/>',
    chicken: '<path d="M17 5c2.2 0 3.5 1.8 3.5 4S19 14 15 14c-3 0-4-1.4-4-3.2C11 8.3 13 5 17 5Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M11 11 4 18m6-4-2 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    wrap: '<path d="M3 8h18v4a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M3 8 21 17M8 8.4l11 7.6" stroke="currentColor" stroke-width="1.6" opacity=".45" fill="none"/>',
    salad: '<path d="M3.5 12h17a8.5 8.5 0 0 1-17 0Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 12c0-3 2-5 4.5-5M13 8.5c2 .6 3 2 3 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
    breakfast: '<circle cx="12" cy="13" r="7" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="13" r="3" fill="currentColor" opacity=".3"/><path d="M8 3v4m8-4v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    fish: '<path d="M3 12c3.5-4.5 7-6.5 11-6.5S20 9 21 12c-1 3-4 4.5-7 4.5S6.5 14.5 3 12Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M17 10.5 21 7v10l-4-3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="8" cy="11" r="1.1" fill="currentColor"/>',
    soup: '<path d="M4 11h16v3.5A5.5 5.5 0 0 1 14.5 20h-5A5.5 5.5 0 0 1 4 14.5V11Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 7.5c1.5-1.4.5-2.4 0-3.5M13 7.5c1.5-1.4.5-2.4 0-3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
    bread: '<path d="M4 14c0-4 3.6-7 8-7s8 3 8 7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8.5 10.5h7M8.5 13.5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>',
    pasta: '<path d="M5 7c3 0 3 3 6 3s3-3 6-3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M4 12c3 0 3 3 6 3s3-3 6-3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M4 17c3 0 3 3 6 3s3-3 6-3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    meat: '<path d="M4.5 12.5c0-3.6 3.6-6.5 8-6.5s7 2.6 7 6.5c0 3-2.5 5-6 5H10c-3 0-5.5-2-5.5-5Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity=".26"/><path d="M19.5 12.5 22 15" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    all: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 3.5v17M3.5 12h17" stroke="currentColor" stroke-width="1.6" opacity=".5"/>',
    star: '<path d="m12 4 2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 17.1 6.8 20l1.2-5.9-4.4-4 5.9-.7L12 4Z" fill="currentColor" opacity=".3"/><path d="m12 4 2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 17.1 6.8 20l1.2-5.9-4.4-4 5.9-.7L12 4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  };
  function icon(name, key) {
    return '<svg class="cat-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
      + (ICONS[key] || '') + '</svg>';
  }
  const CAT_ICON = [
    [/burger|برجر|همبرجر/, 'burger'], [/pizza|بيتزا/, 'pizza'], [/fries|بطاط|مقبلات|appetizer|side|جوانب/, 'fries'],
    [/drink|مشروب|عصير|juice|صودا|soda|ميلك|milkshake/, 'drink'], [/coffee|قهوة|espresso|لاتيه|latte|كابتشينو/, 'coffee'],
    [/tea|شاي/, 'tea'], [/dessert|حلويات|كيك|cake|كنافة|بقلاوة|baklava|sweet/, 'dessert'],
    [/ice|بوظة|آيس|gelato/, 'ice'], [/chicken|دجاج|broast|بروستد/, 'chicken'],
    [/shawarma|شاورما|wrap|لفائف|ساندويش|sandwich/, 'wrap'], [/salad|سلطة|تبولة|فتوش/, 'salad'],
    [/breakfast|فطور|صباح|فول|فلافل|falafel/, 'breakfast'], [/fish|سمك|seafood|مأكولات بحرية|جمبري/, 'fish'],
    [/soup|شوربة/, 'soup'], [/bread|خبز|منقوشة|manoushe/, 'bread'], [/pasta|باستا|معكرونة/, 'pasta'],
    [/meat|لحم|ستيك|steak|مشاوي|grill|كباب/, 'meat'],
  ];
  function catIcon(name) {
    const n = String(name || '').toLowerCase();
    for (const [re, key] of CAT_ICON) if (re.test(n)) return icon(name, key);
    return icon(name, 'all');
  }

  /* Client-side fee mirror for display only — the server recomputes authoritatively. */
  const freeShipOn = () => {
    const s = (view && view.settings) || {};
    return orderType === 'delivery' && s.freeDeliveryEnabled === true &&
      subtotalCents() >= Number(s.freeDeliveryThresholdCents || 0);
  };
  function freeShipMsg() {
    const s = (view && view.settings) || {};
    if (orderType !== 'delivery' || s.freeDeliveryEnabled !== true) return '';
    if (freeShipOn()) return '<p class="freeship unlocked" role="status">🎉 ' + esc(t().freeShipUnlocked) + '</p>';
    const need = Number(s.freeDeliveryThresholdCents || 0) - subtotalCents();
    if (need <= 0) return '';
    return '<p class="freeship" role="status">' + esc(t().freeShipMore.replace('{x}', money(need))) + '</p>';
  }

  function renderContent() {
    const s = view.settings || {};
    const nm = (lang === 'en' && s.nameEn) ? s.nameEn : view.name;
    const letter = (nm || '?').trim().charAt(0);
    const b = brand();
    const logoStyle = b.logoBg ? ' style="background:' + esc(b.logoBg) + ';color:' + esc(b.logoFg) + '"' : '';
    const logo = s.logoPath
      ? '<img class="id-logo-img" src="' + esc(s.logoPath) + '" alt="">'
      : '<span class="id-logo"' + logoStyle + '>' + esc(letter) + '</span>';
    const cover = s.coverPath || FOOD;
    const addr = s.address ? '<span>' + esc(s.address) + '</span>' : '';
    const phone = s.phone ? '<span><a href="tel:' + esc(s.phone.replace(/[^+\d]/g, '')) + '">' + esc(s.phone) + '</a></span>' : '';
    const waDigits = (s.whatsapp || '').replace(/\D/g, '');
    const wa = waDigits ? '<span><a href="https://wa.me/' + esc(waDigits) + '" target="_blank" rel="noopener">WhatsApp</a></span>' : '';
    const del = hasDelivery() && view.deliveryGroups.length
      ? '<span>' + esc(t().deliveryBy + ': ' + view.deliveryGroups.join(lang === 'ar' ? '، ' : ', ')) + '</span>' : '';
    const cats = [{ id: 'all', name: t().all }, { id: 'popular', name: t().popular }]
      .concat(view.categories.map((c) => ({ id: c.id, name: c.name })));

    const heroImgs = (view.heroImages && view.heroImages.length)
      ? view.heroImages.map((h) => h.imagePath)
      : [cover];
    const heroInner = heroImgs.length > 1
      ? '<div class="hero-carousel" id="hero-carousel">' + heroImgs.map((src, i) =>
          '<img class="hero-slide' + (i === 0 ? ' active' : '') + '" src="' + esc(src) + '" alt=""' + (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + ' width="1920" height="1080">'
        ).join('') +
        '<button class="hero-nav hero-prev" id="hero-prev" aria-label="Previous">‹</button>' +
        '<button class="hero-nav hero-next" id="hero-next" aria-label="Next">›</button>' +
        '<div class="hero-dots">' + heroImgs.map((_, i) =>
          '<button class="hero-dot' + (i === 0 ? ' active' : '') + '" data-hero="' + i + '" aria-label="Slide ' + (i + 1) + '"></button>'
        ).join('') + '</div></div>'
      : '<img src="' + esc(heroImgs[0]) + '" alt="" width="1920" height="1080" fetchpriority="high">';

    $content().innerHTML =
      '<section class="live-hero">' + heroInner +
        (brand().tint ? '<div class="live-hero-tint" style="background:' + esc(brand().tint) + '"></div>' : '') +
        '<div class="live-hero-content"><div class="live-hero-top">' +
          '<span class="status' + (view.openNow ? '' : ' closed') + '"><i></i>' + esc(view.openNow ? t().open : t().closed) + '</span>' +
          '<span style="display:flex;gap:8px"><button class="outline-btn hero-btn" id="share-btn">' + esc(t().share) + '</button>' +
          '<button class="outline-btn hero-btn" id="book-btn"' + (view.orderingBlocked ? ' disabled' : '') + '>' + esc(t().book) + '</button></span>' +
        '</div></div></section>' +
      '<section class="id-card" aria-label="' + esc(nm) + '">' + logo +
        '<div class="id-main"><h1>' + esc(nm) + '</h1>' +
        (s.description ? '<p>' + esc(s.description) + '</p>' : '') +
        '<div class="live-meta">' + addr + phone + wa + del + '</div></div></section>' +
      (!view.openNow ? '<div class="live-alert warn">' + esc(t().closedNotice) + '</div>' : '') +
      (view.orderingBlocked ? '<div class="live-alert warn" role="status">' + esc(t()[view.noticeKey === 'sub_store_suspended' ? 'subStoreSuspended' : 'subStoreExpired']) + '</div>' : '') +
      '<div class="searchbar" id="searchbar"><label class="search">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
        '<input id="menu-search" maxlength="60" aria-label="' + esc(t().search) + '" value="' + esc(searchTerm) + '" placeholder="' + esc(t().search) + '"></label></div>' +
      '<nav class="cat-nav" aria-label="' + esc(t().all) + '"><div class="cat-track">' + cats.map((c) =>
        '<button class="cat' + (c.id === activeCategory ? ' active' : '') + '" aria-pressed="' + (c.id === activeCategory) + '" data-cat="' + esc(c.id) + '">' +
        '<span class="cat-circle">' + (c.id === 'all' ? catIcon('') : c.id === 'popular' ? icon('', 'star') : catIcon(c.name)) + '</span>' +
        '<span class="cat-name">' + esc(c.name) + '</span></button>'
      ).join('') + '</div></nav>' +
      '<div id="dish-zone"></div>';

    document.getElementById('share-btn').addEventListener('click', sharePage);
    document.getElementById('book-btn').addEventListener('click', () => { bookingOpen = true; cartOpen = false; renderOverlay(); });
    document.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      activeCategory = b.dataset.cat;
      document.querySelectorAll('[data-cat]').forEach((x) => {
        const on = x === b;
        x.classList.toggle('active', on);
        x.setAttribute('aria-pressed', String(on));
      });
      updateGrids();
      const sec = document.querySelector('[data-section="' + b.dataset.cat + '"]') || document.getElementById('dish-zone');
      if (sec) { try { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {} }
    }));
    document.getElementById('menu-search').addEventListener('input', (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      updateGrids();
    });
    initHeroCarousel(heroImgs.length);
    updateGrids();
  }

  function initHeroCarousel(count) {
    const root = document.getElementById('hero-carousel');
    if (!root || count < 2) return;
    const slides = root.querySelectorAll('.hero-slide');
    const dots = root.querySelectorAll('.hero-dot');
    let idx = 0;
    let timer = null;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function show(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('active', k === idx));
      dots.forEach((d, k) => d.classList.toggle('active', k === idx));
    }
    function play() {
      if (reduced) return;
      stop();
      timer = setInterval(() => show(idx + 1), 5000);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    document.getElementById('hero-prev').addEventListener('click', () => { show(idx - 1); play(); });
    document.getElementById('hero-next').addEventListener('click', () => { show(idx + 1); play(); });
    dots.forEach((d) => d.addEventListener('click', () => { show(Number(d.dataset.hero)); play(); }));
    let touchX = null;
    root.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; stop(); }, { passive: true });
    root.addEventListener('touchend', (e) => {
      if (touchX !== null) {
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
      }
      touchX = null; play();
    });
    root.addEventListener('pointerenter', stop);
    root.addEventListener('pointerleave', play);
    play();
  }

  function updateGrids() {
    const zone = document.getElementById('dish-zone');
    if (!zone || !view) return;
    if (view.items.length === 0) {
      zone.innerHTML = '<div class="live-alert warn">' + esc(t().menuEmpty) + '</div>';
      return;
    }
    const matches = (item) => {
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm) &&
          !(item.description || '').toLowerCase().includes(searchTerm)) return false;
      return true;
    };
    const inCat = (item, id) => {
      if (id === 'all') return true;
      if (id === 'popular') return !!item.is_popular;
      return item.category_id === id;
    };
    const section = (id, title, items) => {
      const cards = items.filter(matches).map(dishCard).join('') ||
        '<div class="empty-results">' + esc(t().noMatch) + '</div>';
      const n = items.filter(matches).length;
      return '<section class="menu-section" data-section="' + esc(id) + '"><div class="section-head"><h2>' +
        esc(title) + '</h2><span class="section-count">' + String(n).padStart(2, '0') + '</span></div>' +
        '<div class="dish-zone-wrap">' + cards + '</div></section>';
    };
    let html = '';
    if (activeCategory === 'all' && !searchTerm) {
      const featured = view.items.filter((i) => i.is_popular && matches(i));
      if (featured.length) html += section('popular', t().featured, view.items.filter((i) => i.is_popular));
      for (const c of view.categories) {
        const items = view.items.filter((i) => i.category_id === c.id);
        if (items.some(matches)) html += section(c.id, c.name, items);
      }
      const loose = view.items.filter((i) => !i.category_id || !view.categories.some((c) => c.id === i.category_id));
      if (loose.some(matches)) html += section('all', t().full, loose);
    } else {
      const title = activeCategory === 'all' ? t().all
        : activeCategory === 'popular' ? t().popular
        : (view.categories.find((x) => x.id === activeCategory) || {}).name || t().all;
      html = section(activeCategory, title, view.items.filter((i) => inCat(i, activeCategory)));
    }
    zone.innerHTML = html;

    zone.querySelectorAll('[data-plus]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); changeCart(b.dataset.plus, 1); }));
    zone.querySelectorAll('[data-minus]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); changeCart(b.dataset.minus, -1); }));
    zone.querySelectorAll('[data-open]').forEach((card) => {
      card.addEventListener('click', (e) => { if (!e.target.closest('button')) openSheet(card.dataset.open); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(card.dataset.open); } });
    });
  }

  /* ---------------------- product detail sheet ---------------------- */
  let sheetItem = null;
  let sheetQty = 1;
  function openSheet(itemId) {
    const item = view.items.find((i) => i.id === itemId);
    if (!item) return;
    sheetItem = item;
    sheetQty = 1;
    renderSheet();
    showSheet();
  }
  /* Slide-up lifecycle. The sheet is built off-screen (translateY(100%));
     `.open` transitions it in. Kept separate from renderSheet() because
     renderSheet() re-runs on every quantity/pick change and must NOT
     replay the animation. */
  function showSheet() {
    const root = document.getElementById('product-sheet-root');
    if (!root) return;
    const backdrop = root.querySelector('.product-sheet-backdrop');
    const panel = root.querySelector('.product-sheet');
    if (backdrop) backdrop.classList.add('open');
    if (panel) requestAnimationFrame(() => panel.classList.add('open'));
  }
  function closeSheet() {
    const el = document.getElementById('product-sheet-root');
    const panel = el && el.querySelector('.product-sheet');
    const backdrop = el && el.querySelector('.product-sheet-backdrop');
    if (panel) panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.classList.remove('sheet-open');
    // Wait for the slide-out before tearing the DOM down.
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      sheetItem = null;
      const root = document.getElementById('product-sheet-root');
      if (root) root.innerHTML = '';
      const wasCard = document.querySelector('[data-open="' + (lastSheetId || '') + '"]');
      if (wasCard) { try { wasCard.focus({ preventScroll: true }); } catch (_) {} }
    }, reduced ? 0 : 300);
  }
  let lastSheetId = null;
  /* Labels for optional product detail fields. These columns do not exist in the
     schema yet, so nothing renders until a value is present — see factsHtml(). */
  const FACT_LABELS = {
    calories: lang === 'en' ? 'Calories' : 'السعرات',
    ingredients: lang === 'en' ? 'Ingredients' : 'المكونات',
    allergens: lang === 'en' ? 'Allergens' : 'مسببات الحساسية',
    prep: lang === 'en' ? 'Preparation' : 'التحضير',
  };

  /* Ordered photo set: `images[0]` is the item's primary image (unchanged
     contract), so an item with one photo renders exactly as it always has —
     no carousel chrome at all. */
  function itemPhotos(item) {
    const extra = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    const all = (item.image_path ? [item.image_path] : []).concat(extra.filter((p) => p !== item.image_path));
    return all;
  }

  function shotsHtml(item) {
    const photos = itemPhotos(item);
    if (!photos.length) {
      return '<div class="sheet-shot"><div class="sheet-img no-img"></div></div>';
    }
    if (photos.length === 1) {
      return '<div class="sheet-shot"><img class="sheet-img" src="' + esc(photos[0]) +
        '" alt="" fetchpriority="high" decoding="async"></div>';
    }
    return '<div class="sheet-track" id="sheet-track">' + photos.map((src, i) =>
      '<div class="sheet-shot"><img class="sheet-img" src="' + esc(src) + '" alt=""' +
      (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async"></div>'
    ).join('') + '</div>';
  }

  /* Only fields that actually exist. No placeholder, no invented nutrition. */
  function factsHtml(item) {
    const facts = [];
    const add = (label, value) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        facts.push('<div><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>');
      }
    };
    // These fields do not exist in the schema yet. The renderer is written so it
    // shows a section only when a value is actually present — no placeholder copy,
    // no invented nutrition. Populate these columns and the block appears.
    add(FACT_LABELS.calories, item.calories);
    add(FACT_LABELS.ingredients, item.ingredients);
    add(FACT_LABELS.allergens, item.allergens);
    add(FACT_LABELS.prep, item.prep_note);
    if (!facts.length) return '';
    return '<div class="sheet-facts">' + facts.join('') + '</div>';
  }

  /** Dot indicator for the photo track; omitted entirely for a single photo. */
  function paintSheetShots() {
    const track = document.getElementById('sheet-track');
    const dots = document.getElementById('sheet-shots');
    if (!track || !dots) return;
    const n = track.children.length;
    if (n < 2) { dots.innerHTML = ''; return; }
    dots.innerHTML = Array.from({ length: n }, (_, i) => '<i' + (i === 0 ? ' class="on"' : '') + '></i>').join('');
  }

  function bindSheetShots() {
    const track = document.getElementById('sheet-track');
    const dots = document.getElementById('sheet-shots');
    if (!track || !dots) return;
    paintSheetShots();
    if (track.children.length < 2) return;
    const sync = () => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      Array.from(dots.children).forEach((d, k) => d.classList.toggle('on', k === i));
    };
    track.addEventListener('scroll', sync, { passive: true });
  }

  function renderSheet() {
    if (!sheetItem) return;
    lastSheetId = sheetItem.id;
    const item = sheetItem;
    const hasOpts = (item.options || []).length > 0;
    // Find category name for context
    let categoryName = '';
    if (item.category_id) {
      const cat = view.categories.find((c) => c.id === item.category_id);
      if (cat) categoryName = cat.name;
    }
    let root = document.getElementById('product-sheet-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'product-sheet-root';
      document.body.appendChild(root);
    }
    const optsHtml = hasOpts ? pickerHtml(item) : '';
    const total = money(estimateSheetTotal(item, sheetQty));
    // Capture open state BEFORE innerHTML replaces the nodes below.
    const wasOpen = root.querySelector('.product-sheet.open') !== null;
    root.innerHTML =
      '<div class="product-sheet-backdrop" id="sheet-backdrop"></div>' +
      '<section class="product-sheet" role="dialog" aria-modal="true" aria-label="' + esc(item.name) + '">' +
        '<div class="sheet-grip" aria-hidden="true"></div>' +
        '<div class="sheet-media">' + shotsHtml(item) +
        '<div class="sheet-shots" id="sheet-shots" aria-hidden="true"></div>' +
        '<button class="sheet-close" id="sheet-close" aria-label="Close">×</button></div>' +
        '<div class="sheet-scroll">' +
        '<p class="sheet-eyebrow">' + esc(categoryName || view.name) + '</p>' +
        '<h2 class="sheet-title">' + esc(item.name) + '</h2>' +
        '<p class="sheet-price">' + esc(money(item.price_cents)) + '</p>' +
        (item.description ? '<p class="sheet-desc">' + esc(item.description) + '</p>' : '') +
        (!item.is_available ? '<p class="sheet-note sold">' + esc(t().soldOut) + '</p>' : '') +
        factsHtml(item) +
        optsHtml +
        '</div>' +
        '<div class="sheet-action"><div class="qty" aria-label="' + esc(item.name) + '">' +
          '<button id="sheet-minus" aria-label="−">−</button><span>' + sheetQty + '</span><button id="sheet-plus" aria-label="+">＋</button></div>' +
          '<button class="co-submit" id="sheet-add"' + (item.is_available ? '' : ' disabled') + '>' +
            esc(t().add) + ' · <span id="sheet-total-val">' + esc(total) + '</span></button></div>' +
      '</section>';
    document.body.classList.add('sheet-open');
    // Re-renders (quantity / option changes) must not replay the entrance:
    // if the sheet was already open, restore the class synchronously.
    if (wasOpen) {
      root.querySelector('.product-sheet').classList.add('open');
      root.querySelector('.product-sheet-backdrop').classList.add('open');
    }
    bindSheetShots();
    document.getElementById('sheet-backdrop').addEventListener('click', closeSheet);
    document.getElementById('sheet-close').addEventListener('click', closeSheet);
    // Swipe down on the grip/media to dismiss (touch only, no library).
    // Uses a CSS custom property for the drag offset so it composes with the
    // sheet's own transform (which centres the panel on desktop).
    (function () {
      const panel = root.querySelector('.product-sheet');
      let startY = null;
      panel.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
      panel.addEventListener('touchmove', (e) => {
        if (startY === null) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 0) panel.style.setProperty('--drag', Math.min(dy, 160) + 'px');
      }, { passive: true });
      panel.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - startY;
        panel.style.setProperty('--drag', '0px');
        startY = null;
        if (dy > 110) closeSheet();
      });
    })();
    document.getElementById('sheet-minus').addEventListener('click', () => { sheetQty = Math.max(1, sheetQty - 1); renderSheet(); });
    document.getElementById('sheet-plus').addEventListener('click', () => { sheetQty += 1; renderSheet(); });
    document.getElementById('sheet-add').addEventListener('click', () => {
      if (hasOpts) {
        if (!picksValid(item)) {
          const err = document.getElementById('opterr-' + item.id);
          if (err) err.classList.remove('hidden');
          return;
        }
        for (let i = 0; i < sheetQty; i++) addWithPicks(item.id);
      } else {
        changeCart(item.id, sheetQty);
      }
      closeSheet();
    });
    wirePicks(root);
    const sheet = root.querySelector('.product-sheet');
    sheet.setAttribute('tabindex', '-1');
    try { sheet.focus({ preventScroll: true }); } catch (_) {}
    sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeSheet(); }
      if (e.key === 'Tab') {
        const f = sheet.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  function estimateSheetTotal(item, qty) {
    const itemHasOpts = (item.options || []).length > 0;
    let unit = item.price_cents;
    if (itemHasOpts) {
      const pm = picks[item.id] || {};
      for (const [gid, choices] of Object.entries(pm)) {
        const g = (item.options || []).find((x) => x.id === gid);
        if (!g) continue;
        for (const [cid, cq] of Object.entries(choices)) {
          const ch = (g.choices || []).find((x) => x.id === cid);
          if (ch) {
            if (g.pricing === 'replace') unit = ch.price_cents;
            else unit += ch.price_cents;
          }
        }
      }
    }
    return unit * qty;
  }

  function dishCard(item) {
    const hasOpts = (item.options || []).length > 0;
    const q = (!hasOpts && Number.isInteger(cart[item.id])) ? cart[item.id] : 0;
    // Image box is sized by aspect-ratio in CSS, so space is reserved before the
    // photo loads and nothing shifts. A missing photo keeps the same box.
    const img = '<div class="dish-media' + (item.image_path ? '' : ' no-img') + '">' +
      (item.image_path ? '<img class="dish-img" loading="lazy" decoding="async" src="' + esc(item.image_path) + '" alt="">' : '') +
      (item.is_popular ? '<b class="dish-badge">' + esc(t().top) + '</b>' : '') +
      (!item.is_available ? '<span class="dish-badge sold">' + esc(t().soldOut) + '</span>' : '') + '</div>';
    const action = (!item.is_available || hasOpts || !q) ? '' : qtyCtl(item.id, q, item.name);
    return '<article class="dish' + (!item.is_available ? ' sold-out' : '') + '" data-open="' + esc(item.id) + '" role="button" tabindex="0" aria-label="' + esc(item.name) + '">' + img +
      '<div class="dish-body"><h3>' + esc(item.name) + '</h3>' +
      (item.description ? '<p class="dish-desc">' + esc(item.description) + '</p>' : '') +
      (item.is_preorder ? '<p class="dish-note">' + esc(t().preorderBadge) +
        (item.preorder_note ? ' · ' + esc(item.preorder_note) : '') + '</p>' : '') +
      '<p class="price-red">' + esc(money(item.price_cents)) + '</p>' + action +
      '</div></article>';
  }

  const qtyCtl = (id, q, label) =>
    '<div class="qty" aria-label="' + esc(label) + '"><button data-minus="' + esc(id) + '">−</button><span>' + q + '</span><button data-plus="' + esc(id) + '">＋</button></div>';

  function renderBar() {
    const units = totalUnits();
    const bar = $bar();
    if (units === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    bar.innerHTML = '<span>' + esc(t().cart + ' (' + units + ')') + '</span><span>' + esc(money(subtotalCents())) + ' ‹</span>';
  }

  /* ---------------------------- overlay ---------------------------- */
  function stashCo() {
    const g = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    if (document.getElementById('checkout-form')) {
      co = { name: g('co-name'), wa: g('co-wa'), phone: g('co-phone'), address: g('co-address'), notes: g('co-notes') };
    }
  }

  function renderOverlay() {
    const root = $overlay();
    if (bookingOpen) { root.innerHTML = bookingHtml(); wireBooking(); focusModal(root); return; }
    if (!cartOpen) { root.innerHTML = ''; return; }
    const entries = cartEntries();
    if (!entries.length) {
      root.innerHTML = '<div class="cart-overlay"><section class="cart-modal"><div class="cart-title"><div><h2>' +
        esc(t().cartEmpty) + '</h2></div><button class="cart-close" data-close>×</button></div>' +
        '<p style="color:rgba(32,61,58,.6);font-size:13px">' + esc(t().cartEmptyHint) + '</p>' +
        '<div class="cart-total" aria-live="polite" aria-atomic="true" style="display:flex;justify-content:space-between"><span>' + esc(t().total) + '</span><span>' + esc(money(0)) + '</span></div>' +
        '<button class="co-ghost" data-close>' + esc(t().keepBrowsing) + '</button></section></div>';
      root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeOverlay));
      focusModal(root);
      return;
    }
    const sub = subtotalCents(), fee = feeCents();
    root.innerHTML = '<div class="cart-overlay"><section class="cart-modal">' +
      '<div class="cart-title"><div><small>' + totalUnits() + ' ' + esc(t().items) + '</small><h2>' + esc(t().cart) + '</h2></div>' +
      '<button class="cart-close" data-close>×</button></div>' +
      entries.map((e) => {
        const names = selNames(e.item, e.selections);
        const poNote = e.item.is_preorder
          ? '<small>' + esc(t().preorderBadge) + (e.item.preorder_note ? ': ' + esc(e.item.preorder_note) : '') + '</small>'
          : '';
        // Use the first photo of the set (the primary image) so the cart matches the menu.
        const primary = (e.item.images && e.item.images[0]) || e.item.image_path || FOOD;
        return '<div class="cart-row"><img src="' + esc(primary) + '" alt="">' +
          '<div class="cart-row-main"><strong>' + esc(e.item.name) + '</strong>' +
          (names ? '<small>' + esc(names) + '</small>' : '') + poNote +
          '<small>' + esc(money(estimateUnit(e.item, e.selections) * e.qty)) + '</small></div>' +
          qtyCtl(e.key, e.qty, e.item.name) + '</div>';
      }).join('') +
      (hasDelivery()
        ? '<div class="co-type"><button data-type="pickup"' + (orderType === 'pickup' ? ' class="active"' : '') + '>' + esc(t().pickup) + '</button>' +
          '<button data-type="delivery"' + (orderType === 'delivery' ? ' class="active"' : '') + '>' + esc(t().delivery) + '</button></div>'
        : '') +
      '<div class="cart-total" aria-live="polite" aria-atomic="true" style="display:grid;gap:6px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>' + esc(t().subtotal) + '</span><span>' + esc(money(sub)) + '</span></div>' +
      (orderType === 'delivery' ? '<div style="display:flex;justify-content:space-between;font-size:13px"><span>' + esc(t().deliveryFee) + '</span><span>' + (fee === 0 ? esc(t().free) : esc(money(fee))) + '</span></div>' : '') +
      '<div style="display:flex;justify-content:space-between"><span>' + esc(t().total) + '</span><span>' + esc(money(sub + fee)) + '</span></div></div>' +
      freeShipMsg() +
      '<form id="checkout-form" class="co-form" novalidate>' +
        '<label>' + esc(t().yourName) + '<input id="co-name" maxlength="80" autocomplete="name" value="' + esc(co.name) + '"></label>' +
        '<label>' + esc(t().waNumber) + '<input id="co-wa" type="tel" maxlength="20" dir="ltr" autocomplete="tel" value="' + esc(co.wa) + '"></label>' +
        '<label>' + esc(t().phoneOpt) + '<input id="co-phone" type="tel" maxlength="20" dir="ltr" value="' + esc(co.phone) + '"></label>' +
        '<label>' + esc(orderType === 'delivery' ? t().addrDelivery : t().addrOpt) + '<textarea id="co-address" maxlength="250">' + esc(co.address) + '</textarea></label>' +
        '<label>' + esc(t().notesOpt) + '<input id="co-notes" maxlength="400" value="' + esc(co.notes) + '"></label>' +
      '</form>' +
      '<p class="co-error hidden" id="checkout-error"></p>' +
      (sent ? '<p class="live-alert ok">' + esc(t().ready) + ' ' + esc(t().sentHint) + '</p>' : '') +
      '<button class="co-submit" id="place-order-btn"' + (view.openNow && !view.orderingBlocked ? '' : ' disabled') + '>' + esc(t().sendSite) + '</button>' +
      '<button class="whatsapp" id="order-wa-btn"' + (view.openNow && !view.orderingBlocked ? '' : ' disabled') + '>◌　' + esc(t().sendWA) + '</button>' +
      '<button class="co-ghost" data-close>' + esc(t().keepBrowsing) + '</button>' +
      '</section></div>';

    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeOverlay));
    root.querySelectorAll('[data-plus]').forEach((b) => b.addEventListener('click', () => changeCart(b.dataset.plus, 1)));
    root.querySelectorAll('[data-minus]').forEach((b) => b.addEventListener('click', () => changeCart(b.dataset.minus, -1)));
    root.querySelectorAll('.co-type button').forEach((b) => b.addEventListener('click', () => {
      stashCo();
      setOrderType(b.dataset.type);
    }));
    document.getElementById('place-order-btn').addEventListener('click', submitOrder);
    document.getElementById('order-wa-btn').addEventListener('click', orderViaWhatsapp);
    focusModal(root);
  }

  function closeOverlay() {
    cartOpen = false;
    bookingOpen = false;
    renderOverlay();
    const bar = $bar();
    if (bar && !bar.classList.contains('hidden')) {
      try { bar.focus({ preventScroll: true }); } catch (_) { /* older browsers */ }
    }
  }

  function focusModal(root) {
    const modal = root.querySelector('.cart-modal');
    if (!modal) return;
    modal.setAttribute('tabindex', '-1');
    try { modal.focus({ preventScroll: true }); } catch (_) { /* older browsers */ }
  }

  function changeCart(key, delta) {
    stashCo();
    const cur = cart[key];
    const curQty = Number.isInteger(cur) ? cur : ((cur && cur.qty) || 0);
    const next = Math.max(0, curQty + delta);
    if (next) {
      cart[key] = (Number.isInteger(cur) || cur === undefined)
        ? next
        : { qty: next, selections: cur.selections };
    } else delete cart[key];
    saveCart();
    renderBar();
    updateGrids();
    if (cartOpen || bookingOpen) renderOverlay();
  }

  /* --------------------- product option picks ---------------------- */
  // Pending picks live only in the card (server re-validates everything).
  // picks[itemId][groupId] = {choiceId: qty}.
  function pickState(itemId) {
    return picks[itemId] || (picks[itemId] = {});
  }
  function pickPrice(item, group, choice) {
    return group.pricing === 'replace'
      ? esc(money(choice.price_cents))
      : '+' + esc(money(choice.price_cents));
  }
  function groupHint(g) {
    if (g.min_picks > 0) {
      const span = g.min_picks === g.max_picks ? String(g.min_picks) : g.min_picks + '–' + g.max_picks;
      return '<span class="opt-req">' + esc(t().optChoose + ' ' + span) + '</span>';
    }
    return '<span class="opt-opt">' + esc(t().optOptional) + '</span>';
  }
  function pickerHtml(item) {
    return '<div class="opt-groups">' + (item.options || []).map((g) => {
      const single = g.max_picks === 1;
      const pm = pickState(item.id)[g.id] || {};
      // Selection rule stated in words, and only when a real limit exists.
      const req = !!g.is_required || g.min_picks > 0;
      const span = g.min_picks === g.max_picks
        ? String(g.min_picks)
        : g.min_picks + '\u2013' + g.max_picks;
      const hint = req ? esc(t().optChoose + ' ' + span) : esc(t().optOptional);
      const head = '<div class="group-head"><h3>' + esc(g.name) + '</h3>' +
        '<span class="group-hint' + (req ? '' : ' optional') + '">' + hint + '</span></div>';
      // Single-pick groups behave as radios, multi-pick as checkboxes with steppers.
      const body = single
        ? (g.choices || []).map((c) =>
          '<button type="button" class="pick radio" data-opt="' +
          esc(item.id + '|' + g.id + '|' + c.id) + '" aria-pressed="' + (pm[c.id] ? 'true' : 'false') + '"' +
          (c.is_available ? '' : ' disabled') + '>' +
          '<span class="pick-box" aria-hidden="true"></span>' +
          '<span class="pick-text">' + esc(c.name) + '</span>' +
          '<span class="pick-add">' + pickPrice(item, g, c) + '</span></button>').join('')
        : (g.choices || []).map((c) =>
          '<div class="opt-row"><button type="button" class="pick" data-opt="' +
          esc(item.id + '|' + g.id + '|' + c.id) + '" aria-pressed="' + (pm[c.id] ? 'true' : 'false') + '"' +
          (c.is_available ? '' : ' disabled') + '>' +
          '<span class="pick-box" aria-hidden="true"></span>' +
          '<span class="pick-text">' + esc(c.name) + '</span>' +
          '<span class="pick-add">' + pickPrice(item, g, c) + '</span></button>' +
          '<div class="qty"><button type="button" data-optminus="' + esc(item.id + '|' + g.id + '|' + c.id) + '">−</button>' +
          '<span>' + (pm[c.id] || 0) + '</span>' +
          '<button type="button" data-optplus="' + esc(item.id + '|' + g.id + '|' + c.id) + '"' +
          (c.is_available ? '' : ' disabled') + '>＋</button></div></div>').join('');
      return '<div class="group" id="group-' + esc(g.id) + '">' + head + body + '</div>';
    }).join('') + '</div>' +
    '<p class="opt-error hidden" id="opterr-' + esc(item.id) + '">' + esc(t().optNeedMore) + '</p>';
  }
  function refreshPicks() { updateGrids(); if (sheetItem) renderSheet(); }
  function wirePicks(zone) {
    zone.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
      const [itemId, groupId, choiceId] = b.dataset.opt.split('|');
      const pm = pickState(itemId);
      if (pm[groupId] && pm[groupId][choiceId]) delete pm[groupId];
      else pm[groupId] = { [choiceId]: 1 };
      refreshPicks();
    }));
    zone.querySelectorAll('[data-optplus]').forEach((b) => b.addEventListener('click', () => {
      const [itemId, groupId, choiceId] = b.dataset.optplus.split('|');
      const item = view.items.find((i) => i.id === itemId);
      const g = (item.options || []).find((x) => x.id === groupId);
      const c = ((g && g.choices) || []).find((x) => x.id === choiceId);
      if (!c || !c.is_available) return;
      const pm = pickState(itemId);
      const cur = pm[groupId] || (pm[groupId] = {});
      const distinct = Object.keys(cur).length;
      if (!cur[choiceId] && distinct >= g.max_picks) return;
      cur[choiceId] = Math.min((cur[choiceId] || 0) + 1, c.max_quantity);
      refreshPicks();
    }));
    zone.querySelectorAll('[data-optminus]').forEach((b) => b.addEventListener('click', () => {
      const [itemId, groupId, choiceId] = b.dataset.optminus.split('|');
      const pm = pickState(itemId);
      const cur = pm[groupId] || {};
      if (!cur[choiceId]) return;
      cur[choiceId] -= 1;
      if (cur[choiceId] <= 0) delete cur[choiceId];
      if (Object.keys(cur).length === 0) delete pm[groupId];
      refreshPicks();
    }));
  }
  function picksValid(item) {
    const pm = pickState(item.id);
    return (item.options || []).every((g) => Object.keys(pm[g.id] || {}).length >= g.min_picks);
  }
  function addWithPicks(itemId) {
    const item = view.items.find((i) => i.id === itemId);
    if (!item || !item.is_available) return;
    const err = document.getElementById('opterr-' + itemId);
    if (!picksValid(item)) {
      if (err) err.classList.remove('hidden');
      return;
    }
    if (err) err.classList.add('hidden');
    const pm = pickState(itemId);
    const selections = Object.entries(pm).map(([groupId, choices]) => ({
      groupId,
      choices: Object.entries(choices).map(([choiceId, quantity]) => ({ choiceId, quantity })),
    }));
    const key = itemId + '#' + selections
      .map((s) => s.groupId + ':' + s.choices.map((c) => c.choiceId + 'x' + c.quantity).join(',')).join(';');
    const cur = cart[key];
    cart[key] = { qty: ((cur && cur.qty) || 0) + 1, selections };
    delete picks[itemId];
    stashCo();
    saveCart();
    renderBar();
    updateGrids();
    if (cartOpen || bookingOpen) renderOverlay();
  }
  // Human-readable selection names for cart rows and messages.
  function selNames(item, sels) {
    const groups = {};
    for (const g of (item.options || [])) groups[g.id] = g;
    const parts = [];
    for (const s of (sels || [])) {
      const g = groups[s.groupId];
      if (!g) continue;
      for (const line of (s.choices || [])) {
        const c = (g.choices || []).find((x) => x.id === line.choiceId);
        if (c) parts.push(c.name + (line.quantity > 1 ? ' ×' + line.quantity : ''));
      }
    }
    return parts.join(', ');
  }

  /* ---------------------------- checkout --------------------------- */
  function readCo() {
    return {
      customerName: document.getElementById('co-name').value.trim(),
      customerWhatsapp: document.getElementById('co-wa').value.trim(),
      customerPhone: document.getElementById('co-phone').value.trim(),
      customerAddress: document.getElementById('co-address').value.trim(),
      notes: document.getElementById('co-notes').value.trim(),
    };
  }
  function coError(msg) {
    const box = document.getElementById('checkout-error');
    if (!box) return;
    if (!msg) { box.classList.add('hidden'); return; }
    box.textContent = msg;
    box.classList.remove('hidden');
  }

  // One idempotency key per checkout attempt: retries after a failure reuse it,
  // so a double-click or slow-network retry returns the original order (FR-008b).
  // A fresh key is minted for every new attempt (a new success clears it).
  let submitKey = null;

  async function submitOrder() {
    coError(null);
    const f = readCo();
    if (!f.customerName || !f.customerWhatsapp) { coError(t().enterNameAndWa); return; }
    if (orderType === 'delivery' && !f.customerAddress) { coError(t().addrRequired); return; }
    const btn = document.getElementById('place-order-btn');
    btn.disabled = true;
    if (!submitKey && window.crypto && typeof window.crypto.randomUUID === 'function') {
      submitKey = window.crypto.randomUUID();
    }
    try {
      const data = await api.post('/api/restaurants/' + encodeURIComponent(slug) + '/orders', {
        customerName: f.customerName, customerWhatsapp: f.customerWhatsapp,
        customerPhone: f.customerPhone, customerAddress: f.customerAddress,
        notes: f.notes, orderType, submissionKey: submitKey,
        items: cartEntries().map((e) => ({ itemId: e.item.id, quantity: e.qty, selections: e.selections })),
      });
      cart = {}; co = { name: '', wa: '', phone: '', address: '', notes: '' };
      submitKey = null;
      saveCart(); renderBar(); updateGrids();
      renderSuccess(data.order);
    } catch (err) {
      coError(err.message);
    } finally {
      btn.disabled = false;
    }
  }

  function orderViaWhatsapp() {
    const f = readCo();
    coError(null);
    if (!f.customerName || !f.customerWhatsapp) { coError(t().enterNameAndWa); return; }
    if (orderType === 'delivery' && !f.customerAddress) { coError(t().addrRequired); return; }
    const restaurantWa = ((view.settings && view.settings.whatsapp) || '').replace(/[^0-9]/g, '');
    if (!restaurantWa) { coError(t().noWA); return; }
    const entries = cartEntries();
    const lines = entries.map((e) => {
      const names = selNames(e.item, e.selections);
      return e.qty + '× ' + e.item.name + (names ? ' (' + names + ')' : '');
    }).join('\n');
    let msg = 'السلام عليكم ' + view.name + '، أريد طلب:\n' + lines +
      '\n' + t().total + ': ' + money(subtotalCents() + feeCents()) +
      '\n' + t().yourName + ': ' + f.customerName + '\n' + t().waNumber + ': ' + f.customerWhatsapp;
    if (f.customerAddress) msg += '\n' + t().addrDelivery + ': ' + f.customerAddress;
    if (f.notes) msg += '\n' + t().notesOpt + ': ' + f.notes;
    msg += '\n' + (orderType === 'delivery' ? t().delivery : t().pickup);
    sent = true;
    window.open('https://wa.me/' + encodeURIComponent(restaurantWa) + '?text=' + encodeURIComponent(msg), '_blank');
    renderOverlay();
  }

  function renderSuccess(order) {
    const code = order.code || '';
    paintSuccess(order, null);
    // Enrich with the frozen server projection (lines, options, preorder
    // notes, currency). Failure keeps the minimal confirmation above.
    api.get('/api/orders/track/' + encodeURIComponent(code)).then(
      (d) => { if (d && d.order) paintSuccess(order, d.order); },
      () => {}
    );
  }

  function paintSuccess(order, full) {
    const code = order.code || '';
    const currency = (full && full.currency) || order.currency || (view.settings && view.settings.currency) || 'USD';
    const sub = full ? full.subtotal_cents : order.subtotalCents;
    const fee = full ? full.delivery_fee_cents : order.deliveryFeeCents;
    const total = full ? full.total_cents : (order.total_cents ?? order.totalCents ?? 0);
    const type = full ? full.order_type : orderType;
    const when = full ? full.created_at : order.createdAt;
    const lines = full
      ? full.items.map((it) =>
        '<div class="total-row"><span>' + esc(it.quantity) + ' &times; ' + esc(it.item_name) +
        (((it.options || []).length)
          ? '<br><small>' + esc(it.options.map((o) => o.choice_name + (o.quantity > 1 ? ' ×' + o.quantity : '')).join(', ')) + '</small>'
          : '') +
        (it.is_preorder
          ? '<br><small>' + esc(t().preorderBadge) + (it.preorder_note ? ': ' + esc(it.preorder_note) : '') + '</small>'
          : '') +
        '</span><span>' + esc(fmtMoney(it.line_total_cents, currency)) + '</span></div>'
      ).join('')
      : '';
    let whenLine = '';
    try {
      if (when) whenLine = '<p class="muted small mb-0">' + esc(new Date(when).toLocaleString(lang === 'ar' ? 'ar' : 'en')) + '</p>';
    } catch (_) { /* cosmetic only */ }
    $overlay().innerHTML = '<div class="cart-overlay"><section class="cart-modal">' +
      '<div class="cart-title"><div><h2>' + esc(t().placedHead) + '</h2></div>' +
      '<button class="cart-close" data-close>×</button></div>' +
      '<p style="color:rgba(32,61,58,.65);font-size:13px">' + esc(t().showCode) + '</p>' +
      '<div class="success-code">' + esc(code) + '</div>' + whenLine +
      '<p><span class="badge">' + esc(type === 'delivery' ? t().delivery : t().pickup) + '</span>' +
      (full && full.items.some((it) => it.is_preorder) ? ' <span class="preorder-tag">' + esc(t().preorderBadge) + '</span>' : '') + '</p>' +
      (lines ? '<h3 class="section-title">' + esc(t().orderSummary) + '</h3>' + lines : '') +
      (full && type === 'delivery'
        ? '<div class="total-row"><span>' + esc(t().deliveryFee) + '</span><span>' + esc(fmtMoney(full.delivery_fee_cents, currency)) + '</span></div>'
        : (sub !== undefined && fee !== undefined && type === 'delivery'
          ? '<div class="total-row"><span>' + esc(t().deliveryFee) + '</span><span>' + esc(fmtMoney(fee, currency)) + '</span></div>'
          : '')) +
      '<p class="success-total">' + esc(t().total) + ' <strong>' + esc(fmtMoney(total, currency)) + '</strong></p>' +
      '<p style="color:rgba(32,61,58,.65);font-size:13px">' + esc(t().nextSteps) + '</p>' +
      '<a class="co-submit" style="text-decoration:none" href="/track?code=' + encodeURIComponent(code) + '">' + esc(t().trackMyOrder) + '</a>' +
      '<button class="co-ghost" data-close>' + esc(t().done) + '</button></section></div>';
    $overlay().querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { sent = false; closeOverlay(); }));
    focusModal($overlay());
  }

  /* ---------------------------- booking ---------------------------- */
  function bookingHtml() {
    const today = new Date().toISOString().slice(0, 10);
    return '<div class="cart-overlay"><section class="cart-modal">' +
      '<div class="cart-title"><div><h2>' + esc(t().bookTitle) + '</h2></div>' +
      '<button class="cart-close" data-close>×</button></div>' +
      '<p style="color:rgba(32,61,58,.65);font-size:13px">' + esc(t().bookDesc) + '</p>' +
      '<form id="booking-form" class="co-form" novalidate>' +
        '<label>' + esc(t().bkName) + '<input id="bk-name" maxlength="80"></label>' +
        '<label>' + esc(t().bkWA) + '<input id="bk-wa" type="tel" maxlength="20" dir="ltr"></label>' +
        '<label>' + esc(t().bkPhone) + '<input id="bk-phone" type="tel" maxlength="20" dir="ltr"></label>' +
        '<label>' + esc(t().bkTables) + '<input id="bk-tables" type="number" min="1" max="20" value="2"></label>' +
        '<label>' + esc(t().bkDate) + '<input id="bk-date" type="date" value="' + esc(today) + '"></label>' +
        '<label>' + esc(t().bkTime) + '<input id="bk-time" type="time" value="19:00"></label>' +
        '<label>' + esc(t().bkNotes) + '<input id="bk-notes" maxlength="400"></label>' +
      '</form><p class="co-error hidden" id="booking-error"></p>' +
      '<button class="co-submit" id="book-submit-btn">' + esc(t().bookNow) + '</button>' +
      '<button class="co-ghost" data-close>' + esc(t().close) + '</button></section></div>';
  }
  function wireBooking() {
    $overlay().querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeOverlay));
    document.getElementById('book-submit-btn').addEventListener('click', async () => {
      const errBox = document.getElementById('booking-error');
      errBox.classList.add('hidden');
      const btn = document.getElementById('book-submit-btn');
      btn.disabled = true;
      try {
        await api.post('/api/restaurants/' + encodeURIComponent(slug) + '/bookings', {
          customerName: document.getElementById('bk-name').value,
          customerWhatsapp: document.getElementById('bk-wa').value,
          customerPhone: document.getElementById('bk-phone').value,
          tablesCount: Number(document.getElementById('bk-tables').value),
          bookedAt: document.getElementById('bk-date').value + 'T' + document.getElementById('bk-time').value,
          notes: document.getElementById('bk-notes').value,
        });
        toast(t().bookingCreated, 'success');
        closeOverlay();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
        btn.disabled = false;
      }
    });
  }

  /* ----------------------------- share ----------------------------- */
  function sharePage() {
    const url = location.href;
    if (navigator.share) { navigator.share({ title: view.name, text: view.name, url }).catch(() => {}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(url).then(() => toast(t().linkCopied)); }
  }

  /* ------------------------------ boot ----------------------------- */
  async function boot() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      view = await api.get('/api/restaurants/' + encodeURIComponent(slug) + '/menu');
    } catch (err) {
      $content().innerHTML = '<div class="live-alert error">' + esc(err.message) + '</div>';
      $bar().classList.add('hidden');
      return;
    }
    try {
      const stored = localStorage.getItem('restivo-lang');
      const sl = view.settings && view.settings.storefrontLanguage;
      if (!stored && (sl === 'ar' || sl === 'en') && sl !== lang) setLang(sl);
    } catch (_) { /* ignore */ }
    const qLang = qsParam('lang');
    if (qLang === 'en' || qLang === 'ar') setLang(qLang);
    api.get('/api/seo/business/' + encodeURIComponent(slug)).then((m) => {
      if (!m) return;
      document.title = m.title;
      (function () {
        let el = document.head.querySelector('meta[name="description"]');
        if (!el) { el = document.createElement('meta'); el.name = 'description'; document.head.appendChild(el); }
        el.content = m.description;
      })();
      const ensureMeta = (key, value, attr) => {
        let el = document.head.querySelector('meta[' + attr + '="' + key + '"]');
        if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
        el.setAttribute('content', value);
      };
      ensureMeta('og:title', m.ogTitle, 'property');
      ensureMeta('og:description', m.ogDescription, 'property');
      ensureMeta('og:type', m.ogType, 'property');
      ensureMeta('og:image', m.ogImage, 'property');
      ensureMeta('og:url', m.canonical, 'property');
      if (m.noindex) ensureMeta('robots', 'noindex, nofollow', 'name');
      let link = document.head.querySelector('link[rel="canonical"]');
      if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
      link.href = m.canonical;
      const alt = (hl) => {
        let a = document.head.querySelector('link[rel="alternate"][hreflang="' + hl + '"]');
        if (!a) { a = document.createElement('link'); a.rel = 'alternate'; a.setAttribute('hreflang', hl); document.head.appendChild(a); }
        a.href = m.canonical + (m.canonical.includes('?') ? '&' : '?') + 'lang=' + (hl === 'x-default' ? 'ar' : hl);
      };
      alt('ar'); alt('en'); alt('x-default');
      const ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.textContent = JSON.stringify(m.structuredData);
      document.head.appendChild(ld);
    }).catch(() => {});
    try {
      const tokens = theme.buildTokens(view.settings.primaryColor, view.settings.secondaryColor);
      const rs = document.documentElement.style;
      for (const [name, value] of Object.entries(tokens)) rs.setProperty(name, value);
    } catch (_) { /* brand tokens optional */ }
    document.title = (lang === 'en' && view.settings.nameEn) ? view.settings.nameEn : view.name;

    const reorderRaw = qsParam('reorder');
    const reorderFrom = qsParam('reorderFrom');
    if (reorderRaw || reorderFrom) {
      // Rebuilds from LIVE definitions: unknown/unavailable items and
      // renamed/removed/unavailable options are dropped with notice —
      // stale prices are never reapplied (server reprices at checkout).
      const apply = (lines) => {
        let dropped = 0;
        for (const line of lines) {
          const id = String(line.id).trim();
          const qty = Math.max(1, Math.min(Number(line.qty), 99) || 1);
          const item = view.items.find((i) => i.id === id);
          if (!item || !item.is_available) { dropped += 1; continue; }
          const opts = line.options || [];
          if (!opts.length && !(item.options || []).length) { cart[id] = qty; continue; }
          const selections = [];
          let ok = true;
          for (const g of (item.options || [])) {
            const want = opts.filter((o) =>
              (o.group_name || '').toLowerCase() === g.name.toLowerCase());
            const choices = [];
            for (const w of want) {
              const c = (g.choices || []).find((x) =>
                x.is_available && x.name.toLowerCase() === (w.choice_name || '').toLowerCase());
              if (!c) continue;
              if (choices.length >= g.max_picks) break;
              choices.push({ choiceId: c.id, quantity: Math.max(1, Math.min(Number(w.quantity) || 1, c.max_quantity || 99)) });
            }
            if (choices.length < g.min_picks) { ok = false; break; }
            if (choices.length) selections.push({ groupId: g.id, choices });
          }
          if (!ok) { dropped += 1; continue; }
          const key = id + '#' + selections
            .map((s) => s.groupId + ':' + s.choices.map((c) => c.choiceId + 'x' + c.quantity).join(',')).join(';');
          cart[key] = { qty, selections };
        }
        return dropped;
      };
      try {
        let dropped = 0;
        if (reorderFrom && /^[A-Za-z0-9]{6,12}$/.test(reorderFrom)) {
          try {
            const d = await api.get('/api/orders/track/' + encodeURIComponent(reorderFrom.toUpperCase()));
            dropped = apply((d.order.items || []).map((it) => ({
              id: it.menu_item_id, qty: it.quantity, options: it.options || [],
            })));
          } catch (_) {
            dropped = apply((reorderRaw || '').split(',').filter(Boolean).map((p) => {
              const [id, q] = p.split(':');
              return { id, qty: q, options: [] };
            }));
          }
        } else if (reorderRaw) {
          dropped = apply(reorderRaw.split(',').map((p) => {
            const [id, q] = p.split(':');
            return { id, qty: q, options: [] };
          }));
        }
        saveCart();
        if (dropped) toast(t().reorderAdjusted, 'error');
      } catch (_) { /* ignore malformed reorder param */ }
    }

    renderAll();
    $bar().addEventListener('click', () => { if (totalUnits() === 0) return; bookingOpen = false; cartOpen = true; renderOverlay(); });
    $overlay().addEventListener('click', (e) => { if (e.target.classList.contains('cart-overlay')) closeOverlay(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
  }

  boot();
})();
