'use strict';

const express = require('express');
const onboarding = require('../controllers/onboarding.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/state', onboarding.getState);
router.put('/state', onboarding.setStep);
router.get('/profile', onboarding.getProfile);
router.get('/capabilities', onboarding.getCapabilities);
router.get('/subscription', onboarding.getSubscription);
router.post('/complete', onboarding.complete);

module.exports = router;
