const Task = require('../models/Task');
const Project = require('../models/Project');
const asyncHandler = require('express-async-handler');

// @desc    Get activity analytics
// @route   GET /api/activity/analytics
// @access  Private
const getActivityAnalytics = asyncHandler(async (req, res) => {
    let tasks, projects;

    if (req.user.role === 'admin') {
        tasks = await Task.find({});
        projects = await Project.find({});
    } else {
        const userProjects = await Project.find({ team: req.user._id });
        const projectIds = userProjects.map(p => p._id);
        tasks = await Task.find({ project: { $in: projectIds } });
        projects = userProjects;
    }

    // Weekly task overview (last 7 days)
    const weeklyData = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        const dayTasks = tasks.filter(t => {
            if (!t.createdAt) return false;
            const taskDate = new Date(t.createdAt);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === date.getTime();
        });

        const completedTasks = dayTasks.filter(t => {
            if (!t.completedAt) return false;
            const completedDate = new Date(t.completedAt);
            completedDate.setHours(0, 0, 0, 0);
            return completedDate.getTime() === date.getTime();
        });

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        weeklyData.push({
            name: dayNames[date.getDay()],
            tasks: dayTasks.length,
            completed: completedTasks.length
        });
    }

    // Productivity trend (last 4 weeks)
    const productivityData = [];
    for (let week = 3; week >= 0; week--) {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - (week * 7) - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekTasks = tasks.filter(t => {
            if (!t.completedAt) return false;
            const completedDate = new Date(t.completedAt);
            return completedDate >= weekStart && completedDate <= weekEnd;
        });

        // Simple productivity score based on completed tasks
        const score = weekTasks.length * 100; // Base score

        productivityData.push({
            name: `Wk ${4 - week}`,
            score: score
        });
    }

    // Recent project activity
    const projectActivity = await Promise.all(projects.map(async (project) => {
        const projectTasks = await Task.find({ project: project._id });
        const tasksCount = projectTasks.length;
        const completedTasks = projectTasks.filter(t => t.status === 'Completed').length;
        const completion = tasksCount === 0 ? 0 : Math.round((completedTasks / tasksCount) * 100);

        return {
            id: project._id.toString(),
            name: project.name,
            status: 'Active',
            completion: completion
        };
    }));

    res.json({
        weeklyOverview: weeklyData,
        productivityTrend: productivityData,
        projectActivity: projectActivity
    });
});

module.exports = { getActivityAnalytics };
