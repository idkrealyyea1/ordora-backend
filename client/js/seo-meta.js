'use strict';
// Sets canonical + og:url + hreflang on marketing pages at runtime.
(function () {
  var url = location.origin + location.pathname;
  function ensureLink(rel, href, attrs) {
    var sel = 'link[rel="' + rel + '"]' + (attrs && attrs.hreflang ? '[hreflang="' + attrs.hreflang + '"]' : '');
    var el = document.head.querySelector(sel);
    if (!el) {
      el = document.createElement('link');
      el.rel = rel;
      if (attrs && attrs.hreflang) el.setAttribute('hreflang', attrs.hreflang);
      document.head.appendChild(el);
    }
    el.href = href;
  }
  ensureLink('canonical', url);
  var og = document.head.querySelector('meta[property="og:url"]');
  if (!og) { og = document.createElement('meta'); og.setAttribute('property', 'og:url'); document.head.appendChild(og); }
  og.content = url;
  ensureLink('alternate', url + '?lang=ar', { hreflang: 'ar' });
  ensureLink('alternate', url + '?lang=en', { hreflang: 'en' });
  ensureLink('alternate', url + '?lang=ar', { hreflang: 'x-default' });
})();
