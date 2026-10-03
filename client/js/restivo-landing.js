import { copy, features, steps, faqs } from './restivo-content.js';

const FOOD = '/images/restivo-food-table.jpg';
const OWNER = '/images/restivo-owner-tablet.jpg';
let lang = 'ar';
let mobileOpen = false;
let priceLabel = '$19.99';
try {
  const qLang = new URLSearchParams(location.search).get('lang');
  lang = (qLang === 'en' || qLang === 'ar') ? qLang : (localStorage.getItem('restivo-lang') || 'ar');
} catch (_) { /* default ar */ }
let modalOpen = false;
let liveOpen = false;
let faqOpen = 0;
let familyCache = null;

const escS = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const icon = (name) => `<span class="symbol" aria-hidden="true">${name}</span>`;
const logo = (light = false) => `<a href="#top" class="logo ${light ? 'light' : ''}"><img class="logo-mark-img" src="/icons/icon.svg" alt="Restivo"><span>Restivo</span></a>`;
const languageToggle = () => `<div class="lang-toggle" role="group" aria-label="${lang === 'ar' ? 'اختيار اللغة' : 'Choose language'}"><button type="button" data-lang="ar" aria-pressed="${lang === 'ar'}" class="${lang === 'ar' ? 'active' : ''}">العربية</button><button type="button" data-lang="en" aria-pressed="${lang === 'en'}" class="${lang === 'en' ? 'active' : ''}">English</button></div>`;
const arrow = () => `<span aria-hidden="true">←</span>`;

function renderLanding() {
  const t = copy[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const pageTitle = lang === 'ar'
    ? 'Restivo — منيو وطلبات للمطاعم المستقلة'
    : 'Restivo — Online menus and ordering for independent restaurants';
  document.title = pageTitle;
  document.querySelector('meta[name="description"]')?.setAttribute('content', t.seo.description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', pageTitle);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', t.seo.description);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', pageTitle);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', t.seo.description);
  (function () {
    const origin = location.origin;
    const mk = (selector, make) => { let el = document.head.querySelector(selector); if (!el) { el = make(); document.head.appendChild(el); } return el; };
    mk('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l; }).href = origin + '/';
    const ogUrl = mk('meta[property="og:url"]', () => { const m = document.createElement('meta'); m.setAttribute('property', 'og:url'); return m; });
    ogUrl.content = origin + '/';
    const setAlt = (hreflang) => {
      const sel = `link[rel="alternate"][hreflang="${hreflang}"]`;
      const el = mk(sel, () => { const l = document.createElement('link'); l.rel = 'alternate'; l.setAttribute('hreflang', hreflang); return l; });
      el.href = origin + '/?lang=' + (hreflang === 'x-default' ? 'ar' : hreflang);
    };
    setAlt('ar'); setAlt('en'); setAlt('x-default');
  })();
  document.querySelector('#app').innerHTML = `
    <div id="top" class="noise">
      <header class="site-header"><div class="wrap header-row">${logo()}<div class="mobile-language">${languageToggle()}</div>
        <nav class="nav"><a href="#how-it-works">${t.nav.how}</a><a href="#features">${t.nav.features}</a><a href="#pricing">${t.nav.pricing}</a><a href="#faq">${t.nav.faq}</a></nav>
        <div class="header-actions"><span class="audience">${t.nav.audience}</span>${languageToggle()}<button class="primary-btn" data-action="live">${t.hero.try}</button></div>
        <button class="mobile-menu" data-action="mobile" aria-label="Menu">${mobileOpen ? '×' : '≡'}</button>
      </div><div class="mobile-nav ${mobileOpen ? 'open' : ''}"><div class="mobile-language-row"><span>${lang === 'ar' ? 'اللغة' : 'Language'}</span>${languageToggle()}</div><a href="#how-it-works">${t.nav.how}</a><a href="#features">${t.nav.features}</a><a href="#pricing">${t.nav.pricing}</a><button data-action="live">${t.hero.try}</button></div></header>
      <main>
        <section class="hero"><div class="page-grid"></div><div class="orb one"></div><div class="orb two"></div><div class="wrap">
          <div class="hero-grid"><div class="hero-copy reveal"><span class="badge"><i></i>${t.hero.badge}<b>/</b> Restivo</span><h1>${t.hero.titleA} <span class="accent">${t.hero.titleB}</span></h1><p class="hero-desc">${t.hero.description}</p><div class="hero-actions"><button class="dark-btn" data-action="live">${t.hero.try} ${arrow()}</button><span class="cue-arrow" aria-hidden="true"><svg viewBox="0 0 72 44"><g transform="translate(3.5,3.5)" fill="none" stroke="#f5c84b" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"><path class="draw" pathLength="100" d="M62 6 C 44 8, 28 16, 14 31"/><path class="draw2" pathLength="100" d="M24 24 L13 32 L25 36"/></g><g fill="none" stroke="#ed6b4c" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"><path class="draw" pathLength="100" d="M62 6 C 44 8, 28 16, 14 31"/><path class="draw2" pathLength="100" d="M24 24 L13 32 L25 36"/></g></svg></span><button class="text-btn" data-action="request">${t.hero.request} ${arrow()}</button><a class="text-btn" href="/signup.html">${t.hero.startTrial} ${arrow()}</a></div><div class="proof"><p>${t.hero.proof}<br><strong>${t.hero.proofStrong}</strong></p></div></div><div class="reveal delay">${phonePreview(t)}</div></div>
        </div></section>
        <section class="ticker" aria-label="highlights"><div class="ticker-track">${[...t.ticker, ...t.ticker].map((x, i) => `<span${i >= t.ticker.length ? ' aria-hidden="true"' : ''}>✦ ${x}</span>`).join('')}</div></section>
        <section class="logos"><div class="wrap"><span class="eyebrow">${t.logos.eyebrow}</span><h2 class="section-title">${t.logos.titleA}<br><span class="teal-text">${t.logos.titleB}</span></h2><p class="section-body">${t.logos.body}</p></div><div class="logo-slider" id="logo-slider"><div class="logo-track" id="logo-track"></div></div></section>
        <section class="story"><div class="wrap story-grid"><div class="story-art"><figure class="food-card"><img src="${FOOD}" alt="${t.story.tag}"><figcaption class="food-label">${t.story.tag}</figcaption></figure><figure class="owner-card"><img src="${OWNER}" alt="${t.story.owner}"><figcaption>${t.story.owner}</figcaption></figure></div><div><span class="eyebrow">${t.story.eyebrow}</span><h2 class="section-title">${t.story.titleA}<br><span class="teal-text">${t.story.titleB}</span></h2><p class="section-body">${t.story.body}</p><div class="owner-note"><b>01</b>${t.story.ownerNote}</div></div></div></section>
        <section id="how-it-works" class="how"><div class="wrap"><div class="section-intro"><div><span class="eyebrow">${t.how.eyebrow}</span><h2 class="section-title">${t.how.titleA}<br><span class="teal-text">${t.how.titleB}</span></h2></div><p class="section-body">${t.how.body}</p></div><div class="steps">${steps[lang].map((s,i)=>`<article class="step"><div class="step-head"><span>0${i+1}</span><span class="step-icon">${s[0]}</span></div><h3>${s[1]}</h3><p>${s[2]}</p></article>`).join('')}</div></div></section>
        <section id="features" class="features"><div class="wrap"><div class="features-head"><div><span class="eyebrow">${t.features.eyebrow}</span><h2 class="section-title">${t.features.titleA}<br><span class="accent">${t.features.titleB}</span></h2></div><p class="aside">${t.features.aside}</p></div><div class="feature-grid">${features.map((f)=>`<article class="feature ${f.tone}"><div class="feature-head"><span>${f.n}</span><span class="feature-icon">${f.icon}</span></div><div class="feature-copy"><h3>${f[lang].title}</h3><p>${f[lang].body}</p></div></article>`).join('')}</div></div></section>
        <section class="dashboard"><div class="wrap dashboard-grid"><div><span class="eyebrow yellow-eyebrow">${t.dashboard.eyebrow}</span><h2 class="section-title">${t.dashboard.titleA}<br><span style="color:var(--yellow)">${t.dashboard.titleB}</span></h2><p class="section-body on-dark">${t.dashboard.body}</p><div class="chips">${t.dashboard.chips.map((c)=>`<span class="chip"><b>✓</b>${c}</span>`).join('')}</div></div><div class="dashboard-panel"><div class="panel"><div class="panel-top"><div><small>${t.dashboard.label}</small><h4>${t.dashboard.date}</h4></div><span class="panel-mark">▥</span></div><div class="mock-lines" aria-hidden="true"><span style="width:62%"></span><span style="width:88%"></span><span style="width:74%"></span><span style="width:95%"></span><span style="width:55%"></span></div><div class="chips">${t.dashboard.chips.map((c)=>`<span class="chip"><b>✓</b>${c}</span>`).join('')}</div></div></div></section>
        <section id="pricing" class="pricing"><div class="wrap pricing-grid"><div><span class="eyebrow yellow-eyebrow">${t.pricing.eyebrow}</span><h2 class="section-title">${t.pricing.titleA}<br><span style="color:var(--yellow)">${t.pricing.titleB}</span></h2><p class="section-body on-dark">${t.pricing.body}</p></div><div class="pricing-card"><p class="pricing-label">${t.pricing.label}</p><div class="price"><strong>${priceLabel}</strong><span>${t.pricing.month}</span></div><p class="trial-note">✓ ${t.pricing.trial}</p><div class="offer-note"><strong>${t.hero.stripTitle}</strong><span>${t.hero.stripSub.replace('{price}', priceLabel)}</span></div><div class="rule"></div><ul class="price-features">${t.pricing.features.map(x=>`<li>${x}</li>`).join('')}</ul><button class="coral-btn" data-action="request">${t.pricing.request} ${arrow()}</button></div></div></section>
        <section id="faq" class="faq"><div class="wrap faq-inner"><div class="faq-head"><span class="eyebrow">${t.faq.eyebrow}</span><h2 class="section-title">${t.faq.title}</h2></div><div class="faq-list">${faqs[lang].map((f,i)=>`<article class="faq-item ${faqOpen===i?'open':''}"><button class="faq-q" data-faq="${i}" aria-expanded="${faqOpen===i}"><span>${f[0]}</span><b>${faqOpen===i?'−':'+'}</b></button><p class="faq-a">${f[1].replace("{price}", priceLabel)}</p></article>`).join('')}</div></div></section>
        <section class="trust"><div class="wrap"><span class="eyebrow">${t.trust.eyebrow}</span><ul>${t.trust.items.map((x) => `<li>✓ ${x}</li>`).join('')}</ul></div></section>
        <section class="final"><span class="eyebrow">✦</span><h2>${t.final.titleA}<br>${t.final.titleB}</h2><p>${t.final.body}</p><button class="dark-btn" data-action="request">${t.final.request} ${arrow()}</button></section>
      </main>
      <footer class="footer"><div class="wrap footer-row"><div>${logo(true)}<p>${t.footer.a}<br>${t.footer.b}</p></div><div class="footer-links"><a href="#features">${t.nav.features}</a><a href="#pricing">${t.nav.pricing}</a><button data-action="live">${t.hero.try}</button><a href="/login.html" style="opacity:.7">${lang === 'ar' ? 'دخول' : 'Login'}</a><span>© Restivo</span></div></div></footer>
    </div>`;
  bindLanding();
}

function qrGraphic() {
  const size = 29;
  const cells = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  const addFinder = (left, top) => {
    for (let y = top - 1; y <= top + 7; y += 1) {
      for (let x = left - 1; x <= left + 7; x += 1) {
        if (x >= 0 && y >= 0 && x < size && y < size) reserved[y][x] = true;
      }
    }
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        cells[top + y][left + x] =
          x === 0 || y === 0 || x === 6 || y === 6 ||
          (x >= 2 && x <= 4 && y >= 2 && y <= 4);
      }
    }
  };

  addFinder(2, 2);
  addFinder(20, 2);
  addFinder(2, 20);

  for (let i = 9; i <= 19; i += 1) {
    const dark = i % 2 === 0;
    cells[14][i] = dark;
    cells[i][14] = dark;
    reserved[14][i] = true;
    reserved[i][14] = true;
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!reserved[y][x]) {
        cells[y][x] = ((x * 31 + y * 17 + x * y * 7 + (x ^ y) * 13) % 17) < 8;
      }
    }
  }

  const modules = cells.flatMap((row, y) =>
    row.flatMap((dark, x) => dark ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : []),
  ).join('');
  return `<svg class="qr-pattern" viewBox="0 0 ${size} ${size}" aria-hidden="true"><rect width="${size}" height="${size}" fill="#fffaf0"/>${modules}</svg>`;
}

function phonePreview(t) {
  const items = lang === 'ar' ? [['برجر سموكي','$12.00'],['بطاطس بالجبنة','$6.50'],['ليمون ونعناع','$4.00']] : [['Smoky burger','$12.00'],['Cheese fries','$6.50'],['Lemon mint','$4.00']];
  return `<div class="phone-preview"><div class="qr-wrap"><div class="qr-card" role="img" aria-label="${lang === 'ar' ? 'رمز QR لقائمة المطعم' : 'Restaurant menu QR code'}">${qrGraphic()}</div><svg class="qr-ring" viewBox="0 0 140 140" aria-hidden="true"><defs><path id="qrCircle" d="M70 14 a56 56 0 1 1 -0.1 0"/></defs><text textLength="350" lengthAdjust="spacing"><textPath href="#qrCircle">${t.menu.qrTry} ✦ ${lang === 'ar' ? 'SCAN AND TRY IT YOURSELF' : 'امسح وجرب بنفسك'} ✦ </textPath></text></svg></div><div class="order-float"><header><span>${t.menu.newOrder}</span><b>${t.menu.now}</b></header><div class="of-row"><span>${items[0][0]}</span><span>× 2</span></div><div class="of-row of-total"><span>${t.menu.total}</span><span>$24</span></div></div><div class="phone"><div class="phone-screen"><div class="phone-cover"><img src="${FOOD}" alt=""><div class="phone-cover-copy"><small>${lang==='ar'?'مطعم مهند':'Mohand Restaurant'}</small><strong>${lang==='ar'?'منيو المطعم':'Live menu'}</strong></div></div><div class="phone-menu"><div class="phone-top"><span>MENU / 01</span><span class="open-pill">${t.menu.open}</span></div><div class="phone-cats"><span class="active">${t.menu.popular}</span><span>${t.menu.meals}</span><span>${t.menu.drinks}</span></div><h4>${t.menu.picks}</h4>${items.map((item,i)=>`<div class="mini-item"><span class="mini-pic"><img src="${FOOD}" alt="" loading="lazy" style="object-position:${['70% 55%','88% 45%','55% 40%'][i]||'50% 50%'}"></span><div><p>${item[0]}</p><small>${t.menu.fresh}</small></div><em>${item[1]}</em></div>`).join('')}<button class="phone-try" data-action="live"><span>${t.hero.try}</span><b>↗</b></button></div></div></div></div>`;
}

function bindLanding() {
  document.querySelectorAll('[data-lang]').forEach((b)=>b.addEventListener('click',()=>{lang=b.dataset.lang;try{localStorage.setItem('restivo-lang',lang)}catch(_){}mobileOpen=false;renderLanding()}));
  document.querySelectorAll('[data-action="mobile"]').forEach((b)=>b.addEventListener('click',()=>{mobileOpen=!mobileOpen;renderLanding()}));
  document.querySelectorAll('[data-action="live"]').forEach((b)=>b.addEventListener('click',openLive));
  document.querySelectorAll('[data-action="request"]').forEach((b)=>b.addEventListener('click',openRequest));
  document.querySelectorAll('[data-faq]').forEach((b)=>b.addEventListener('click',()=>{faqOpen=faqOpen===Number(b.dataset.faq)?-1:Number(b.dataset.faq);renderLanding()}));
  loadFamily();
}

async function loadFamily(){
  const track=document.querySelector('#logo-track');
  if(!track)return;
  try{
    if(!familyCache){
      const r=await fetch('/api/restaurants',{credentials:'same-origin'});
      const d=await r.json();
      familyCache=(d.restaurants||[]).slice(0,8);
    }
    if(!familyCache.length){track.innerHTML=`<p class="family-empty">${copy[lang].logos.empty}</p>`;return;}
    const chips=familyCache.map(logoChip).join('');
    track.innerHTML=chips+`<span aria-hidden="true" style="display:contents">${chips}</span>`;
  }catch{track.innerHTML=''}
}
function logoChip(r){
  const nm=(lang==='en'&&r.nameEn)?r.nameEn:r.name, open=!!r.openNow;
  const logo=r.logoPath?`<img src="${escS(r.logoPath)}" alt="" loading="lazy">`:`<b>${escS((nm||'?').trim().charAt(0))}</b>`;
  return `<a class="logo-chip" href="/restaurant/${encodeURIComponent(r.slug)}"><span class="logo-chip-logo">${logo}</span><span class="logo-chip-name">${escS(nm)}</span><em class="family-pill ${open?'open':''}">${open?copy[lang].logos.open:copy[lang].logos.closed}</em></a>`;
}
function familyCard(r){
  return logoChip(r);
}

function openRequest() {
  modalOpen=true; document.body.classList.add('modal-open');
  document.body.insertAdjacentHTML('beforeend', modalTemplate());
  document.querySelector('.backdrop').addEventListener('click',(e)=>{if(e.target.classList.contains('backdrop')) closeRequest()});
  document.querySelector('[data-modal-close]').addEventListener('click',closeRequest);
  document.querySelector('#request-form').addEventListener('submit',async (e)=>{
    e.preventDefault();
    const inputs=[...document.querySelectorAll('#request-form input')];
    const btn=document.querySelector('#request-form .coral-btn');
    const payload={customerName:(inputs[0]?.value||'').trim(),restaurantName:(inputs[1]?.value||'').trim(),phone:(inputs[2]?.value||'').trim(),whatsapp:(inputs[2]?.value||'').trim()};
    const fail=(msg)=>{let em=document.querySelector('.modal-error');if(!em){btn.insertAdjacentHTML('afterend','<p class="modal-error"></p>');em=document.querySelector('.modal-error')}em.textContent=msg;btn.disabled=false};
    if(!payload.customerName||!payload.restaurantName||!payload.phone){fail(lang==='ar'?'الرجاء تعبئة جميع الحقول':'Please fill in all fields');return}
    btn.disabled=true;
    try{
      const r=await fetch('/api/restaurant-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await r.json().catch(()=>null);
      if(!r.ok) throw new Error((data&&data.error&&data.error.message)||(lang==='ar'?'فشل الإرسال، حاول مجددًا':'Send failed, try again'));
      const code=data&&data.request&&data.request.code?` — ${data.request.code}`:'';
      document.querySelector('.modal-body').innerHTML=`<div class="success"><div class="success-mark">✓</div><h3>${copy[lang].modal.success}</h3><p>${copy[lang].modal.thanks} ${payload.customerName}${code}. ${copy[lang].modal.tail}</p><button class="dark-btn" data-modal-close>${copy[lang].modal.done}</button></div>`;
      document.querySelector('.modal-body [data-modal-close]').addEventListener('click',closeRequest);
    }catch(err){fail(err.message||(lang==='ar'?'حدث خطأ، حاول مجددًا':'Something went wrong'))}
  });
}
function modalTemplate(){const t=copy[lang].modal;return `<div class="backdrop"><section class="modal" role="dialog" aria-modal="true"><button class="modal-close" data-modal-close aria-label="${t.close}">×</button><div class="modal-head"><span class="modal-badge">${t.badge}</span><h2>${t.titleA}<br>${t.titleB}</h2><p>${t.description}</p></div><div class="modal-body"><form class="modal-form" id="request-form"><label>${t.name}<input id="name" required placeholder="${t.namePh}"></label><label>${t.restaurant}<input required placeholder="${t.restaurantPh}"></label><label>${t.phone}<input required dir="ltr" placeholder="+966 5X XXX XXXX"></label><button class="coral-btn" type="submit">${t.submit} ${arrow()}</button><p class="modal-note">${t.note}</p></form></div></section></div>`}
function closeRequest(){modalOpen=false;document.body.classList.remove('modal-open');document.querySelector('.backdrop')?.remove()}

const menuItems=[
 {id:'shawarma',cat:'shawarma',featured:true,ar:{n:'شاورما عربي',d:'شاورما دجاج متبّلة مع الثوم والمخلل والبطاطس في خبز الصاج.'},en:{n:'Arabic shawarma',d:'Seasoned chicken shawarma with garlic, pickles, and fries in saj bread.'},p:15,pos:'78% 65%'},
 {id:'burger',cat:'popular',featured:true,ar:{n:'برجر موجّه دبل',d:'قطعتا لحم مشويتان مع شيدر وخس وصوص موجّه الخاص.'},en:{n:'Mowajjah double burger',d:'Two grilled beef patties with cheddar, crisp lettuce, and our house sauce.'},p:28,pos:'68% 51%'},
 {id:'crispy',cat:'meals',ar:{n:'وجبة دجاج كرسبي',d:'دجاج مقرمش مع بطاطس وكول سلو وصوصنا الخاص.'},en:{n:'Crispy chicken meal',d:'Crispy chicken strips with fries, coleslaw, and our house sauce.'},p:25,pos:'71% 54%'},
 {id:'grill',cat:'meals',ar:{n:'مشاوي مشكلة',d:'كباب وشيش طاووق وكفتة، تُقدّم مع الأرز والسلطة الطازجة.'},en:{n:'Mixed grill',d:'Kebab, shish tawook, and kofta served with rice and fresh salad.'},p:44,pos:'82% 68%'},
 {id:'fries',cat:'sides',ar:{n:'بطاطس بصوص الجبنة',d:'بطاطس ذهبية مع صوص الجبنة؛ أضف الشطة إذا رغبت.'},en:{n:'Cheesy fries',d:'Golden fries with cheese sauce. Add chili if you like.'},p:12,pos:'94% 48%'},
 {id:'lemon',cat:'drinks',ar:{n:'ليمون بالنعناع',d:'ليمون طازج ونعناع مع ماء بارد — خيار منعش مع وجبتك.'},en:{n:'Lemon mint',d:'Fresh lemon and mint with chilled water — a refreshing match for your meal.'},p:10,pos:'55% 40%'}
];
let liveState={category:'all',search:'',cart:{},cartOpen:false,sent:false,notice:''};
const liveText={
  ar:{
    restaurant:'مطعم مهند',subtitle:'MOHAND RESTAURANT',open:'مفتوح الآن',
    description:'أطباق محضّرة بعناية ونكهات تحبها. تصفّح القائمة واختر طلبك بكل سهولة.',
    location:'الرياض · حي النخيل',hours:'اليوم ١٢:٠٠ م — ١:٠٠ ص',
    menu:'تصفّح أطباقنا واختر ما تشتهي',search:'ابحث عن طبقك المفضل...',
    all:'كل القائمة',popular:'الأكثر طلبًا',shawarma:'شاورما',meals:'وجبات',sides:'إضافات',drinks:'مشروبات',
    featured:'أطباق نوصي بها',full:'القائمة كاملة',add:'أضف للطلب',cart:'طلبك',items:'أصناف',
    total:'الإجمالي',send:'أكمل طلبك عبر واتساب',share:'شارك القائمة',
    liveOrder:'جرّب الطلب عبر الموقع من مطعم حي',
    copied:'تم نسخ رابط المنيو',ready:'طلبك جاهز للإرسال',
    body:'يفتح واتساب لتختار جهة الاتصال وترسل طلبك.',
  },
  en:{
    restaurant:'Mohand Restaurant',subtitle:'MOHAND RESTAURANT',open:'Open now',
    description:'Freshly prepared favorites, made with care. Browse the menu and build your order in a few taps.',
    location:'Riyadh · Al Nakheel',hours:'Today 12:00 PM — 1:00 AM',
    menu:'Explore the menu and find your favorite',search:'Search for a dish...',
    all:'Full menu',popular:'Most ordered',shawarma:'Shawarma',meals:'Meals',sides:'Sides',drinks:'Drinks',
    featured:'Guest favorites',full:'The full menu',add:'Add to order',cart:'Your order',items:'items',
    total:'Total',send:'Continue in WhatsApp',share:'Share menu',
    liveOrder:'Try website ordering at a live restaurant',
    copied:'Menu link copied',ready:'Your order is ready to send',
    body:'WhatsApp will open so you can choose where to send it.',
  },
};

function openLive(){liveOpen=true;document.body.classList.add('modal-open');renderLive()}
function closeLive(){liveOpen=false;document.body.classList.remove('modal-open');document.querySelector('.live-backdrop')?.remove()}
function renderLive(){
  const prevTop=document.querySelector('.live-scroll')?.scrollTop||0;
  const t=liveText[lang], labels={all:t.all,popular:t.popular,shawarma:t.shawarma,meals:t.meals,sides:t.sides,drinks:t.drinks};
  const query=liveState.search.trim().toLocaleLowerCase();
  const filtered=menuItems.filter(x=>(liveState.category==='all'||x.cat===liveState.category||(liveState.category==='popular'&&x.featured))&&(!query||`${x.ar.n} ${x.en.n} ${x.ar.d} ${x.en.d}`.toLocaleLowerCase().includes(query)));
  const featured=menuItems.filter(x=>x.featured);
  const totalItems=Object.values(liveState.cart).reduce((a,b)=>a+b,0), total=menuItems.reduce((a,x)=>a+x.p*(liveState.cart[x.id]||0),0);
  document.body.insertAdjacentHTML('beforeend',`<div class="live-backdrop"><div class="live-shell" role="dialog" aria-modal="true"><header class="live-head"><div class="live-brand"><span class="live-logo">م</span><div><strong>${t.restaurant}</strong><small>${t.subtitle}</small></div></div><div class="live-actions"><button class="outline-btn" data-live-lang>${lang==='ar'?'English':'العربية'}</button><button class="close-btn" data-live-close aria-label="Close">×</button></div></header><div class="live-scroll"><main class="live-content ${lang==='en'?'ltr':''}" dir="${lang==='ar'?'rtl':'ltr'}"><section class="live-hero"><img src="${FOOD}" alt=""><div class="live-hero-content"><div class="live-hero-top"><span class="status"><i></i>${t.open}</span><button class="outline-btn" style="color:var(--paper);border-color:rgba(255,255,255,.25)" data-share>${t.share}</button></div><div><h1>${t.restaurant}</h1><p>${t.description}</p><div class="live-meta"><span>${t.location}</span><span>${t.hours}</span></div></div></div></section><section class="live-section-head"><div><small>${lang==='ar'?'قائمتنا':'THE MENU'}</small><h2>${t.menu}</h2></div><button class="outline-btn" data-share>${t.share}</button></section><label class="search"><input id="menu-search" value="${liveState.search}" placeholder="${t.search}"></label><nav class="category-nav">${Object.keys(labels).map(k=>`<button class="${liveState.category===k?'active':''}" data-cat="${k}">${labels[k]}</button>`).join('')}</nav>${liveState.category==='all'&&!query?`<section class="dish-section"><div class="dish-section-head"><h2>${t.featured}</h2><span>02</span></div><div class="dish-grid">${featured.map(x=>dish(x,t)).join('')}</div></section>`:''}<section class="dish-section"><div class="dish-section-head"><h2>${liveState.category==='all'&&!query?t.full:labels[liveState.category]}</h2><span>${String(filtered.length).padStart(2,'0')}</span></div><div class="dish-grid">${filtered.filter(x=>!(liveState.category==='all'&&!query&&x.featured)).map(x=>dish(x,t)).join('')||`<div class="empty-results">${lang==='ar'?'لا توجد أصناف مطابقة.':'No dishes match your search.'}</div>`}</div></section></main></div>${totalItems?`<button class="live-cart" data-cart><span>${t.cart} (${totalItems})</span><span>${total.toFixed(2)} ر.س　‹</span></button>`:''}${liveState.cartOpen?cartTemplate(t,total,totalItems):''}${liveState.notice?`<div class="toast">✓　${liveState.notice}</div>`:''}</div></div>`);
  const sc=document.querySelector('.live-scroll');
  if(sc&&prevTop)sc.scrollTop=prevTop;
  bindLive(t);
}
function dish(x,t){const item=x[lang],q=liveState.cart[x.id]||0;return `<article class="dish"><div class="dish-img"><img src="${FOOD}" alt="${item.n}" style="object-position:${x.pos}">${x.featured?'<b>★ Top</b>':''}</div><div class="dish-main"><div><h3>${item.n}</h3><p>${item.d}</p></div><div class="dish-foot"><span class="price-red">${x.p.toFixed(2)} <small>ر.س</small></span>${q?qty(x.id,q,item.n):`<button class="add-btn" data-add="${x.id}">＋ ${t.add}</button>`}</div></div></article>`}
function qty(id,q,label){return `<div class="qty" aria-label="${label}"><button data-minus="${id}">−</button><span>${q}</span><button data-plus="${id}">＋</button></div>`}
function cartTemplate(t,total,totalItems){return `<div class="cart-overlay"><section class="cart-modal"><div class="cart-title"><div><small>${totalItems} ${t.items}</small><h2>${t.cart}</h2></div><button class="cart-close" data-cart-close>×</button></div>${menuItems.filter(x=>liveState.cart[x.id]).map(x=>`<div class="cart-row"><img src="${FOOD}" alt=""><div class="cart-row-main"><strong>${x[lang].n}</strong><small>${(x.p*liveState.cart[x.id]).toFixed(2)} ر.س</small></div>${qty(x.id,liveState.cart[x.id],x[lang].n)}</div>`).join('')}<div class="cart-total"><span>${t.total}</span><span>${total.toFixed(2)} ر.س</span></div><button class="whatsapp" data-send>◌　${liveState.sent?t.ready:t.send}</button><a class="co-ghost" style="text-decoration:none" href="/app/">${t.liveOrder}</a>${liveState.sent?`<p class="sent">${t.body}</p>`:''}</section></div>`}
function bindLive(t){
  document.querySelector('[data-live-close]').addEventListener('click',closeLive);
  document.querySelector('[data-live-lang]').addEventListener('click',()=>{lang=lang==='ar'?'en':'ar';document.querySelector('.live-backdrop')?.remove();renderLanding();openLive()});
  document.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{liveState.category=b.dataset.cat;document.querySelector('.live-backdrop')?.remove();renderLive()}));
  document.querySelector('#menu-search').addEventListener('input',(e)=>{liveState.search=e.target.value;document.querySelector('.live-backdrop')?.remove();renderLive();const input=document.querySelector('#menu-search');input.focus();input.setSelectionRange(input.value.length,input.value.length)});
  document.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>changeCart(b.dataset.add,1)));
  document.querySelectorAll('[data-plus]').forEach(b=>b.addEventListener('click',()=>changeCart(b.dataset.plus,1)));
  document.querySelectorAll('[data-minus]').forEach(b=>b.addEventListener('click',()=>changeCart(b.dataset.minus,-1)));
  document.querySelector('[data-cart]')?.addEventListener('click',()=>{liveState.cartOpen=true;document.querySelector('.live-backdrop')?.remove();renderLive()});
  document.querySelector('[data-cart-close]')?.addEventListener('click',()=>{liveState.cartOpen=false;document.querySelector('.live-backdrop')?.remove();renderLive()});
  document.querySelectorAll('[data-share]').forEach(b=>b.addEventListener('click',shareMenu));
  document.querySelector('[data-send]')?.addEventListener('click',()=>{liveState.sent=true;window.open(`https://wa.me/?text=${encodeURIComponent(`${t.restaurant}\n${t.total}: ${Object.entries(liveState.cart).map(([id,q])=>`${menuItems.find(x=>x.id===id)[lang].n} × ${q}`).join(', ')}`)}`,'_blank','noopener,noreferrer');document.querySelector('.live-backdrop')?.remove();renderLive()});
}
function changeCart(id,delta){const next=Math.max(0,(liveState.cart[id]||0)+delta);if(next)liveState.cart[id]=next;else delete liveState.cart[id];liveState.cartOpen=false;document.querySelector('.live-backdrop')?.remove();renderLive()}
async function shareMenu(){try{if(navigator.share)await navigator.share({title:'Restivo',text:liveText[lang].menu,url:location.href});else{await navigator.clipboard?.writeText(location.href);liveState.notice=liveText[lang].copied;document.querySelector('.live-backdrop')?.remove();renderLive();setTimeout(()=>{liveState.notice='';document.querySelector('.live-backdrop')?.remove();renderLive()},2200)}}catch{}}

fetch('/api/pricing').then(r => r.ok ? r.json() : null).then(d => {
  if (d && d.pricing && typeof d.pricing.pricing_cents === 'number') {
    try {
      priceLabel = new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: d.pricing.pricing_currency || 'USD' }).format(d.pricing.pricing_cents / 100);
    } catch (_) { priceLabel = '$' + (d.pricing.pricing_cents / 100).toFixed(2); }
    // Keep JSON-LD offer honest when the owner edits platform pricing:
    // static HTML ships the platform default, this corrects it at runtime.
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      try {
        const data = JSON.parse(el.textContent);
        if (data && data.offers && data.offers.price) {
          data.offers.price = String(d.pricing.pricing_cents / 100);
          data.offers.priceCurrency = d.pricing.pricing_currency || 'USD';
          el.textContent = JSON.stringify(data);
        }
      } catch (_) { /* malformed block: leave as-is */ }
    });
    renderLanding();
  }
}).catch(() => {});

renderLanding();