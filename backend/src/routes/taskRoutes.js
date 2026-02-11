const express = require('express');
const router = express.Router();
const {
    getTasks,
    getRecurringTemplates,
    getTaskById,
    createTask,
    updateTask,
    updateTaskStatus,
    updateTaskProgress,
    deleteTask,
    getEmployeeTasks
} = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/roleMiddleware');

// Task CRUD (recurring-templates before :id)
router.get('/recurring-templates', protect, getRecurringTemplates);
router.route('/').get(protect, getTasks).post(protect, createTask);
router.route('/:id').get(protect, getTaskById).put(protect, updateTask).delete(protect, deleteTask);

// Task status and progress
router.route('/:id/status').patch(protect, updateTaskStatus);
router.route('/:id/progress').patch(protect, updateTaskProgress);

// Employee tasks (Admin only)
router.route('/employee/:employeeId').get(protect, admin, getEmployeeTasks);

module.exports = router;
