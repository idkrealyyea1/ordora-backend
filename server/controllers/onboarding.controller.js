'use strict';

const onboarding = require('../services/onboarding.service');
const { notFound } = require('../utils/errors');
const { asyncHandler } = require('../utils/errors');
const v = require('../validators');

function tenantOf(req) {
  if (!req.user || !req.user.restaurant_id) throw notFound('No business is linked to this account');
  return req.user.restaurant_id;
}

async function getState(req, res) {
  res.json(await onboarding.getState(tenantOf(req)));
}

async function setStep(req, res) {
  const step = v.validateOnboardingStep(req.body);
  res.json(await onboarding.setStep(tenantOf(req), step));
}

async function complete(req, res) {
  res.json(await onboarding.complete(tenantOf(req)));
}

module.exports = {
  getState: asyncHandler(getState),
  setStep: asyncHandler(setStep),
  complete: asyncHandler(complete),
};
