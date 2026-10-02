'use strict';
const express = require('express');
const { asyncHandler } = require('../utils/errors');
const config = require('../../config');
const router = express.Router();

// Redirect /r/:slug → /restaurant/:slug (canonical storefront)
router.get('/r/:slug', (req, res) => {
  const slug = String(req.params.slug).toLowerCase().trim();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return res.status(404).send('Not found');
  res.redirect(301, '/restaurant/' + encodeURIComponent(slug));
});

// robots.txt
router.get('/robots.txt', (req, res) => {
  const origin = config.appUrl || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(
`User-agent: *
Allow: /
Allow: /restaurant/
Allow: /features.html
Allow: /how-it-works.html
Allow: /pricing.html
Allow: /for-restaurants.html
Allow: /for-cafes.html
Allow: /for-dessert-shops.html
Allow: /for-cake-shops.html
Allow: /contact.html
Disallow: /api/
Disallow: /login.html
Disallow: /signup.html
Disallow: /track
Disallow: /admin.html
Disallow: /owner.html
Disallow: /delivery.html
Disallow: /leads.html
Disallow: /offer/
Sitemap: ${origin.replace(/\/+$/,'')}/sitemap.xml
`);
});

// sitemap.xml — includes static marketing pages + active restaurants
router.get('/sitemap.xml', asyncHandler(async (req, res) => {
  const origin = (config.appUrl || `${req.protocol}://${req.get('host')}`).replace(/\/+$/,'');
  const now = new Date().toISOString();
  const staticPages = [
    '/', '/features.html', '/how-it-works.html', '/pricing.html',
    '/for-restaurants.html', '/for-cafes.html', '/for-dessert-shops.html', '/for-cake-shops.html',
    '/contact.html', '/resources/', '/app/'
  ];
  let restaurantUrls = [];
  try {
    const { query } = require('../db/pool');
    const { rows } = await query(`SELECT r.slug, r.updated_at FROM restaurants r
      LEFT JOIN subscriptions s ON s.restaurant_id = r.id
      WHERE r.is_active AND (r.subscription_ends_at IS NULL OR r.subscription_ends_at > now())
        AND (s.status IS NULL OR s.status IN ('trial', 'active', 'grace')
          OR (s.status = 'cancelled'
            AND COALESCE(s.cancel_effective_at, s.current_period_end, now()) > now()))
        AND (s.status IS NULL OR s.status <> 'suspended')
      ORDER BY r.updated_at DESC LIMIT 500`);
    restaurantUrls = rows.map(r => ({ loc: `${origin}/restaurant/${r.slug}`, lastmod: (r.updated_at || now).toISOString().slice(0,10) }));
  } catch (_) { /* DB not reachable → sitemap with static only */ }
  const urls = [
    ...staticPages.map(p => ({ loc: `${origin}${p}`, lastmod: now.slice(0,10), priority: p==='/' ? '1.0' : '0.8' })),
    ...restaurantUrls.map(u => ({ ...u, priority: '0.6', changefreq: 'weekly' }))
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(u=>`  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq||'weekly'}</changefreq><priority>${u.priority||'0.6'}</priority><xhtml:link rel="alternate" hreflang="ar" href="${u.loc}${u.loc.includes('?')?'&':'?'}lang=ar"/><xhtml:link rel="alternate" hreflang="en" href="${u.loc}${u.loc.includes('?')?'&':'?'}lang=en"/></url>`).join('\n')}
</urlset>`;
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
}));

module.exports = router;
