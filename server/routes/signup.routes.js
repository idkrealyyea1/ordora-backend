'use strict';

const express = require('express');
const signup = require('../controllers/signup.controller');
const { authLimiter } = require('../middleware/ratelimit');

const router = express.Router();

router.post('/signup', authLimiter, signup.signup);
router.get('/signup/slug-availability', authLimiter, signup.slugAvailability);

module.exports = router;
