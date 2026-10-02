'use strict';

/**
 * Public self-service signup controller. Thin by convention: validate,
 * delegate to services, shape the envelope. Tenant identity is created
 * server-side; nothing about plan, capability, or tenant id is read
 * from the request (validateSignup rejects such fields).
 */

const signupService = require('../services/signup.service');
const restaurants = require('../services/restaurants.service');
const businessTypes = require('../services/business-types.service');
const { forbidden } = require('../utils/errors');
const { asyncHandler } = require('../utils/errors');
const { withSlugSuffix } = require('../utils/checks');
const v = require('../validators');

async function signup(req, res) {
  if (req.user && req.user.restaurant_id) {
    throw forbidden('BUSINESS_ALREADY_EXISTS', 'This account already owns a business');
  }
  const data = v.validateSignup(req.body);
  const { user, restaurant, trialEndsAt } = await signupService.signup(data);

  // Same fixation-safe sign-in as login.
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
  req.session.userId = user.id;

  res.status(201).json({
    user: { id: user.id, username: user.username, role: user.role },
    business: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      businessType: data.businessType,
      onboardingStatus: restaurant.onboarding_status,
      onboardingStep: restaurant.onboarding_step,
    },
    trialEndsAt,
  });
}

async function slugAvailability(req, res) {
  const base = v.validateSlugAvailability(req.query);
  if (!(await restaurants.slugExists(base))) {
    return res.json({ slug: base, available: true, suggestion: null });
  }
  let suggestion = null;
  for (let attempt = 1; attempt < signupService.MAX_SLUG_ATTEMPTS; attempt++) {
    const variant = withSlugSuffix(base, attempt);
    if (!(await restaurants.slugExists(variant))) {
      suggestion = variant;
      break;
    }
  }
  res.json({ slug: base, available: false, suggestion });
}

module.exports = {
  signup: asyncHandler(signup),
  slugAvailability: asyncHandler(slugAvailability),
  businessTypes: (req, res) => res.json({ types: businessTypes.CHOOSER }),
};
