const express = require('express');
const router = express.Router();
const {
    authUser,
    registerUser,
    getUserProfile,
    getUsers,
    getEmployeesWithTasks,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/roleMiddleware');

router.post('/register', registerUser);
router.post('/login', authUser);
router.route('/profile').get(protect, getUserProfile);
router.route('/users').get(protect, admin, getUsers); // Admin only
router.route('/employees-with-tasks').get(protect, admin, getEmployeesWithTasks); // Admin only

module.exports = router;
