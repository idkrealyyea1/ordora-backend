const copy = {
  ar: {
    previewLabel: "قائمة تجريبية",
    tableLabel: "الطاولة 08",
    share: "مشاركة",
    brandNote: "برغر مشوي. ناس طيبين.",
    order: "طلبك",
    openNow: "مفتوح الآن",
    restaurantDescription: "برغر طازج على الفحم، صوصاتنا الخاصة، وجمعة ما بتنمل.",
    ratingLabel: "من 280 تقييم",
    deliveryTime: "20–30 دقيقة",
    location: "يافا، فلسطين",
    coverLabel: "صور المطعم",
    previousCover: "الصورة السابقة",
    nextCover: "الصورة التالية",
    showCover: "عرض الصورة",
    menuKicker: "من الشواية، على طول",
    menuTitle: "قائمة ريد بن",
    menuDescription: "لحم طازج، خبز محمّص، وإضافات تخلّي كل قضمة أحلى.",
    searchLabel: "ابحث في القائمة",
    searchPlaceholder: "ابحث عن طبق تحبه",
    categoryLabel: "أقسام القائمة",
    popularRibbon: "اختيارات أحبّها ضيوفنا",
    footerCopyright: "© 2026 ذا ريد بن. جميع الحقوق محفوظة.",
    footerMade: "صُنع مع Ordora",
    viewOrder: "عرض الطلب",
    all: "كل الأصناف",
    burgers: "برغر",
    sides: "جانبيات",
    sweets: "حلويات",
    drinks: "مشروبات",
    bestSeller: "الأكثر طلبًا",
    vegetarian: "نباتي",
    noResultsTitle: "لم نجد هذا الطبق",
    noResultsText: "جرّب كلمة أخرى أو اختر قسمًا مختلفًا.",
    yourOrder: "طلبك",
    pickup: "استلام",
    delivery: "توصيل",
    emptyTitle: "طلبك يبدأ من هنا",
    emptyText: "اختر طبقًا من القائمة وسنضيفه إلى طلبك.",
    subtotal: "المجموع",
    deliveryFee: "رسوم التوصيل",
    free: "مجانًا",
    total: "الإجمالي",
    continueCheckout: "متابعة الطلب",
    checkoutDemo: "هذه معاينة فقط. لم يتم إرسال أي طلب.",
    close: "إغلاق",
    options: "اختر الإضافات",
    required: "مطلوب",
    optional: "اختياري",
    chooseOption: "اختر خيارًا للمتابعة",
    addToOrder: "أضف إلى الطلب",
    increase: "زيادة الكمية",
    decrease: "تقليل الكمية",
    remove: "إزالة",
    cartAdded: "أُضيف الطبق إلى طلبك",
    cartUpdated: "تم تحديث طلبك",
    linkCopied: "تم نسخ رابط القائمة",
    shareReady: "قائمة ذا ريد بن جاهزة للمشاركة",
    shareError: "تعذّرت مشاركة الرابط من هذا المتصفح",
    closeOrder: "إغلاق الطلب",
    tableService: "للطاولة 08",
    noOrders: "هذه معاينة تفاعلية ولا ترسل طلبات حقيقية.",
    currencyLocale: "ar-IL",
    titleSuffix: "قائمة ريد بن",
  },
  en: {
    previewLabel: "Menu preview",
    tableLabel: "Table 08",
    share: "Share",
    brandNote: "Made for good table moments",
    order: "Your order",
    openNow: "Open now",
    restaurantDescription: "Fresh-grilled burgers, house-made sauces, and the kind of company that makes you stay awhile.",
    ratingLabel: "from 280 reviews",
    deliveryTime: "20–30 min",
    location: "Jaffa, Palestine",
    coverLabel: "Restaurant cover photos",
    previousCover: "Previous cover photo",
    nextCover: "Next cover photo",
    showCover: "Show cover photo",
    menuKicker: "Straight off the grill",
    menuTitle: "The Red Bun menu",
    menuDescription: "Fresh beef, toasted buns, and the good stuff in every bite.",
    searchLabel: "Search the menu",
    searchPlaceholder: "Find something you love",
    categoryLabel: "Menu categories",
    popularRibbon: "Guest favorites",
    footerCopyright: "© 2026 The Red Bun. All rights reserved.",
    footerMade: "Made with Ordora",
    viewOrder: "View order",
    all: "Everything",
    burgers: "Burgers",
    sides: "Sides",
    sweets: "Sweets",
    drinks: "Drinks",
    bestSeller: "Guest favorite",
    vegetarian: "Vegetarian",
    noResultsTitle: "No dishes found",
    noResultsText: "Try a different search or browse another category.",
    yourOrder: "Your order",
    pickup: "Pickup",
    delivery: "Delivery",
    emptyTitle: "Your order starts here",
    emptyText: "Choose a dish from the menu and it will appear here.",
    subtotal: "Subtotal",
    deliveryFee: "Delivery",
    free: "Free",
    total: "Total",
    continueCheckout: "Continue to checkout",
    checkoutDemo: "This is only a preview. No order was sent.",
    close: "Close",
    options: "Make it yours",
    required: "Required",
    optional: "Optional",
    chooseOption: "Choose an option to continue",
    addToOrder: "Add to order",
    increase: "Increase quantity",
    decrease: "Decrease quantity",
    remove: "Remove",
    cartAdded: "Added to your order",
    cartUpdated: "Your order was updated",
    linkCopied: "Menu link copied",
    shareReady: "The Red Bun menu is ready to share",
    shareError: "This browser could not share the menu link",
    closeOrder: "Close order",
    tableService: "For table 08",
    noOrders: "This is an interactive preview; it does not send real orders.",
    currencyLocale: "en-IL",
    titleSuffix: "Burger Menu",
  },
};

const categories = [
  { id: "all", copyKey: "all", emoji: "🍽️" },
  { id: "burgers", copyKey: "burgers", emoji: "🍔" },
  { id: "sides", copyKey: "sides", emoji: "🍟" },
  { id: "drinks", copyKey: "drinks", emoji: "🥤" },
  { id: "sweets", copyKey: "sweets", emoji: "🍦" },
];

const dishes = [
  {
    id: "red-bun", category: "burgers", name: { ar: "ريد بن الأصلي", en: "The Red Bun" },
    description: { ar: "لحم بقري مشوي، شيدر ذايب، مخلل مقرمش، وصوص ريد بن داخل خبز بريوش محمّص.", en: "Grilled beef, melted cheddar, crisp pickles, and Red Bun sauce in a toasted brioche bun." },
    price: 54, image: "images/menu/photo-1568901346375-23c9450c58cd.jpg", tag: "bestSeller", popular: true,
    options: [{ id: "extras", required: false, label: { ar: "إضافات", en: "Make it extra" }, choices: [{ id: "cheese", label: { ar: "شريحة شيدر إضافية", en: "Extra cheddar" }, extra: 5 }, { id: "patty", label: { ar: "قطعة لحم إضافية", en: "Extra beef patty" }, extra: 18 }, { id: "jalapeno", label: { ar: "هالبينو", en: "Jalapeños" }, extra: 3 }] }],
  },
  {
    id: "smokehouse", category: "burgers", name: { ar: "سموكي هاوس", en: "Smokehouse Stack" },
    description: { ar: "قطعتا لحم، جبنة مدخنة، بصل مكرمل، وصوص باربكيو مدخن.", en: "Two beef patties, smoked cheese, caramelized onions, and smoky house barbecue." },
    price: 68, image: "images/menu/photo-1550547660-d9450f859349.jpg", tag: "bestSeller", popular: true, options: [],
  },
  {
    id: "double-crunch", category: "burgers", name: { ar: "دبل كرنش", en: "Double Crunch" },
    description: { ar: "قطعتا لحم رفيعتان ومقرمشتان، شيدر، خس، وبصل مع صوص برغر كلاسيكي.", en: "Two crispy-edged smash patties, cheddar, lettuce, onion, and classic burger sauce." },
    price: 62, image: "images/menu/photo-1561758033-d89a9ad46330.jpg", tag: "bestSeller", popular: true, options: [],
  },
  {
    id: "hot-honey", category: "burgers", name: { ar: "هوت هاني", en: "Hot Honey Chicken" },
    description: { ar: "دجاج مقرمش، عسل حار، سلطة ملفوف، ومخلل بيتنا.", en: "Crispy chicken, a sweet-hot honey glaze, crunchy slaw, and house pickles." },
    price: 58, image: "images/menu/photo-1606755962773-d324e0a13086.jpg", tag: "spicy", popular: true, options: [],
  },
  {
    id: "mushroom-swiss", category: "burgers", name: { ar: "مشروم سويس", en: "Mushroom Swiss" },
    description: { ar: "لحم بقري مشوي، فطر بالزبدة، سويس ذايب، ومايونيز بالثوم.", en: "Grilled beef, buttery mushrooms, melted Swiss, and roasted garlic mayo." },
    price: 61, image: "images/menu/photo-1571091718767-18b5b1457add.jpg", tag: null, popular: false, options: [],
  },
  {
    id: "garden-smash", category: "burgers", name: { ar: "غاردن سماش", en: "Garden Smash" },
    description: { ar: "برغر نباتي محمّر، أفوكادو، طماطم، خس، وصوص أعشاب طازج.", en: "A seared plant-based patty with avocado, tomato, lettuce, and fresh herb sauce." },
    price: 52, image: "images/menu/photo-1520072959219-c595dc870360.jpg", tag: "vegetarian", popular: false, options: [],
  },
  {
    id: "pepper-jack", category: "burgers", name: { ar: "بيبر جاك", en: "Pepper Jack Heat" },
    description: { ar: "لحم مشوي، جبنة بيبر جاك، هالبينو، وبصل مقرمش وصوص حار.", en: "Grilled beef, pepper jack, jalapeños, crispy onions, and a punchy chili sauce." },
    price: 59, image: "images/menu/photo-1571091718767-18b5b1457add.jpg", tag: "spicy", popular: false, options: [],
  },
  {
    id: "mini-buns", category: "burgers", name: { ar: "ميني بنز", en: "Mini Bun Trio" },
    description: { ar: "ثلاث برغر صغيرة: كلاسيك، باربكيو، ودجاج مقرمش. مثالية للمشاركة.", en: "Three little burgers: classic, barbecue, and crispy chicken. Made for sharing." },
    price: 64, image: "images/menu/photo-1571091718767-18b5b1457add.jpg", tag: null, popular: false, options: [],
  },
  {
    id: "skinny-fries", category: "sides", name: { ar: "بطاطا رفيعة", en: "Skinny Fries" },
    description: { ar: "بطاطا ذهبية مقرمشة، متبّلة بملح ريد بن.", en: "Golden, crispy fries tossed in our Red Bun seasoning." },
    price: 19, image: "images/menu/photo-1573080496219-bb080dd4f877.jpg", tag: "bestSeller", popular: true, options: [],
  },
  {
    id: "loaded-fries", category: "sides", name: { ar: "لودد فرايز", en: "Loaded Red Fries" },
    description: { ar: "بطاطا ساخنة مع شيدر ذايب، صوص برغر، وبصل أخضر.", en: "Hot fries loaded with melted cheddar, burger sauce, and green onion." },
    price: 32, image: "images/menu/photo-1630384060421-cb20d0e0649d.jpg", tag: null, popular: false, options: [],
  },
  {
    id: "onion-rings", category: "sides", name: { ar: "حلقات بصل", en: "Crispy Onion Rings" },
    description: { ar: "حلقات بصل مغلّفة ومقلية حتى تصير ذهبية، مع صوص الرانش.", en: "Golden beer-battered onion rings served with house ranch." },
    price: 24, image: "images/menu/photo-1639024471283-03518883512d.jpg", tag: null, popular: false, options: [],
  },
  {
    id: "mac-bites", category: "sides", name: { ar: "ماك آند تشيز بايتس", en: "Mac & Cheese Bites" },
    description: { ar: "كرات مكرونة وجبنة مقرمشة مع صوص طماطم حار.", en: "Crispy mac-and-cheese bites with a little spicy tomato dip." },
    price: 28, image: "images/menu/photo-1541592106381-b31e9677c0e5.jpg", tag: null, popular: false, options: [],
  },
  {
    id: "classic-shake", category: "drinks", name: { ar: "ميلك شيك فانيلا", en: "Vanilla Milkshake" },
    description: { ar: "آيس كريم فانيلا مخفوق بالحليب ومغطّى بكريمة طازجة.", en: "Vanilla bean ice cream blended thick and finished with whipped cream." },
    price: 25, image: "images/menu/photo-1572490122747-3968b75cc699.jpg", tag: "bestSeller", popular: true, options: [],
  },
  {
    id: "chocolate-shake", category: "drinks", name: { ar: "ميلك شيك شوكولاتة", en: "Chocolate Milkshake" },
    description: { ar: "شوكولاتة غنية، آيس كريم، ورشة كاكاو.", en: "Rich chocolate, thick ice cream, and a dusting of cocoa." },
    price: 27, image: "images/menu/photo-1577805947697-89e18249d767.jpg", tag: null, popular: false, options: [],
  },
  {
    id: "house-lemonade", category: "drinks", name: { ar: "ليمونادة الدار", en: "House Lemonade" },
    description: { ar: "ليمون طازج، نعنع أخضر، وثلج كثير.", en: "Fresh-squeezed lemon, garden mint, and plenty of ice." },
    price: 18, image: "images/menu/house-lemonade.jpg", tag: "vegetarian", popular: false, options: [],
  },
  {
    id: "cola", category: "drinks", name: { ar: "كولا باردة", en: "Ice-Cold Cola" },
    description: { ar: "كولا باردة جداً مع الثلج والليمون.", en: "An ice-cold cola with plenty of ice and a wedge of lemon." },
    price: 12, image: "images/menu/photo-1554866585-cd94860890b7.jpg", tag: null, popular: false, options: [],
  },
  {
    id: "brownie", category: "sweets", name: { ar: "براوني دافئ", en: "Warm Fudge Brownie" },
    description: { ar: "براوني شوكولاتة طري، يُقدّم دافئاً مع آيس كريم فانيلا.", en: "A fudgy chocolate brownie served warm with a scoop of vanilla ice cream." },
    price: 28, image: "images/menu/photo-1606313564200-e75d5e30476c.jpg", tag: "bestSeller", popular: true, options: [],
  },
  {
    id: "cookie-skillet", category: "sweets", name: { ar: "كوكي سكيليت", en: "Cookie Skillet" },
    description: { ar: "كوكيز شوكولاتة طازج بالفرن في مقلاة صغيرة مع آيس كريم.", en: "A warm chocolate-chip cookie baked in its own skillet with ice cream." },
    price: 31, image: "images/menu/photo-1499636136210-6f4ee915583e.jpg", tag: null, popular: false, options: [],
  },
  {
    id: "soft-serve", category: "sweets", name: { ar: "سوفت سيرف", en: "Soft-Serve Cone" },
    description: { ar: "آيس كريم فانيلا ناعم، مع اختيارك من صوص الشوكولاتة أو الكراميل.", en: "Swirls of soft vanilla ice cream with your choice of chocolate or caramel sauce." },
    price: 16, image: "images/menu/photo-1563805042-7684c019e1cb.jpg", tag: null, popular: false, options: [],
  },
  {
    id: "red-velvet", category: "sweets", name: { ar: "ريد فلفت بايت", en: "Red Velvet Bite" },
    description: { ar: "كعكة ريد فلفت بطبقات من كريمة الجبنة الناعمة.", en: "A tender red velvet cake layered with smooth cream-cheese frosting." },
    price: 25, image: "images/menu/photo-1586788680434-30d324b2d46f.jpg", tag: null, popular: false, options: [],
  },
];

const coverSlides = [
  {
    image: "./images/red-bun-campaign-1.jpg",
    alt: { ar: "أصدقاء يستمتعون ببرغر ريد بن", en: "Friends enjoying burgers at The Red Bun" },
  },
  {
    image: "./images/red-bun-campaign-2.jpg",
    alt: { ar: "زبائن يحملون برغر ريد بن الطازج", en: "Guests holding freshly made Red Bun burgers" },
  },
];

const state = {
  language: "ar",
  category: "all",
  query: "",
  fulfillment: "pickup",
  cart: [],
  modalDishId: null,
  modalSelections: {},
  modalQuantity: 1,
  cartOpen: false,
  previousFocus: null,
  toastTimer: null,
  coverIndex: 0,
  coverTimer: null,
  coverPaused: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const getCopy = (key) => copy[state.language][key] || copy.en[key] || key;
const localize = (value) => (typeof value === "string" ? value : value[state.language] || value.en);
const escapeHTML = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
const formatMoney = (amount) =>
  new Intl.NumberFormat(getCopy("currencyLocale"), {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);

function updateStaticCopy() {
  document.documentElement.lang = state.language;
  document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
  document.title = `${localize({ ar: "ذا ريد بن", en: "The Red Bun" })} — ${getCopy("titleSuffix")}`;
  $("#restaurantName").textContent = localize({ ar: "ذا ريد بن", en: "The Red Bun" });

  $$("[data-copy]").forEach((element) => {
    const key = element.dataset.copy;
    element.textContent = getCopy(key);
  });

  const languageButton = $("#languageButton");
  languageButton.textContent = state.language === "ar" ? "EN" : "عربي";
  languageButton.setAttribute(
    "aria-label",
    state.language === "ar" ? "Switch to English" : "التبديل إلى العربية",
  );
  $("#shareButton").setAttribute("aria-label", getCopy("share"));
  $("#openCartButton").setAttribute("aria-label", getCopy("order"));
  $("#desktopCart").setAttribute("aria-label", getCopy("yourOrder"));
  $("#categoryStrip").setAttribute("aria-label", getCopy("categoryLabel"));
  $("#coverCarousel").setAttribute("aria-label", getCopy("coverLabel"));
  $("#coverPrevious").setAttribute("aria-label", getCopy("previousCover"));
  $("#coverNext").setAttribute("aria-label", getCopy("nextCover"));
  $$(".cover-dot").forEach((dot) => {
    dot.setAttribute("aria-label", `${getCopy("showCover")} ${Number(dot.dataset.coverIndex) + 1}`);
  });
  $$(".cover-slide img").forEach((image, index) => {
    if (coverSlides[index]) image.alt = localize(coverSlides[index].alt);
  });

  const search = $("#menuSearch");
  search.placeholder = getCopy("searchPlaceholder");
  search.setAttribute("aria-label", getCopy("searchLabel"));
  search.value = state.query;
}

function showCover(index) {
  state.coverIndex = (index + coverSlides.length) % coverSlides.length;
  $$(".cover-slide").forEach((slide, slideIndex) => {
    const active = slideIndex === state.coverIndex;
    slide.classList.toggle("is-active", active);
    slide.setAttribute("aria-hidden", String(!active));
  });
  $$(".cover-dot").forEach((dot, dotIndex) => {
    const active = dotIndex === state.coverIndex;
    dot.classList.toggle("is-active", active);
    if (active) dot.setAttribute("aria-current", "true");
    else dot.removeAttribute("aria-current");
  });
}

function startCoverAutoplay() {
  window.clearInterval(state.coverTimer);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  state.coverTimer = window.setInterval(() => {
    if (!state.coverPaused && !document.hidden) showCover(state.coverIndex + 1);
  }, 5200);
}

function navigateCover(index) {
  showCover(index);
  startCoverAutoplay();
}

function initializeCoverCarousel() {
  const carousel = $("#coverCarousel");
  $("#coverTrack").innerHTML = coverSlides.map((slide, index) => `
    <div class="cover-slide${index === 0 ? " is-active" : ""}" aria-hidden="${index !== 0}"
      aria-roledescription="slide" aria-label="${index + 1} / ${coverSlides.length}">
      <img src="${escapeHTML(slide.image)}" alt="${escapeHTML(localize(slide.alt))}"
        ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} />
    </div>`).join("");
  $("#coverPagination").innerHTML = coverSlides.map((_, index) => `
    <button class="cover-dot${index === 0 ? " is-active" : ""}" type="button"
      data-cover-index="${index}" aria-label="${escapeHTML(getCopy("showCover"))} ${index + 1}"
      ${index === 0 ? 'aria-current="true"' : ""}></button>`).join("");
  showCover(0);

  carousel.addEventListener("click", (event) => {
    const control = event.target.closest("[data-cover-step], [data-cover-index]");
    if (!control) return;
    if (control.hasAttribute("data-cover-step")) {
      navigateCover(state.coverIndex + Number(control.dataset.coverStep));
    } else {
      navigateCover(Number(control.dataset.coverIndex));
    }
  });
  carousel.addEventListener("pointerenter", () => { state.coverPaused = true; });
  carousel.addEventListener("pointerleave", () => { state.coverPaused = false; });
  carousel.addEventListener("focusin", () => { state.coverPaused = true; });
  carousel.addEventListener("focusout", (event) => {
    if (!carousel.contains(event.relatedTarget)) state.coverPaused = false;
  });

  let touchStartX = null;
  carousel.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0]?.clientX ?? null;
  }, { passive: true });
  carousel.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(distance) > 45) navigateCover(state.coverIndex + (distance < 0 ? 1 : -1));
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) window.clearInterval(state.coverTimer);
    else startCoverAutoplay();
  });
  startCoverAutoplay();
}

function categoryMarkup() {
  return categories.map((category) => {
    const active = state.category === category.id;
    const count = category.id === "all"
      ? dishes.length
      : dishes.filter((dish) => dish.category === category.id).length;
    return `
      <button class="category-pill${active ? " active" : ""}" type="button"
        data-category="${category.id}" aria-pressed="${active}">
        <span class="category-emoji" aria-hidden="true">${category.emoji}</span>
        <span>${escapeHTML(getCopy(category.copyKey))}</span>
        <span class="category-count">${count}</span>
      </button>`;
  }).join("");
}

function initializeCategoryDock() {
  const strip = $("#categoryStrip");
  const sentinel = $("#categoryDockSentinel");
  if (!strip || !sentinel) return;

  let frameQueued = false;
  let isCompact = false;
  const updateCompactState = () => {
    frameQueued = false;
    const sentinelTop = sentinel.getBoundingClientRect().top;
    if (!isCompact && sentinelTop < -6) isCompact = true;
    else if (isCompact && sentinelTop > 6) isCompact = false;
    strip.classList.toggle("is-compact", isCompact);
  };
  const queueUpdate = () => {
    if (frameQueued) return;
    frameQueued = true;
    window.requestAnimationFrame(updateCompactState);
  };

  window.addEventListener("scroll", queueUpdate, { passive: true });
  window.addEventListener("resize", queueUpdate);
  queueUpdate();
}

function dishMarkup(dish) {
  const name = localize(dish.name);
  const hasOptions = dish.options.length > 0;
  const quickLabel = hasOptions ? getCopy("options") : getCopy("addToOrder");
  const tagEmoji = dish.tag === "bestSeller" ? "🔥" : "🌿";
  const tag = dish.tag
    ? `<span class="dish-tag"><span aria-hidden="true">${tagEmoji}</span>${escapeHTML(getCopy(dish.tag))}</span>`
    : "";
  const quickIcon = `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 4v12M4 10h12" />
    </svg>`;

  return `
      <article class="dish-card dish-row">
      <button class="dish-photo" type="button" data-open-dish="${dish.id}" aria-label="${escapeHTML(name)}">
        <img src="${escapeHTML(dish.image)}" alt="${escapeHTML(name)}" loading="lazy" />
        ${tag}
      </button>
      <button class="add-quick" type="button" data-quick-add="${dish.id}" aria-label="${escapeHTML(quickLabel)}">
        ${quickIcon}
      </button>
      <button class="dish-content" type="button" data-open-dish="${dish.id}">
        <span class="dish-title-row">
          <span class="dish-name">${escapeHTML(name)}</span>
          <span class="dish-price">${formatMoney(dish.price)}</span>
        </span>
        <span class="dish-description">${escapeHTML(localize(dish.description))}</span>
        <span class="dish-foot">
          <span class="food-markers"><span class="food-dot" aria-hidden="true"></span>${escapeHTML(getCopy("tableService"))}</span>
          <span>${hasOptions ? escapeHTML(getCopy("options")) : escapeHTML(getCopy("addToOrder"))}</span>
        </span>
      </button>
    </article>`;
}

function normalizeSearch(value) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "");
}

function renderMenu() {
  $("#categoryStrip").innerHTML = categoryMarkup();
  const query = normalizeSearch(state.query);
  const visibleDishes = dishes.filter((dish) => {
    const categoryMatches = state.category === "all" || dish.category === state.category;
    const searchable = normalizeSearch([
      dish.name.ar,
      dish.name.en,
      dish.description.ar,
      dish.description.en,
    ].join(" "));
    return categoryMatches && (!query || searchable.includes(query));
  });

  const grid = $("#dishGrid");
  grid.setAttribute("aria-busy", "false");
  if (!visibleDishes.length) {
    grid.innerHTML = `
      <div class="no-results">
        <span class="no-results-mark" aria-hidden="true"></span>
        <h3>${escapeHTML(getCopy("noResultsTitle"))}</h3>
        <p>${escapeHTML(getCopy("noResultsText"))}</p>
      </div>`;
    return;
  }
  const visibleSections = categories
    .filter((category) => category.id !== "all")
    .map((category) => ({
      ...category,
      items: visibleDishes.filter((dish) => dish.category === category.id),
    }))
    .filter((category) => category.items.length > 0);

  grid.innerHTML = visibleSections.map((category) => `
    <section class="dish-section" aria-labelledby="section-${category.id}">
      <div class="dish-section-heading">
        <h3 id="section-${category.id}">
          <span class="section-emoji" aria-hidden="true">${category.emoji}</span>
          <span>${escapeHTML(getCopy(category.copyKey))}</span>
        </h3>
        <span class="section-count">${category.items.length}</span>
      </div>
      <div class="dish-list">${category.items.map(dishMarkup).join("")}</div>
    </section>`).join("");
}

function getDish(dishId) {
  return dishes.find((dish) => dish.id === dishId);
}

function getSelectedChoices(dish, selections = {}) {
  return dish.options.flatMap((group) =>
    (selections[group.id] || []).map((choiceId) => {
      const choice = group.choices.find((item) => item.id === choiceId);
      return choice ? { group, choice } : null;
    }).filter(Boolean),
  );
}

function selectedTotal(dish, selections = {}) {
  return dish.price + getSelectedChoices(dish, selections)
    .reduce((sum, entry) => sum + entry.choice.extra, 0);
}

function getModalValidity(dish) {
  return dish.options.every((group) =>
    !group.required || (state.modalSelections[group.id] || []).length > 0,
  );
}

function openDish(dishId, trigger = document.activeElement) {
  const dish = getDish(dishId);
  if (!dish) return;
  state.previousFocus = trigger;
  state.modalDishId = dishId;
  state.modalSelections = {};
  state.modalQuantity = 1;
  state.cartOpen = false;
  renderCartDrawer();
  renderModal();
  document.body.classList.add("overlay-open");
  requestAnimationFrame(() => $(".dish-modal-close")?.focus());
}

function closeDish() {
  if (!state.modalDishId) return;
  state.modalDishId = null;
  $("#modalRoot").innerHTML = "";
  document.body.classList.remove("overlay-open");
  state.previousFocus?.focus?.();
}

function modalMarkup(dish) {
  const selected = state.modalSelections;
  const optionsMarkup = dish.options.map((group) => {
    const isRadio = group.required;
    const selectedIds = selected[group.id] || [];
    const choices = group.choices.map((choice) => {
      const inputType = isRadio ? "radio" : "checkbox";
      const checked = selectedIds.includes(choice.id);
      const amount = choice.extra ? `+ ${formatMoney(choice.extra)}` : "";
      return `
        <label class="option-choice">
          <span>
            <input type="${inputType}" name="option-${group.id}" value="${choice.id}"
              data-option-choice data-group="${group.id}" data-choice="${choice.id}"
              ${checked ? "checked" : ""} />
            <span>${escapeHTML(localize(choice.label))}</span>
          </span>
          ${amount ? `<span class="choice-price">${escapeHTML(amount)}</span>` : ""}
        </label>`;
    }).join("");
    return `
      <fieldset class="option-section">
        <legend class="option-heading">
          <strong>${escapeHTML(localize(group.label))}</strong>
          <span class="${group.required ? "required-pill" : "optional-pill"}">
            ${escapeHTML(getCopy(group.required ? "required" : "optional"))}
          </span>
        </legend>
        ${choices}
      </fieldset>`;
  }).join("");
  const selectedPrice = selectedTotal(dish, selected) * state.modalQuantity;
  const valid = getModalValidity(dish);
  const title = localize(dish.name);

  return `
    <div class="modal-backdrop" data-close-modal>
      <section class="dish-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">
        <div class="modal-image">
          <img src="${escapeHTML(dish.image)}" alt="${escapeHTML(title)}" />
          ${dish.tag ? `<span class="dish-tag">${escapeHTML(getCopy(dish.tag))}</span>` : ""}
        </div>
        <div class="modal-body">
          <button class="close-modal dish-modal-close" type="button" data-close-modal aria-label="${escapeHTML(getCopy("close"))}">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
          <p class="section-kicker">${escapeHTML(getCopy("options"))}</p>
          <h2 id="modalTitle">${escapeHTML(title)}</h2>
          <p class="modal-description">${escapeHTML(localize(dish.description))}</p>
          <div class="modal-base-price">${escapeHTML(formatMoney(dish.price))}</div>
          ${optionsMarkup ? `<div class="modal-options">${optionsMarkup}</div>` : ""}
          <div class="modal-actions">
            <div class="modal-quantity" aria-label="${escapeHTML(title)}">
              <button type="button" data-modal-quantity="-1" aria-label="${escapeHTML(getCopy("decrease"))}">−</button>
              <span id="modalQuantity">${state.modalQuantity}</span>
              <button type="button" data-modal-quantity="1" aria-label="${escapeHTML(getCopy("increase"))}">+</button>
            </div>
            <button class="add-to-cart" type="button" data-add-modal ${valid ? "" : "disabled"}>
              <span>${escapeHTML(valid ? getCopy("addToOrder") : getCopy("chooseOption"))}</span>
              <strong id="modalTotal">${escapeHTML(formatMoney(selectedPrice))}</strong>
            </button>
          </div>
        </div>
      </section>
    </div>`;
}

function renderModal() {
  const dish = getDish(state.modalDishId);
  if (!dish) {
    $("#modalRoot").innerHTML = "";
    return;
  }
  $("#modalRoot").innerHTML = modalMarkup(dish);
}

function updateModalSummary() {
  const dish = getDish(state.modalDishId);
  if (!dish) return;
  const valid = getModalValidity(dish);
  const addButton = $("[data-add-modal]");
  addButton.disabled = !valid;
  addButton.querySelector("span").textContent = valid ? getCopy("addToOrder") : getCopy("chooseOption");
  $("#modalTotal").textContent = formatMoney(selectedTotal(dish, state.modalSelections) * state.modalQuantity);
}

function addDishToCart(dishId, selections = {}, quantity = 1) {
  const dish = getDish(dishId);
  if (!dish) return;
  const orderedIds = getSelectedChoices(dish, selections).map(({ choice }) => choice.id);
  const key = `${dish.id}|${orderedIds.join(",")}`;
  const existing = state.cart.find((line) => line.key === key);
  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cart.push({
      key,
      dishId,
      selections: Object.fromEntries(
        Object.entries(selections).map(([groupId, choiceIds]) => [groupId, [...choiceIds]]),
      ),
      quantity,
    });
  }
  renderCart();
  toast(getCopy("cartAdded"));
}

function cartCount() {
  return state.cart.reduce((sum, line) => sum + line.quantity, 0);
}

function cartSubtotal() {
  return state.cart.reduce((sum, line) => {
    const dish = getDish(line.dishId);
    return dish ? sum + selectedTotal(dish, line.selections) * line.quantity : sum;
  }, 0);
}

function lineOptionText(dish, selections) {
  return getSelectedChoices(dish, selections)
    .map(({ choice }) => localize(choice.label))
    .join(" · ");
}

function cartLinesMarkup() {
  return state.cart.map((line) => {
    const dish = getDish(line.dishId);
    if (!dish) return "";
    const name = localize(dish.name);
    const options = lineOptionText(dish, line.selections);
    const unitPrice = selectedTotal(dish, line.selections);
    return `
      <div class="cart-line">
        <div class="cart-line-main">
          <div class="cart-line-heading">
            <p class="cart-line-name">${escapeHTML(name)}</p>
            <strong class="line-price">${escapeHTML(formatMoney(unitPrice * line.quantity))}</strong>
          </div>
          ${options ? `<p class="cart-line-options">${escapeHTML(options)}</p>` : ""}
          <div class="quantity-control">
            <button type="button" data-cart-delta="-1" data-line="${escapeHTML(line.key)}" aria-label="${escapeHTML(getCopy("decrease"))}">−</button>
            <span aria-live="polite">${line.quantity}</span>
            <button type="button" data-cart-delta="1" data-line="${escapeHTML(line.key)}" aria-label="${escapeHTML(getCopy("increase"))}">+</button>
            <button class="remove-line" type="button" data-remove-line="${escapeHTML(line.key)}">${escapeHTML(getCopy("remove"))}</button>
          </div>
        </div>
      </div>`;
  }).join("");
}

function cartMarkup() {
  const count = cartCount();
  const subtotal = cartSubtotal();
  const deliveryFee = state.fulfillment === "delivery" && subtotal > 0 ? 12 : 0;
  const isEmpty = count === 0;
  return `
    <div class="cart-head">
      <div><p class="section-kicker">${escapeHTML(getCopy("order"))}</p><h2 class="cart-title">${escapeHTML(getCopy("yourOrder"))}</h2></div>
      <span class="cart-count">${count}</span>
    </div>
    <div class="fulfillment" role="group" aria-label="${escapeHTML(getCopy("yourOrder"))}">
      <button type="button" data-fulfillment="pickup" class="${state.fulfillment === "pickup" ? "selected" : ""}" aria-pressed="${state.fulfillment === "pickup"}">${escapeHTML(getCopy("pickup"))}</button>
      <button type="button" data-fulfillment="delivery" class="${state.fulfillment === "delivery" ? "selected" : ""}" aria-pressed="${state.fulfillment === "delivery"}">${escapeHTML(getCopy("delivery"))}</button>
    </div>
    ${isEmpty
      ? `<div class="cart-empty">
          <span class="empty-illustration" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 8h14l-1.2 12H6.2L5 8Zm4 0V6a3 3 0 0 1 6 0v2" /></svg></span>
          <strong>${escapeHTML(getCopy("emptyTitle"))}</strong><p>${escapeHTML(getCopy("emptyText"))}</p>
        </div>`
      : `<div class="cart-lines">${cartLinesMarkup()}</div>
        <div class="totals">
          <div class="total-row"><span>${escapeHTML(getCopy("subtotal"))}</span><strong>${escapeHTML(formatMoney(subtotal))}</strong></div>
          ${state.fulfillment === "delivery" ? `<div class="total-row"><span>${escapeHTML(getCopy("deliveryFee"))}</span><strong>${deliveryFee ? escapeHTML(formatMoney(deliveryFee)) : escapeHTML(getCopy("free"))}</strong></div>` : ""}
          <div class="total-row grand"><span>${escapeHTML(getCopy("total"))}</span><strong>${escapeHTML(formatMoney(subtotal + deliveryFee))}</strong></div>
          <button class="checkout-demo" type="button" data-demo-checkout>
            <span>${escapeHTML(getCopy("continueCheckout"))}</span>
            <span>${escapeHTML(formatMoney(subtotal + deliveryFee))}</span>
          </button>
        </div>`}
    <p class="prototype-footnote">${escapeHTML(getCopy("noOrders"))}</p>`;
}

function renderCart() {
  $("#desktopCart").innerHTML = cartMarkup();
  $("#headerCartCount").textContent = String(cartCount());
  const mobileBar = $("#mobileCartBar");
  mobileBar.hidden = cartCount() === 0;
  mobileBar.setAttribute("aria-expanded", String(state.cartOpen));
  $(".mobile-cart-count").textContent = String(cartCount());
  $(".mobile-cart-total").textContent = formatMoney(
    cartSubtotal() + (state.fulfillment === "delivery" && cartCount() > 0 ? 12 : 0),
  );
  renderCartDrawer();
}

function renderCartDrawer() {
  const root = $("#cartDrawerRoot");
  if (!state.cartOpen) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = `
    <div class="cart-drawer" data-close-cart>
      <aside class="cart-drawer-inner" role="dialog" aria-modal="true" aria-labelledby="drawerTitle" tabindex="-1">
        <div class="drawer-heading">
          <h2 id="drawerTitle">${escapeHTML(getCopy("yourOrder"))}</h2>
          <button type="button" data-close-cart aria-label="${escapeHTML(getCopy("closeOrder"))}">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <div class="drawer-content">${cartMarkup()}</div>
      </aside>
    </div>`;
  document.body.classList.add("overlay-open");
}

function openCart() {
  closeDish();
  state.previousFocus = document.activeElement;
  state.cartOpen = true;
  renderCartDrawer();
  requestAnimationFrame(() => $("[role='dialog'] .drawer-heading button", $("#cartDrawerRoot"))?.focus());
}

function closeCart() {
  if (!state.cartOpen) return;
  state.cartOpen = false;
  $("#cartDrawerRoot").innerHTML = "";
  document.body.classList.remove("overlay-open");
  state.previousFocus?.focus?.();
}

function changeCartLine(key, delta) {
  const line = state.cart.find((item) => item.key === key);
  if (!line) return;
  line.quantity += delta;
  if (line.quantity <= 0) {
    state.cart = state.cart.filter((item) => item.key !== key);
  }
  renderCart();
}

function toast(message, className = "") {
  const zone = $("#toastZone");
  zone.innerHTML = "";
  const element = document.createElement("div");
  element.className = `demo-toast${className ? ` ${className}` : ""}`;
  element.textContent = message;
  zone.append(element);
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => element.remove(), 2600);
}

async function shareMenu() {
  const shareData = {
    title: localize({ ar: "قائمة ذا ريد بن", en: "The Red Bun menu" }),
    text: localize({
      ar: "تصفّح قائمة ذا ريد بن — برغر طازج وصوصات من تحضيرنا.",
      en: "Browse The Red Bun menu — fresh burgers and our own house sauces.",
    }),
    url: window.location.href,
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }
    await navigator.clipboard.writeText(shareData.url);
    toast(getCopy("linkCopied"), "share-toast");
  } catch (error) {
    if (error?.name !== "AbortError") toast(getCopy("shareError"));
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

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    if (event.target.matches("[data-close-modal]")) closeDish();
    if (event.target.matches("[data-close-cart]")) closeCart();
    return;
  }

  if (button.id === "languageButton") {
    setLanguage(state.language === "ar" ? "en" : "ar");
    return;
  }
  if (button.id === "shareButton") {
    shareMenu();
    return;
  }
  if (button.id === "openCartButton" || button.id === "mobileCartBar") {
    openCart();
    return;
  }
  if (button.dataset.category) {
    state.category = button.dataset.category;
    renderMenu();
    return;
  }
  if (button.dataset.openDish) {
    openDish(button.dataset.openDish, button);
    return;
  }
  if (button.dataset.quickAdd) {
    const dish = getDish(button.dataset.quickAdd);
    if (!dish) return;
    if (dish.options.length) {
      openDish(dish.id, button);
    } else {
      addDishToCart(dish.id);
    }
    return;
  }
  if (button.hasAttribute("data-close-modal")) {
    closeDish();
    return;
  }
  if (button.hasAttribute("data-close-cart")) {
    closeCart();
    return;
  }
  if (button.dataset.fulfillment) {
    state.fulfillment = button.dataset.fulfillment;
    renderCart();
    return;
  }
  if (button.dataset.cartDelta) {
    changeCartLine(button.dataset.line, Number(button.dataset.cartDelta));
    return;
  }
  if (button.dataset.removeLine) {
    state.cart = state.cart.filter((line) => line.key !== button.dataset.removeLine);
    renderCart();
    return;
  }
  if (button.dataset.modalQuantity) {
    state.modalQuantity = Math.max(1, state.modalQuantity + Number(button.dataset.modalQuantity));
    $("#modalQuantity").textContent = String(state.modalQuantity);
    updateModalSummary();
    return;
  }
  if (button.hasAttribute("data-add-modal")) {
    const dish = getDish(state.modalDishId);
    if (!dish || !getModalValidity(dish)) return;
    addDishToCart(dish.id, state.modalSelections, state.modalQuantity);
    closeDish();
    return;
  }
  if (button.hasAttribute("data-demo-checkout")) {
    toast(getCopy("checkoutDemo"));
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id !== "menuSearch") return;
  state.query = event.target.value;
  renderMenu();
});

document.addEventListener("change", (event) => {
  const input = event.target.closest("[data-option-choice]");
  if (!input || !state.modalDishId) return;
  const { group, choice } = input.dataset;
  const dish = getDish(state.modalDishId);
  const groupData = dish?.options.find((item) => item.id === group);
  if (!groupData) return;
  if (groupData.required) {
    state.modalSelections[group] = input.checked ? [choice] : [];
  } else {
    const current = state.modalSelections[group] || [];
    state.modalSelections[group] = input.checked
      ? [...current, choice]
      : current.filter((item) => item !== choice);
  }
  updateModalSummary();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDish();
    closeCart();
  }

  const dialog = $("#modalRoot [role='dialog'], #cartDrawerRoot [role='dialog']");
  if (event.key !== "Tab" || !dialog) return;
  const focusable = $$("button:not(:disabled), input:not(:disabled), [tabindex='0']", dialog)
    .filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || image.dataset.fallback === "true") return;
  if (!image.matches(".dish-photo img, .modal-image img, .cover-slide img")) return;
  image.dataset.fallback = "true";
  image.src = "./images/restivo-food-table.jpg";
}, true);

updateStaticCopy();
initializeCoverCarousel();
renderMenu();
renderCart();
initializeCategoryDock();