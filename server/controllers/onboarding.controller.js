'use strict';

const onboarding = require('../services/onboarding.service');
const capabilities = require('../services/capabilities.service');
const subscriptions = require('../services/subscriptions.service');
const { notFound } = require('../utils/errors');
const { asyncHandler } = require('../utils/errors');
const { assertUuid } = require('../utils/checks');
const v = require('../validators');

function tenantOf(req) {
  if (req.user && req.user.restaurant_id) return req.user.restaurant_id;
  // Platform roles inspect tenant data explicitly (same convention as admin.tenantId).
  if (req.user && (req.user.role === 'owner' || req.user.role === 'staff') && req.query.restaurantId) {
    return assertUuid(req.query.restaurantId, 'restaurantId');
  }
  throw notFound('No business is linked to this account');
}

async function getState(req, res) {
  res.json(await onboarding.getState(tenantOf(req)));
}

async function setStep(req, res) {
  const step = v.validateOnboardingStep(req.body);
  res.json(await onboarding.setStep(tenantOf(req), step));
}

async function getProfile(req, res) {
  res.json(await onboarding.getProfile(tenantOf(req)));
}

async function getCapabilities(req, res) {
  const effective = await capabilities.effectiveFor(tenantOf(req));
  if (!effective) throw notFound('No business is linked to this account');
  res.json(effective);
}

async function getSubscription(req, res) {
  res.json(await subscriptions.statusFor(tenantOf(req)));
}

async function complete(req, res) {
  res.json(await onboarding.complete(tenantOf(req)));
}

module.exports = {
  getState: asyncHandler(getState),
  setStep: asyncHandler(setStep),
  getProfile: asyncHandler(getProfile),
  getCapabilities: asyncHandler(getCapabilities),
  getSubscription: asyncHandler(getSubscription),
  complete: asyncHandler(complete),
};
