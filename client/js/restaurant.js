'use strict';

/**
 * Live storefront in the Ordora menu design language (same markup, IDs and
 * CSS as the /demo/ preview, backed by live API data). SERVER computes all
 * totals at checkout; option prices shown here are display estimates.
 */

(function () {
  var App = window.App || {};
  var api = App.api || {
    get: function (path) {
      return fetch(path, { credentials: 'same-origin' }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error((data && data.error && data.error.message) || 'Request failed');
          return data;
        });
      });
    },
    post: function (path, body) {
      return fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error((data && data.error && data.error.message) || 'Request failed');
          return data;
        });
      });
    },
  };
  var esc = App.esc || function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ------------------------- resolve slug -------------------------- */
  var slug = '';
  try {
    var m = new URLSearchParams(location.search).get('r');
    if (m) slug = m;
  } catch (_) { /* ignore */ }
  if (!slug && location.pathname.indexOf('/restaurant/') === 0) {
    slug = decodeURIComponent(location.pathname.split('/')[2] || '');
  }
  slug = (slug || '').toLowerCase();

  /* ------------------------------ copy ----------------------------- */
  /* UI chrome is byte-identical to the /demo/ preview; `live*` keys are the
     only additions (checkout needs customer fields the preview never had). */
  var copy = {
    ar: {
      previewLabel: 'قائمة تجريبية',
      tableLabel: 'الطاولة 08',
      share: 'مشاركة',
      brandNote: 'برغر مشوي. ناس طيبين.',
      order: 'طلبك',
      openNow: 'مفتوح الآن',
      closed: 'مغلق حاليًا',
      restaurantDescription: 'برغر طازج على الفحم، صوصاتنا الخاصة، وجمعة ما بتنمل.',
      ratingLabel: 'من 280 تقييم',
      deliveryTime: '20–30 دقيقة',
      location: 'يافا، فلسطين',
      coverLabel: 'صور المطعم',
      previousCover: 'الصورة السابقة',
      nextCover: 'الصورة التالية',
      showCover: 'عرض الصورة',
      menuKicker: 'من الشواية، على طول',
      menuTitle: 'قائمة ريد بن',
      menuDescription: 'لحم طازج، خبز محمّص، وإضافات تخلّي كل قضمة أحلى.',
      searchLabel: 'ابحث في القائمة',
      searchPlaceholder: 'ابحث عن طبق تحبه',
      categoryLabel: 'أقسام القائمة',
      popularRibbon: 'اختيارات أحبّها ضيوفنا',
      footerCopyright: '© 2026 Ordora. جميع الحقوق محفوظة.',
      footerMade: 'صُنع مع Ordora',
      viewOrder: 'عرض الطلب',
      all: 'كل الأصناف',
      bestSeller: 'الأكثر طلبًا',
      noResultsTitle: 'لم نجد هذا الطبق',
      noResultsText: 'جرّب كلمة أخرى أو اختر قسمًا مختلفًا.',
      yourOrder: 'طلبك',
      pickup: 'استلام',
      delivery: 'توصيل',
      emptyTitle: 'طلبك يبدأ من هنا',
      emptyText: 'اختر طبقًا من القائمة وسنضيفه إلى طلبك.',
      subtotal: 'المجموع',
      deliveryFee: 'رسوم التوصيل',
      free: 'مجانًا',
      total: 'الإجمالي',
      continueCheckout: 'متابعة الطلب',
      close: 'إغلاق',
      options: 'اختر الإضافات',
      required: 'مطلوب',
      optional: 'اختياري',
      chooseOption: 'اختر خيارًا للمتابعة',
      addToOrder: 'أضف إلى الطلب',
      increase: 'زيادة الكمية',
      decrease: 'تقليل الكمية',
      remove: 'إزالة',
      cartAdded: 'أُضيف الطبق إلى طلبك',
      cartUpdated: 'تم تحديث طلبك',
      linkCopied: 'تم نسخ رابط القائمة',
      shareError: 'تعذّرت مشاركة الرابط من هذا المتصفح',
      closeOrder: 'إغلاق الطلب',
      tableService: 'للطاولة 08',
      currencyLocale: 'ar',
      liveName: 'الاسم',
      liveWhatsapp: 'رقم الواتساب',
      liveAddress: 'عنوان التوصيل',
      liveNotes: 'ملاحظات (اختياري)',
      livePlaceOrder: 'تأكيد الطلب',
      liveSending: 'جارٍ إرسال طلبك…',
      liveOrderSent: 'تم استلام طلبك',
      liveShowCode: 'أظهر هذا الرمز عند الاستلام:',
      liveTrack: 'تتبع طلبي',
      liveDone: 'تمام',
      liveEnterNameAndWa: 'الرجاء إدخال الاسم ورقم الواتساب',
      liveAddrRequired: 'الرجاء إدخال عنوان التوصيل',
      liveBlocked: 'الطلبات متوقفة مؤقتًا — يمكنك تصفح القائمة.',
      liveLoadError: 'تعذّر تحميل القائمة — تحقق من اتصالك وحاول مجددًا.',
      liveNotFound: 'المطعم غير موجود.',
    },
    en: {
      previewLabel: 'Menu preview',
      tableLabel: 'Table 08',
      share: 'Share',
      brandNote: 'Made for good table moments',
      order: 'Your order',
      openNow: 'Open now',
      closed: 'Currently closed',
      restaurantDescription: 'Fresh-grilled burgers, house-made sauces, and the kind of company that makes you stay awhile.',
      ratingLabel: 'from 280 reviews',
      deliveryTime: '20–30 min',
      location: 'Jaffa, Palestine',
      coverLabel: 'Restaurant cover photos',
      previousCover: 'Previous cover photo',
      nextCover: 'Next cover photo',
      showCover: 'Show cover photo',
      menuKicker: 'Straight off the grill',
      menuTitle: 'The Red Bun menu',
      menuDescription: 'Fresh beef, toasted buns, and the good stuff in every bite.',
      searchLabel: 'Search the menu',
      searchPlaceholder: 'Find something you love',
      categoryLabel: 'Menu categories',
      popularRibbon: 'Guest favorites',
      footerCopyright: '© 2026 Ordora. All rights reserved.',
      footerMade: 'Made with Ordora',
      viewOrder: 'View order',
      all: 'Everything',
      bestSeller: 'Guest favorite',
      noResultsTitle: 'No dishes found',
      noResultsText: 'Try a different search or browse another category.',
      yourOrder: 'Your order',
      pickup: 'Pickup',
      delivery: 'Delivery',
      emptyTitle: 'Your order starts here',
      emptyText: 'Choose a dish from the menu and it will appear here.',
      subtotal: 'Subtotal',
      deliveryFee: 'Delivery',
      free: 'Free',
      total: 'Total',
      continueCheckout: 'Continue to checkout',
      close: 'Close',
      options: 'Make it yours',
      required: 'Required',
      optional: 'Optional',
      chooseOption: 'Choose an option to continue',
      addToOrder: 'Add to order',
      increase: 'Increase quantity',
      decrease: 'Decrease quantity',
      remove: 'Remove',
      cartAdded: 'Added to your order',
      cartUpdated: 'Your order was updated',
      linkCopied: 'Menu link copied',
      shareError: 'This browser could not share the menu link',
      closeOrder: 'Close order',
      tableService: 'For table 08',
      currencyLocale: 'en',
      liveName: 'Name',
      liveWhatsapp: 'WhatsApp number',
      liveAddress: 'Delivery address',
      liveNotes: 'Notes (optional)',
      livePlaceOrder: 'Place order',
      liveSending: 'Sending your order…',
      liveOrderSent: 'Order received',
      liveShowCode: 'Show this code at pickup:',
      liveTrack: 'Track my order',
      liveDone: 'Done',
      liveEnterNameAndWa: 'Please enter your name and WhatsApp number',
      liveAddrRequired: 'Please enter the delivery address',
      liveBlocked: 'Ordering is paused for now — feel free to browse the menu.',
      liveLoadError: 'Could not load the menu — check your connection and retry.',
      liveNotFound: 'Restaurant not found.',
    },
  };

  /* ------------------------------ state ---------------------------- */
  var state = {
    language: 'ar',
    category: 'all',
    query: '',
    fulfillment: 'pickup',
    cart: [],
    modalDishId: null,
    modalSelections: {},
    modalQuantity: 1,
    cartOpen: false,
    checkoutOpen: false,
    placing: false,
    placedOrder: null,
    previousFocus: null,
    toastTimer: null,
    coverIndex: 0,
    coverTimer: null,
    coverPaused: false,
  };
  var view = null;
  var dishes = [];
  var categories = [{ id: 'all', label: null, emoji: '🍽️' }];
  var coverSlides = [];
  var FALLBACK_IMG = '/demo/images/restivo-food-table.jpg';

  function currency() {
    return (view && view.settings && view.settings.currency) || 'USD';
  }
  function money(cents) {
    if (App.fmtMoney) {
      try {
        return App.fmtMoney(cents, currency(), state.language);
      } catch (_) { /* fall through */ }
    }
    try {
      return new Intl.NumberFormat(state.language === 'ar' ? 'ar' : 'en', {
        style: 'currency', currency: currency(), maximumFractionDigits: 2,
      }).format((cents || 0) / 100);
    } catch (_) {
      return (((cents || 0) / 100).toFixed(2) + ' ' + currency());
    }
  }

  /* ----------------------------- helpers --------------------------- */
  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function getCopy(key) { return copy[state.language][key] || copy.en[key] || key; }
  function localize(value) {
    if (typeof value === 'string') return value;
    if (!value) return '';
    return value[state.language] || value.en || value.ar || '';
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }
  function emojiFor(name) {
    var s = String(name || '').toLowerCase();
    if (/burger|برجر|برغر|همبرجر/.test(s)) return '🍔';
    if (/drink|cola|juice|shake|lemon|coffee|tea|عصير|كولا|مشروب|شاي|قهوة|ليمون|ميلك/.test(s)) return '🥤';
    if (/side|fries|ring|chip|بطاطا|جانب|مقبل|حلقات/.test(s)) return '🍟';
    if (/sweet|dessert|cake|cookie|brownie|ice|shake|حلو|كيك|كوكي|براوني|آيس|بوظة/.test(s)) return '🍦';
    return '🍽️';
  }

  /* --------------------------- live mapping ------------------------ */
  function mapView(data) {
    view = data;
    var settings = data.settings || {};
    // Honor the business storefront language (settings.storefrontLanguage).
    if (settings.storefrontLanguage === 'en' || settings.storefrontLanguage === 'ar') {
      state.language = settings.storefrontLanguage;
    }
    categories = [{ id: 'all', label: null, emoji: '🍽️' }].concat(
      (data.categories || []).map(function (c) {
        return { id: String(c.id), label: c.name, emoji: emojiFor(c.name) };
      })
    );
    dishes = (data.items || []).filter(function (it) { return it.is_available !== false; }).map(function (it) {
      var imgs = it.images && it.images.length ? it.images : (it.image_path ? [it.image_path] : []);
      return {
        id: String(it.id),
        category: String(it.category_id),
        name: { ar: it.name, en: it.name },
        description: { ar: it.description || '', en: it.description || '' },
        priceCents: Number(it.price_cents) || 0,
        image: imgs[0] || FALLBACK_IMG,
        tag: it.is_popular ? 'bestSeller' : null,
        popular: !!it.is_popular,
        options: (it.options || []).map(function (g) {
          return {
            id: String(g.id),
            required: !!g.is_required,
            label: { ar: g.name, en: g.name },
            choices: (g.choices || []).filter(function (c) { return c.is_available !== false; }).map(function (c) {
              return { id: String(c.id), label: { ar: c.name, en: c.name }, extraCents: Number(c.price_cents) || 0 };
            }),
          };
        }).filter(function (g) { return g.choices.length > 0; }),
      };
    });
    var heroes = data.heroImages || [];
    if (heroes.length) {
      coverSlides = heroes.map(function (h) {
        return { image: h.imagePath, alt: { ar: data.name, en: data.name } };
      });
    } else if (settings.coverPath) {
      coverSlides = [{ image: settings.coverPath, alt: { ar: data.name, en: data.name } }];
    } else {
      coverSlides = [
        { image: '/demo/images/red-bun-campaign-1.jpg', alt: { ar: data.name, en: data.name } },
        { image: '/demo/images/red-bun-campaign-2.jpg', alt: { ar: data.name, en: data.name } },
      ];
    }
    var logo = $('#restaurantLogo');
    if (logo && settings.logoPath) logo.src = settings.logoPath;
    // Drop cart lines for dishes that no longer exist.
    state.cart = state.cart.filter(function (line) { return getDish(line.dishId); });
  }

  /* ------------------------------ cover ---------------------------- */
  function showCover(index) {
    if (!coverSlides.length) return;
    state.coverIndex = ((index % coverSlides.length) + coverSlides.length) % coverSlides.length;
    $$('.cover-slide').forEach(function (slide, slideIndex) {
      var active = slideIndex === state.coverIndex;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    $$('.cover-dot').forEach(function (dot, dotIndex) {
      var active = dotIndex === state.coverIndex;
      dot.classList.toggle('is-active', active);
      if (active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }
  function startCoverAutoplay() {
    window.clearInterval(state.coverTimer);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    state.coverTimer = window.setInterval(function () {
      if (!state.coverPaused && !document.hidden) showCover(state.coverIndex + 1);
    }, 5200);
  }
  function navigateCover(index) { showCover(index); startCoverAutoplay(); }
  function initializeCoverCarousel() {
    var carousel = $('#coverCarousel');
    if (!carousel) return;
    $('#coverTrack').innerHTML = coverSlides.map(function (slide, index) {
      return '<div class="cover-slide' + (index === 0 ? ' is-active' : '') + '" aria-hidden="' + (index !== 0) + '"' +
        ' aria-roledescription="slide" aria-label="' + (index + 1) + ' / ' + coverSlides.length + '">' +
        '<img src="' + escapeHTML(slide.image) + '" alt="' + escapeHTML(localize(slide.alt)) + '"' +
        (index === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + ' /></div>';
    }).join('');
    $('#coverPagination').innerHTML = coverSlides.map(function (_, index) {
      return '<button class="cover-dot' + (index === 0 ? ' is-active' : '') + '" type="button"' +
        ' data-cover-index="' + index + '" aria-label="' + escapeHTML(getCopy('showCover')) + ' ' + (index + 1) + '"' +
        (index === 0 ? ' aria-current="true"' : '') + '></button>';
    }).join('');
    showCover(0);
    if (carousel.dataset.wired) return;
    carousel.dataset.wired = '1';
    carousel.addEventListener('click', function (event) {
      var control = event.target.closest('[data-cover-step], [data-cover-index]');
      if (!control) return;
      if (control.hasAttribute('data-cover-step')) navigateCover(state.coverIndex + Number(control.dataset.coverStep));
      else navigateCover(Number(control.dataset.coverIndex));
    });
    carousel.addEventListener('pointerenter', function () { state.coverPaused = true; });
    carousel.addEventListener('pointerleave', function () { state.coverPaused = false; });
    carousel.addEventListener('focusin', function () { state.coverPaused = true; });
    carousel.addEventListener('focusout', function (event) {
      if (!carousel.contains(event.relatedTarget)) state.coverPaused = false;
    });
    var touchStartX = null;
    carousel.addEventListener('touchstart', function (event) {
      touchStartX = (event.changedTouches[0] && event.changedTouches[0].clientX) || null;
    }, { passive: true });
    carousel.addEventListener('touchend', function (event) {
      if (touchStartX === null) return;
      var distance = event.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(distance) > 45) navigateCover(state.coverIndex + (distance < 0 ? 1 : -1));
    }, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) window.clearInterval(state.coverTimer);
      else startCoverAutoplay();
    });
    startCoverAutoplay();
  }

  /* --------------------------- menu render ------------------------- */
  function categoryLabel(cat) {
    if (cat.id === 'all') return getCopy('all');
    return cat.label || cat.id;
  }
  function categoryMarkup() {
    return categories.map(function (category) {
      var active = state.category === category.id;
      var count = category.id === 'all'
        ? dishes.length
        : dishes.filter(function (dish) { return dish.category === category.id; }).length;
      return '<button class="category-pill' + (active ? ' active' : '') + '" type="button"' +
        ' data-category="' + escapeHTML(category.id) + '" aria-pressed="' + active + '">' +
        '<span class="category-emoji" aria-hidden="true">' + category.emoji + '</span>' +
        '<span>' + escapeHTML(categoryLabel(category)) + '</span>' +
        '<span class="category-count">' + count + '</span></button>';
    }).join('');
  }
  function initializeCategoryDock() {
    var strip = $('#categoryStrip');
    var sentinel = $('#categoryDockSentinel');
    if (!strip || !sentinel || strip.dataset.wired) return;
    strip.dataset.wired = '1';
    var frameQueued = false;
    var isCompact = false;
    function updateCompactState() {
      frameQueued = false;
      var sentinelTop = sentinel.getBoundingClientRect().top;
      if (!isCompact && sentinelTop < -6) isCompact = true;
      else if (isCompact && sentinelTop > 6) isCompact = false;
      strip.classList.toggle('is-compact', isCompact);
    }
    function queueUpdate() {
      if (frameQueued) return;
      frameQueued = true;
      window.requestAnimationFrame(updateCompactState);
    }
    window.addEventListener('scroll', queueUpdate, { passive: true });
    window.addEventListener('resize', queueUpdate);
    queueUpdate();
  }
  function dishMarkup(dish) {
    var name = localize(dish.name);
    var hasOptions = dish.options.length > 0;
    var quickLabel = hasOptions ? getCopy('options') : getCopy('addToOrder');
    var tag = dish.tag
      ? '<span class="dish-tag"><span aria-hidden="true">' + (dish.tag === 'bestSeller' ? '🔥' : '🌿') + '</span>' +
        escapeHTML(getCopy(dish.tag)) + '</span>'
      : '';
    return '<article class="dish-card dish-row">' +
      '<button class="dish-photo" type="button" data-open-dish="' + escapeHTML(dish.id) + '" aria-label="' + escapeHTML(name) + '">' +
      '<img src="' + escapeHTML(dish.image) + '" alt="' + escapeHTML(name) + '" loading="lazy" />' + tag + '</button>' +
      '<button class="add-quick" type="button" data-quick-add="' + escapeHTML(dish.id) + '" aria-label="' + escapeHTML(quickLabel) + '">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg></button>' +
      '<button class="dish-content" type="button" data-open-dish="' + escapeHTML(dish.id) + '">' +
      '<span class="dish-title-row"><span class="dish-name">' + escapeHTML(name) + '</span>' +
      '<span class="dish-price">' + escapeHTML(money(dish.priceCents)) + '</span></span>' +
      '<span class="dish-description">' + escapeHTML(localize(dish.description)) + '</span>' +
      '<span class="dish-foot"><span class="food-markers"><span class="food-dot" aria-hidden="true"></span>' +
      escapeHTML(getCopy('tableService')) + '</span><span>' +
      escapeHTML(hasOptions ? getCopy('options') : getCopy('addToOrder')) + '</span></span></button></article>';
  }
  function normalizeSearch(value) {
    return String(value || '').trim().toLocaleLowerCase().replace(/[ً-ٰٟ]/g, '');
  }
  function renderMenu() {
    var strip = $('#categoryStrip');
    if (strip) strip.innerHTML = categoryMarkup();
    var query = normalizeSearch(state.query);
    var visibleDishes = dishes.filter(function (dish) {
      var categoryMatches = state.category === 'all' || dish.category === state.category;
      if (!categoryMatches) return false;
      if (!query) return true;
      var searchable = normalizeSearch([
        dish.name.ar, dish.name.en, dish.description.ar, dish.description.en,
      ].join(' '));
      return searchable.indexOf(query) !== -1;
    });
    var grid = $('#dishGrid');
    if (!grid) return;
    grid.setAttribute('aria-busy', 'false');
    if (!visibleDishes.length) {
      grid.innerHTML = '<div class="no-results"><span class="no-results-mark" aria-hidden="true"></span>' +
        '<h3>' + escapeHTML(getCopy('noResultsTitle')) + '</h3>' +
        '<p>' + escapeHTML(getCopy('noResultsText')) + '</p></div>';
      return;
    }
    var visibleSections = categories
      .filter(function (category) { return category.id !== 'all'; })
      .map(function (category) {
        return {
          id: category.id, emoji: category.emoji, label: categoryLabel(category),
          items: visibleDishes.filter(function (dish) { return dish.category === category.id; }),
        };
      })
      .filter(function (category) { return category.items.length > 0; });
    // Dishes whose category vanished from the backend still render.
    var orphaned = visibleDishes.filter(function (dish) {
      return !visibleSections.some(function (s) { return s.id === dish.category; });
    });
    if (orphaned.length) {
      visibleSections.push({ id: 'all', emoji: '🍽️', label: getCopy('all'), items: orphaned });
    }
    grid.innerHTML = visibleSections.map(function (category) {
      return '<section class="dish-section" aria-labelledby="section-' + escapeHTML(category.id) + '">' +
        '<div class="dish-section-heading"><h3 id="section-' + escapeHTML(category.id) + '">' +
        '<span class="section-emoji" aria-hidden="true">' + category.emoji + '</span>' +
        '<span>' + escapeHTML(category.label) + '</span></h3>' +
        '<span class="section-count">' + category.items.length + '</span></div>' +
        '<div class="dish-list">' + category.items.map(dishMarkup).join('') + '</div></section>';
    }).join('');
  }
  function getDish(dishId) {
    return dishes.filter(function (dish) { return dish.id === String(dishId); })[0] || null;
  }
  function getSelectedChoices(dish, selections) {
    selections = selections || {};
    var out = [];
    dish.options.forEach(function (group) {
      (selections[group.id] || []).forEach(function (choiceId) {
        var choice = null;
        group.choices.forEach(function (item) { if (item.id === choiceId) choice = item; });
        if (choice) out.push({ group: group, choice: choice });
      });
    });
    return out;
  }
  function selectedTotalCents(dish, selections) {
    return dish.priceCents + getSelectedChoices(dish, selections).reduce(function (sum, entry) {
      return sum + entry.choice.extraCents;
    }, 0);
  }
  function getModalValidity(dish) {
    return dish.options.every(function (group) {
      return !group.required || (state.modalSelections[group.id] || []).length > 0;
    });
  }

  /* ------------------------------- modal --------------------------- */
  function openDish(dishId, trigger) {
    var dish = getDish(dishId);
    if (!dish) return;
    state.previousFocus = trigger || document.activeElement;
    state.modalDishId = dish.id;
    state.modalSelections = {};
    state.modalQuantity = 1;
    state.cartOpen = false;
    renderCartDrawer();
    renderModal();
    document.body.classList.add('overlay-open');
    requestAnimationFrame(function () { var c = $('.dish-modal-close'); if (c) c.focus(); });
  }
  function closeDish() {
    if (!state.modalDishId) return;
    state.modalDishId = null;
    $('#modalRoot').innerHTML = '';
    document.body.classList.remove('overlay-open');
    if (state.previousFocus && state.previousFocus.focus) {
      try { state.previousFocus.focus(); } catch (_) { /* ignore */ }
    }
  }
  function modalMarkup(dish) {
    var selected = state.modalSelections;
    var optionsMarkup = dish.options.map(function (group) {
      var isRadio = group.required;
      var selectedIds = selected[group.id] || [];
      var choices = group.choices.map(function (choice) {
        var inputType = isRadio ? 'radio' : 'checkbox';
        var checked = selectedIds.indexOf(choice.id) !== -1;
        var amount = choice.extraCents ? '+ ' + money(choice.extraCents) : '';
        return '<label class="option-choice"><span><input type="' + inputType + '" name="option-' + escapeHTML(group.id) + '"' +
          ' value="' + escapeHTML(choice.id) + '" data-option-choice data-group="' + escapeHTML(group.id) + '"' +
          ' data-choice="' + escapeHTML(choice.id) + '"' + (checked ? ' checked' : '') + ' />' +
          '<span>' + escapeHTML(localize(choice.label)) + '</span></span>' +
          (amount ? '<span class="choice-price">' + escapeHTML(amount) + '</span>' : '') + '</label>';
      }).join('');
      return '<fieldset class="option-section"><legend class="option-heading"><strong>' +
        escapeHTML(localize(group.label)) + '</strong>' +
        '<span class="' + (group.required ? 'required-pill' : 'optional-pill') + '">' +
        escapeHTML(getCopy(group.required ? 'required' : 'optional')) + '</span></legend>' + choices + '</fieldset>';
    }).join('');
    var selectedPrice = selectedTotalCents(dish, selected) * state.modalQuantity;
    var valid = getModalValidity(dish);
    var title = localize(dish.name);
    return '<div class="modal-backdrop" data-close-modal><section class="dish-modal" role="dialog"' +
      ' aria-modal="true" aria-labelledby="modalTitle" tabindex="-1"><div class="modal-image">' +
      '<img src="' + escapeHTML(dish.image) + '" alt="' + escapeHTML(title) + '" />' +
      (dish.tag ? '<span class="dish-tag">' + escapeHTML(getCopy(dish.tag)) + '</span>' : '') + '</div>' +
      '<div class="modal-body"><button class="close-modal dish-modal-close" type="button" data-close-modal' +
      ' aria-label="' + escapeHTML(getCopy('close')) + '">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button>' +
      '<p class="section-kicker">' + escapeHTML(getCopy('options')) + '</p>' +
      '<h2 id="modalTitle">' + escapeHTML(title) + '</h2>' +
      '<p class="modal-description">' + escapeHTML(localize(dish.description)) + '</p>' +
      '<div class="modal-base-price">' + escapeHTML(money(dish.priceCents)) + '</div>' +
      (optionsMarkup ? '<div class="modal-options">' + optionsMarkup + '</div>' : '') +
      '<div class="modal-actions"><div class="modal-quantity" aria-label="' + escapeHTML(title) + '">' +
      '<button type="button" data-modal-quantity="-1" aria-label="' + escapeHTML(getCopy('decrease')) + '">−</button>' +
      '<span id="modalQuantity">' + state.modalQuantity + '</span>' +
      '<button type="button" data-modal-quantity="1" aria-label="' + escapeHTML(getCopy('increase')) + '">+</button></div>' +
      '<button class="add-to-cart" type="button" data-add-modal' + (valid ? '' : ' disabled') + '>' +
      '<span>' + escapeHTML(valid ? getCopy('addToOrder') : getCopy('chooseOption')) + '</span>' +
      '<strong id="modalTotal">' + escapeHTML(money(selectedPrice)) + '</strong></button></div></div></section></div>';
  }
  function renderModal() {
    var dish = state.modalDishId ? getDish(state.modalDishId) : null;
    if (!dish) { $('#modalRoot').innerHTML = ''; return; }
    $('#modalRoot').innerHTML = modalMarkup(dish);
  }
  function updateModalSummary() {
    var dish = getDish(state.modalDishId);
    if (!dish) return;
    var valid = getModalValidity(dish);
    var addButton = $('[data-add-modal]');
    if (!addButton) return;
    addButton.disabled = !valid;
    addButton.querySelector('span').textContent = valid ? getCopy('addToOrder') : getCopy('chooseOption');
    $('#modalTotal').textContent = money(selectedTotalCents(dish, state.modalSelections) * state.modalQuantity);
  }
  function addDishToCart(dishId, selections, quantity) {
    var dish = getDish(dishId);
    if (!dish) return;
    selections = selections || {};
    quantity = quantity || 1;
    var orderedIds = getSelectedChoices(dish, selections).map(function (entry) { return entry.choice.id; });
    orderedIds.sort();
    var key = dish.id + '|' + orderedIds.join(',');
    var existing = null;
    state.cart.forEach(function (line) { if (line.key === key) existing = line; });
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + quantity);
    } else {
      var copySel = {};
      Object.keys(selections).forEach(function (groupId) { copySel[groupId] = selections[groupId].slice(); });
      state.cart.push({ key: key, dishId: dish.id, selections: copySel, quantity: quantity });
    }
    state.checkoutOpen = false;
    saveCart();
    renderCart();
    toastMsg(getCopy('cartAdded'));
  }
  function cartCount() {
    return state.cart.reduce(function (sum, line) { return sum + line.quantity; }, 0);
  }
  function cartSubtotalCents() {
    return state.cart.reduce(function (sum, line) {
      var dish = getDish(line.dishId);
      return dish ? sum + selectedTotalCents(dish, line.selections) * line.quantity : sum;
    }, 0);
  }
  function deliveryFeeCents() {
    if (state.fulfillment !== 'delivery') return 0;
    if (cartCount() === 0) return 0;
    return Number(view && view.settings && view.settings.deliveryFeeCents) || 0;
  }
  function orderingBlocked() {
    return !!(view && view.orderingBlocked);
  }

  /* -------------------------------- cart --------------------------- */
  function lineOptionText(dish, selections) {
    return getSelectedChoices(dish, selections).map(function (entry) {
      return localize(entry.choice.label);
    }).join(' · ');
  }
  function cartLinesMarkup() {
    return state.cart.map(function (line) {
      var dish = getDish(line.dishId);
      if (!dish) return '';
      var name = localize(dish.name);
      var options = lineOptionText(dish, line.selections);
      var unitPrice = selectedTotalCents(dish, line.selections);
      return '<div class="cart-line"><div class="cart-line-main"><div class="cart-line-heading">' +
        '<p class="cart-line-name">' + escapeHTML(name) + '</p>' +
        '<strong class="line-price">' + escapeHTML(money(unitPrice * line.quantity)) + '</strong></div>' +
        (options ? '<p class="cart-line-options">' + escapeHTML(options) + '</p>' : '') +
        '<div class="quantity-control">' +
        '<button type="button" data-cart-delta="-1" data-line="' + escapeHTML(line.key) + '"' +
        ' aria-label="' + escapeHTML(getCopy('decrease')) + '">−</button>' +
        '<span aria-live="polite">' + line.quantity + '</span>' +
        '<button type="button" data-cart-delta="1" data-line="' + escapeHTML(line.key) + '"' +
        ' aria-label="' + escapeHTML(getCopy('increase')) + '">+</button>' +
        '<button class="remove-line" type="button" data-remove-line="' + escapeHTML(line.key) + '">' +
        escapeHTML(getCopy('remove')) + '</button></div></div></div>';
    }).join('');
  }
  function checkoutFormMarkup() {
    if (!state.checkoutOpen) return '';
    var delivery = state.fulfillment === 'delivery';
    return '<div class="co-form">' +
      '<label class="co-field"><span>' + escapeHTML(getCopy('liveName')) + '</span>' +
      '<input id="coName" name="customerName" autocomplete="name" maxlength="80" /></label>' +
      '<label class="co-field"><span>' + escapeHTML(getCopy('liveWhatsapp')) + '</span>' +
      '<input id="coWhatsapp" name="customerWhatsapp" type="tel" autocomplete="tel" maxlength="20" dir="ltr" /></label>' +
      (delivery
        ? '<label class="co-field"><span>' + escapeHTML(getCopy('liveAddress')) + '</span>' +
          '<input id="coAddress" name="customerAddress" autocomplete="street-address" maxlength="200" /></label>'
        : '') +
      '<label class="co-field"><span>' + escapeHTML(getCopy('liveNotes')) + '</span>' +
      '<input id="coNotes" name="notes" maxlength="400" /></label>' +
      '<p class="co-error" id="coError" hidden></p></div>';
  }
  function cartMarkup() {
    // Order-confirmation state keeps the same panel so the design never shifts.
    if (state.placedOrder) {
      var code = state.placedOrder.code || '';
      return '<div class="cart-head"><div><p class="section-kicker">' + escapeHTML(getCopy('order')) + '</p>' +
        '<h2 class="cart-title">' + escapeHTML(getCopy('liveOrderSent')) + '</h2></div></div>' +
        '<div class="cart-empty"><strong class="co-code">' + escapeHTML(code) + '</strong>' +
        '<p>' + escapeHTML(getCopy('liveShowCode')) + '</p></div>' +
        '<div class="totals"><a class="checkout-demo" style="text-decoration:none"' +
        ' href="/track?code=' + encodeURIComponent(code) + '"><span>' + escapeHTML(getCopy('liveTrack')) + '</span>' +
        '<span>' + escapeHTML(code) + '</span></a>' +
        '<button class="checkout-demo co-ghost-btn" type="button" data-new-order>' +
        '<span>' + escapeHTML(getCopy('liveDone')) + '</span><span></span></button></div>';
    }
    var count = cartCount();
    var subtotal = cartSubtotalCents();
    var fee = deliveryFeeCents();
    var isEmpty = count === 0;
    var blocked = orderingBlocked();
    var footnote = blocked ? getCopy('liveBlocked') : getCopy('tableService');
    return '<div class="cart-head"><div><p class="section-kicker">' + escapeHTML(getCopy('order')) + '</p>' +
      '<h2 class="cart-title">' + escapeHTML(getCopy('yourOrder')) + '</h2></div>' +
      '<span class="cart-count">' + count + '</span></div>' +
      '<div class="fulfillment" role="group" aria-label="' + escapeHTML(getCopy('yourOrder')) + '">' +
      '<button type="button" data-fulfillment="pickup"' +
      ' class="' + (state.fulfillment === 'pickup' ? 'selected' : '') + '"' +
      ' aria-pressed="' + (state.fulfillment === 'pickup') + '">' + escapeHTML(getCopy('pickup')) + '</button>' +
      '<button type="button" data-fulfillment="delivery"' +
      ' class="' + (state.fulfillment === 'delivery' ? 'selected' : '') + '"' +
      ' aria-pressed="' + (state.fulfillment === 'delivery') + '">' + escapeHTML(getCopy('delivery')) + '</button></div>' +
      (isEmpty
        ? '<div class="cart-empty"><span class="empty-illustration" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1.2 12H6.2L5 8Zm4 0V6a3 3 0 0 1 6 0v2" /></svg></span>' +
          '<strong>' + escapeHTML(getCopy('emptyTitle')) + '</strong><p>' + escapeHTML(getCopy('emptyText')) + '</p></div>'
        : '<div class="cart-lines">' + cartLinesMarkup() + '</div>' +
          '<div class="totals"><div class="total-row"><span>' + escapeHTML(getCopy('subtotal')) + '</span>' +
          '<strong>' + escapeHTML(money(subtotal)) + '</strong></div>' +
          (state.fulfillment === 'delivery'
            ? '<div class="total-row"><span>' + escapeHTML(getCopy('deliveryFee')) + '</span>' +
              '<strong>' + escapeHTML(fee ? money(fee) : getCopy('free')) + '</strong></div>'
            : '') +
          '<div class="total-row grand"><span>' + escapeHTML(getCopy('total')) + '</span>' +
          '<strong>' + escapeHTML(money(subtotal + fee)) + '</strong></div>' +
          checkoutFormMarkup() +
          '<button class="checkout-demo" type="button" data-live-checkout' +
          (blocked || state.placing ? ' disabled' : '') + '>' +
          '<span>' + escapeHTML(state.placing ? getCopy('liveSending') : (state.checkoutOpen ? getCopy('livePlaceOrder') : getCopy('continueCheckout'))) + '</span>' +
          '<span>' + escapeHTML(money(subtotal + fee)) + '</span></button></div>') +
      '<p class="prototype-footnote">' + escapeHTML(footnote) + '</p>';
  }
  function renderCart() {
    var panel = $('#desktopCart');
    if (panel) panel.innerHTML = cartMarkup();
    var headerCount = $('#headerCartCount');
    if (headerCount) headerCount.textContent = String(cartCount());
    var mobileBar = $('#mobileCartBar');
    if (mobileBar) {
      mobileBar.hidden = cartCount() === 0;
      mobileBar.setAttribute('aria-expanded', String(state.cartOpen));
      var mc = $('.mobile-cart-count');
      if (mc) mc.textContent = String(cartCount());
      var mt = $('.mobile-cart-total');
      if (mt) mt.textContent = money(cartSubtotalCents() + deliveryFeeCents());
    }
    renderCartDrawer();
  }
  function renderCartDrawer() {
    var root = $('#cartDrawerRoot');
    if (!root) return;
    if (!state.cartOpen) { root.innerHTML = ''; return; }
    root.innerHTML = '<div class="cart-drawer" data-close-cart><aside class="cart-drawer-inner" role="dialog"' +
      ' aria-modal="true" aria-labelledby="drawerTitle" tabindex="-1"><div class="drawer-heading">' +
      '<h2 id="drawerTitle">' + escapeHTML(getCopy('yourOrder')) + '</h2>' +
      '<button type="button" data-close-cart aria-label="' + escapeHTML(getCopy('closeOrder')) + '">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button></div>' +
      '<div class="drawer-content">' + cartMarkup() + '</div></aside></div>';
    document.body.classList.add('overlay-open');
  }
  function openCart() {
    closeDish();
    state.previousFocus = document.activeElement;
    state.cartOpen = true;
    renderCartDrawer();
    requestAnimationFrame(function () {
      var btn = $("#cartDrawerRoot [role='dialog'] .drawer-heading button");
      if (btn) btn.focus();
    });
  }
  function closeCart() {
    if (!state.cartOpen) return;
    state.cartOpen = false;
    var root = $('#cartDrawerRoot');
    if (root) root.innerHTML = '';
    if (!state.modalDishId) document.body.classList.remove('overlay-open');
    if (state.previousFocus && state.previousFocus.focus) {
      try { state.previousFocus.focus(); } catch (_) { /* ignore */ }
    }
  }
  function changeCartLine(key, delta) {
    var line = null;
    state.cart.forEach(function (item) { if (item.key === key) line = item; });
    if (!line) return;
    line.quantity += delta;
    if (line.quantity <= 0) {
      state.cart = state.cart.filter(function (item) { return item.key !== key; });
    } else {
      line.quantity = Math.min(99, line.quantity);
    }
    saveCart();
    renderCart();
  }
  function toastMsg(message) {
    if (App.toast) {
      try { App.toast(message); return; } catch (_) { /* fall through */ }
    }
    var zone = $('#toastZone');
    if (!zone) return;
    zone.innerHTML = '';
    var element = document.createElement('div');
    element.className = 'demo-toast';
    element.textContent = message;
    zone.append(element);
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () { element.remove(); }, 2600);
  }

  /* ------------------------------ checkout ------------------------- */
  function cartKey() { return 'ordora_cart_' + slug; }
  function saveCart() {
    try { localStorage.setItem(cartKey(), JSON.stringify(state.cart)); } catch (_) { /* ignore */ }
  }
  function loadCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(cartKey()) || '[]');
      if (!Array.isArray(raw)) return;
      state.cart = raw.filter(function (line) {
        return line && typeof line.key === 'string' && Number.isInteger(line.quantity) &&
          line.quantity > 0 && line.quantity <= 99 && typeof line.dishId === 'string';
      });
    } catch (_) { /* ignore */ }
  }
  function coError(message) {
    $$('#desktopCart #coError, #cartDrawerRoot #coError').forEach(function (box) {
      if (!message) { box.hidden = true; return; }
      box.textContent = message;
      box.hidden = false;
    });
  }
  function submitKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'key-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
  }
  function handleCheckout() {
    if (orderingBlocked() || state.placing || cartCount() === 0) return;
    if (!state.checkoutOpen) {
      state.checkoutOpen = true;
      renderCart();
      var input = $('#cartDrawerRoot #coName') || $('#desktopCart #coName');
      if (input) input.focus();
      return;
    }
    var root = state.cartOpen ? $('#cartDrawerRoot') : $('#desktopCart');
    var name = root ? root.querySelector('#coName') : null;
    var wa = root ? root.querySelector('#coWhatsapp') : null;
    var address = root ? root.querySelector('#coAddress') : null;
    var notes = root ? root.querySelector('#coNotes') : null;
    var customerName = name ? name.value.trim() : '';
    var customerWhatsapp = wa ? wa.value.trim() : '';
    var customerAddress = address ? address.value.trim() : '';
    if (!customerName || !customerWhatsapp) { coError(getCopy('liveEnterNameAndWa')); return; }
    if (state.fulfillment === 'delivery' && !customerAddress) { coError(getCopy('liveAddrRequired')); return; }
    coError(null);
    state.placing = true;
    renderCart();
    api.post('/api/restaurants/' + encodeURIComponent(slug) + '/orders', {
      customerName: customerName,
      customerWhatsapp: customerWhatsapp,
      customerPhone: '',
      customerAddress: customerAddress,
      notes: notes ? notes.value.trim() : '',
      orderType: state.fulfillment,
      submissionKey: submitKey(),
      items: state.cart.map(function (line) {
        var dish = getDish(line.dishId);
        var selections = [];
        Object.keys(line.selections || {}).forEach(function (groupId) {
          selections.push({
            groupId: groupId,
            choices: line.selections[groupId].map(function (choiceId) {
              return { choiceId: choiceId, quantity: 1 };
            }),
          });
        });
        return { itemId: dish ? dish.id : line.dishId, quantity: line.quantity, selections: selections };
      }),
    }).then(function (data) {
      state.placing = false;
      state.checkoutOpen = false;
      state.cart = [];
      saveCart();
      state.placedOrder = (data && data.order) || { code: '' };
      renderCart();
    }).catch(function (err) {
      state.placing = false;
      renderCart();
      coError(err && err.message ? err.message : getCopy('liveLoadError'));
    });
  }

  /* ------------------------------- share --------------------------- */
  function shareMenu() {
    var name = view ? view.name : document.title;
    var shareData = { title: name, text: name, url: window.location.href };
    function done() { toastMsg(getCopy('linkCopied')); }
    if (navigator.share) {
      navigator.share(shareData).catch(function (error) {
        if (error && error.name !== 'AbortError') toastMsg(getCopy('shareError'));
      });
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareData.url).then(done, function () {
        toastMsg(getCopy('shareError'));
      });
      return;
    }
    toastMsg(getCopy('shareError'));
  }

  /* ---------------------------- static copy ------------------------ */
  function updateStaticCopy() {
    document.documentElement.lang = state.language;
    document.documentElement.dir = state.language === 'ar' ? 'rtl' : 'ltr';
    if (view) document.title = view.name;
    $$('[data-copy]').forEach(function (element) {
      element.textContent = getCopy(element.dataset.copy);
    });
    // Live overrides (after the generic pass so real data wins).
    $('#restaurantName').textContent = view ? view.name : '…';
    var desc = $('#restaurantName').parentElement.querySelector('.hero-description');
    if (desc && view && view.settings && view.settings.description) desc.textContent = view.settings.description;
    var foot = $('.footer-copyright');
    if (foot && view) {
      foot.textContent = state.language === 'ar'
        ? '© 2026 ' + view.name + '. جميع الحقوق محفوظة.'
        : '© 2026 ' + view.name + '. All rights reserved.';
    }
    var eyebrow = $('#restaurantName').parentElement.querySelector('.eyebrow [data-copy]');
    if (eyebrow) {
      var open = !view || view.openNow !== false;
      eyebrow.textContent = open ? getCopy('openNow') : getCopy('closed');
      eyebrow.removeAttribute('data-copy');
    }
    var languageButton = $('#languageButton');
    if (languageButton) {
      languageButton.textContent = state.language === 'ar' ? 'EN' : 'عربي';
      languageButton.setAttribute('aria-label', state.language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
    }
    var shareButton = $('#shareButton');
    if (shareButton) shareButton.setAttribute('aria-label', getCopy('share'));
    var openCartButton = $('#openCartButton');
    if (openCartButton) openCartButton.setAttribute('aria-label', getCopy('order'));
    var desktopCart = $('#desktopCart');
    if (desktopCart) desktopCart.setAttribute('aria-label', getCopy('yourOrder'));
    var categoryStrip = $('#categoryStrip');
    if (categoryStrip) categoryStrip.setAttribute('aria-label', getCopy('categoryLabel'));
    var coverCarousel = $('#coverCarousel');
    if (coverCarousel) coverCarousel.setAttribute('aria-label', getCopy('coverLabel'));
    var coverPrevious = $('#coverPrevious');
    if (coverPrevious) coverPrevious.setAttribute('aria-label', getCopy('previousCover'));
    var coverNext = $('#coverNext');
    if (coverNext) coverNext.setAttribute('aria-label', getCopy('nextCover'));
    $$('.cover-dot').forEach(function (dot) {
      dot.setAttribute('aria-label', getCopy('showCover') + ' ' + (Number(dot.dataset.coverIndex) + 1));
    });
    $$('.cover-slide img').forEach(function (image, index) {
      if (coverSlides[index]) image.alt = localize(coverSlides[index].alt);
    });
    var search = $('#menuSearch');
    if (search) {
      search.placeholder = getCopy('searchPlaceholder');
      search.setAttribute('aria-label', getCopy('searchLabel'));
      if (document.activeElement !== search) search.value = state.query;
    }
  }
  function setLanguage(language) {
    if (language === state.language) return;
    state.language = language;
    updateStaticCopy();
    renderMenu();
    renderCart();
    if (state.modalDishId) renderModal();
  }

  /* -------------------------------- events ------------------------- */
  document.addEventListener('click', function (event) {
    var button = event.target.closest('button, a');
    if (!button) {
      if (event.target.matches('[data-close-modal]')) closeDish();
      if (event.target.matches('[data-close-cart]')) closeCart();
      return;
    }
    if (button.id === 'languageButton') {
      setLanguage(state.language === 'ar' ? 'en' : 'ar');
      return;
    }
    if (button.id === 'shareButton') { shareMenu(); return; }
    if (button.id === 'openCartButton' || button.id === 'mobileCartBar') { openCart(); return; }
    if (button.dataset.category) {
      state.category = button.dataset.category;
      renderMenu();
      return;
    }
    if (button.dataset.openDish) { openDish(button.dataset.openDish, button); return; }
    if (button.dataset.quickAdd) {
      var dish = getDish(button.dataset.quickAdd);
      if (!dish) return;
      if (dish.options.length) openDish(dish.id, button);
      else addDishToCart(dish.id);
      return;
    }
    if (button.hasAttribute('data-close-modal')) { closeDish(); return; }
    if (button.hasAttribute('data-close-cart')) { closeCart(); return; }
    if (button.dataset.fulfillment) {
      state.fulfillment = button.dataset.fulfillment;
      state.checkoutOpen = false;
      renderCart();
      return;
    }
    if (button.dataset.cartDelta) {
      changeCartLine(button.dataset.line, Number(button.dataset.cartDelta));
      return;
    }
    if (button.dataset.removeLine) {
      state.cart = state.cart.filter(function (line) { return line.key !== button.dataset.removeLine; });
      saveCart();
      renderCart();
      return;
    }
    if (button.dataset.modalQuantity) {
      state.modalQuantity = Math.max(1, state.modalQuantity + Number(button.dataset.modalQuantity));
      var qty = $('#modalQuantity');
      if (qty) qty.textContent = String(state.modalQuantity);
      updateModalSummary();
      return;
    }
    if (button.hasAttribute('data-add-modal')) {
      var modalDish = getDish(state.modalDishId);
      if (!modalDish || !getModalValidity(modalDish)) return;
      addDishToCart(modalDish.id, state.modalSelections, state.modalQuantity);
      closeDish();
      return;
    }
    if (button.hasAttribute('data-live-checkout')) { handleCheckout(); return; }
    if (button.hasAttribute('data-new-order')) {
      state.placedOrder = null;
      renderCart();
      return;
    }
  });
  document.addEventListener('input', function (event) {
    if (event.target.id !== 'menuSearch') return;
    state.query = event.target.value;
    renderMenu();
  });
  document.addEventListener('change', function (event) {
    var input = event.target.closest('[data-option-choice]');
    if (!input || !state.modalDishId) return;
    var groupId = input.dataset.group;
    var choiceId = input.dataset.choice;
    var dish = getDish(state.modalDishId);
    if (!dish) return;
    var groupData = null;
    dish.options.forEach(function (item) { if (item.id === groupId) groupData = item; });
    if (!groupData) return;
    if (groupData.required) {
      state.modalSelections[groupId] = input.checked ? [choiceId] : [];
    } else {
      var current = state.modalSelections[groupId] || [];
      state.modalSelections[groupId] = input.checked
        ? current.concat([choiceId])
        : current.filter(function (item) { return item !== choiceId; });
    }
    updateModalSummary();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeDish(); closeCart(); return; }
    if (event.key !== 'Tab') return;
    var dialog = $('#modalRoot [role=\'dialog\'], #cartDrawerRoot [role=\'dialog\']');
    if (!dialog) return;
    var focusable = $$('button:not(:disabled), input:not(:disabled)', dialog)
      .filter(function (element) { return element.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener('error', function (event) {
    var image = event.target;
    if (!(image instanceof HTMLImageElement) || image.dataset.fallback === 'true') return;
    if (!image.matches('.dish-photo img, .modal-image img, .cover-slide img')) return;
    image.dataset.fallback = 'true';
    image.src = FALLBACK_IMG;
  }, true);

  /* --------------------------------- boot -------------------------- */
  loadCart();
  if (!slug) {
    $('#dishGrid').innerHTML = '<div class="no-results"><span class="no-results-mark" aria-hidden="true"></span>' +
      '<h3>' + escapeHTML(getCopy('liveNotFound')) + '</h3></div>';
  } else {
    api.get('/api/restaurants/' + encodeURIComponent(slug) + '/menu').then(function (data) {
      mapView(data);
      updateStaticCopy();
      initializeCoverCarousel();
      renderMenu();
      renderCart();
      initializeCategoryDock();
    }).catch(function () {
      $('#dishGrid').innerHTML = '<div class="no-results"><span class="no-results-mark" aria-hidden="true"></span>' +
        '<h3>' + escapeHTML(getCopy('liveLoadError')) + '</h3></div>';
    });
  }
  updateStaticCopy();
  renderMenu();
  renderCart();
})();
