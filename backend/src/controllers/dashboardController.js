const Task = require('../models/Task');
const Project = require('../models/Project');
const asyncHandler = require('express-async-handler');

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = asyncHandler(async (req, res) => {
    let tasks, projects;

    if (req.user.role === 'admin') {
        tasks = await Task.find({});
        projects = await Project.find({});
    } else {
        // Employees: stats based on tasks ASSIGNED to them (same as task list)
        tasks = await Task.find({ assignee: req.user._id });
        
        // Get unique projects from tasks (projects user has worked on)
        // Use distinct to get unique project IDs
        const projectIds = await Task.distinct('project', { assignee: req.user._id });
        
        // Query projects by their ObjectIds
        if (projectIds.length > 0) {
            projects = await Project.find({ _id: { $in: projectIds } });
        } else {
            projects = [];
        }
    }

    const completedCount = tasks.filter(t => t.status === 'Completed').length;
    const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
    
    // Calculate due today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dueTodayCount = tasks.filter(t => {
        if (!t.deadline) return false;
        const deadline = new Date(t.deadline);
        deadline.setHours(0, 0, 0, 0);
        return deadline.getTime() === today.getTime();
    }).length;

    res.json({
        totalProjects: projects.length,
        completedTasks: completedCount,
        inProgressTasks: inProgressCount,
        dueTodayTasks: dueTodayCount
    });
});

module.exports = { getDashboardStats };
