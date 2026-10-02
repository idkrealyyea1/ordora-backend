'use strict';

const { query } = require('../db/pool');

const TYPE_SCHEMA_MAP = {
  restaurant: 'Restaurant',
  cafe: 'Restaurant',
  bakery: 'Restaurant',
  dessert_shop: 'Restaurant',
  cake_business: 'Restaurant',
  cloud_kitchen: 'Restaurant',
  home_kitchen: 'LocalBusiness',
  home_food_business: 'LocalBusiness',
  small_food_business: 'LocalBusiness',
};

const TYPE_LABELS = {
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  bakery: 'Bakery',
  dessert_shop: 'Dessert Shop',
  cake_business: 'Cake Shop',
  cloud_kitchen: 'Cloud Kitchen',
  home_kitchen: 'Home Kitchen',
  home_food_business: 'Home Food Business',
  small_food_business: 'Food Business',
};

async function generateBusinessMetadata(business, origin) {
  const typeLabel = TYPE_LABELS[business.business_type] || 'Food Business';
  const title = `${business.name} — ${typeLabel} | Restivo`;
  const description = business.description
    ? `${business.description.slice(0, 155)}`
    : `Order from ${business.name}. Browse the menu and place your order online.`;
  const canonical = `${origin}/restaurant/${business.slug}`;
  const schemaType = TYPE_SCHEMA_MAP[business.business_type] || 'LocalBusiness';

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: business.name,
  };

  if (business.address) {
    structuredData.address = {
      '@type': 'PostalAddress',
      addressLocality: business.address,
    };
  }

  if (business.phone) {
    structuredData.telephone = business.phone;
  }

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogType: 'restaurant',
    ogImage: business.cover_path || `${origin}/icons/icon-512.png`,
    structuredData,
    noindex: business.is_active === false,
  };
}

async function getBusinessBySlug(slug) {
  const { rows } = await query(
    `SELECT r.id, r.name, r.slug, r.business_type, r.is_active,
            s.description, s.address, s.phone, s.cover_path
     FROM restaurants r
     LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
     WHERE r.slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

module.exports = { generateBusinessMetadata, getBusinessBySlug, TYPE_SCHEMA_MAP, TYPE_LABELS };
