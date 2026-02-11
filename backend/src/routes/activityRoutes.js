const express = require('express');
const router = express.Router();
const { getActivityAnalytics } = require('../controllers/activityController');
const { protect } = require('../middleware/authMiddleware');

router.route('/analytics').get(protect, getActivityAnalytics);

module.exports = router;
