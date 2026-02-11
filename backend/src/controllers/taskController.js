const Task = require('../models/Task');
const Project = require('../models/Project');
const asyncHandler = require('express-async-handler');

// Non-admin can access task if they are assignee or reporter (creator)
const canAccessTask = (task, user) =>
    user.role === 'admin' ||
    task.assignee?.equals(user._id) ||
    (task.reporter && task.reporter.equals(user._id));

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
const getTasks = asyncHandler(async (req, res) => {
    // Exclude recurring templates (Daily/Weekly) so only instances and one-off tasks appear
    const baseQuery = {
        $or: [
            { parentRecurringId: { $exists: true, $ne: null } },
            { recurring: { $in: [null, ''] } },
            { recurring: { $exists: false } }
        ]
    };
    let tasks;
    if (req.user.role === 'admin') {
        tasks = await Task.find({ ...baseQuery })
            .populate('project', 'name')
            .populate('assignee', 'name avatar')
            .populate('reporter', 'name');
    } else {
        // Employee: tasks where they are assignee, reporter, OR task is in a project they're on the team of
        const projectsWhereTeamMember = await Project.find({ team: req.user._id }).select('_id');
        const projectIds = projectsWhereTeamMember.map(p => p._id);
        tasks = await Task.find({
            $and: [
                baseQuery,
                {
                    $or: [
                        { assignee: req.user._id },
                        { reporter: req.user._id },
                        { project: { $in: projectIds } }
                    ]
                }
            ]
        })
            .populate('project', 'name')
            .populate('assignee', 'name avatar')
            .populate('reporter', 'name');
    }
    
    // Transform tasks to match frontend format
    const transformedTasks = tasks.map(task => ({
        id: task._id.toString(),
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        deadline: task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '',
        project: task.project?.name || '',
        assignee: task.assignee?.name || '',
        tags: task.tags || [],
        subtasks: task.subtasks || [],
        recurring: task.recurring || undefined,
        recurringDays: task.recurringDays || undefined,
        moduleId: task.moduleId || undefined,
        progress: task.progress || 0,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        history: task.history || []
    }));
    
    res.json(transformedTasks);
});

// @desc    Get recurring templates (for Recurring page in sidebar)
// @route   GET /api/tasks/recurring-templates
// @access  Private
const getRecurringTemplates = asyncHandler(async (req, res) => {
    const base = {
        recurring: { $in: ['Daily', 'Weekly'] },
        $or: [
            { parentRecurringId: null },
            { parentRecurringId: { $exists: false } }
        ]
    };
    let query = base;
    if (req.user.role !== 'admin') {
        const projectsWhereTeamMember = await Project.find({ team: req.user._id }).select('_id');
        const projectIds = projectsWhereTeamMember.map(p => p._id);
        query = {
            $and: [
                base,
                { $or: [ { assignee: req.user._id }, { reporter: req.user._id }, { project: { $in: projectIds } } ] }
            ]
        };
    }
    const tasks = await Task.find(query)
        .populate('project', 'name')
        .populate('assignee', 'name avatar')
        .populate('reporter', 'name');
    const transformed = tasks.map(task => ({
        id: task._id.toString(),
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        deadline: task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '',
        project: task.project?.name || '',
        assignee: task.assignee?.name || '',
        tags: task.tags || [],
        subtasks: task.subtasks || [],
        recurring: task.recurring || undefined,
        recurringDays: task.recurringDays || undefined,
        moduleId: task.moduleId || undefined,
        progress: task.progress || 0,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        history: task.history || []
    }));
    res.json(transformed);
});

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id)
        .populate('project', 'name')
        .populate('assignee', 'name avatar')
        .populate('reporter', 'name');

    if (!task) {
        res.status(404);
        throw new Error('Task not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && !task.assignee?.equals(req.user._id)) {
        res.status(401);
        throw new Error('Not authorized to view this task');
    }

    res.json({
        id: task._id.toString(),
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        deadline: task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '',
        project: task.project?.name || '',
        assignee: task.assignee?.name || '',
        tags: task.tags || [],
        subtasks: task.subtasks || [],
        recurring: task.recurring || undefined,
        recurringDays: task.recurringDays || undefined,
        moduleId: task.moduleId || undefined,
        progress: task.progress || 0,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        history: task.history || []
    });
});

// @desc    Create a task
// @route   POST /api/tasks
// @access  Private
const createTask = asyncHandler(async (req, res) => {
    const { title, description, priority, deadline, project, assignee, subtasks, recurring, recurringDays, moduleId } = req.body;
    const tags = req.body.tags;

    if (!title || !project) {
        res.status(400);
        throw new Error('Title and project are required');
    }
    if (recurring === 'Weekly' && (!recurringDays || !Array.isArray(recurringDays) || recurringDays.length === 0)) {
        res.status(400);
        throw new Error('Weekly recurring requires at least one day selected');
    }

    // Find project by name if string, or use ID
    let projectId;
    if (typeof project === 'string') {
        const projectDoc = await Project.findOne({ name: project });
        if (!projectDoc) {
            res.status(404);
            throw new Error('Project not found');
        }
        projectId = projectDoc._id;
    } else {
        projectId = project;
    }

    // Parse deadline if string (supports "16-Aug-2025" or "2025-08-16")
    let deadlineDate;
    if (deadline) {
        if (typeof deadline === 'string') {
            const parts = deadline.split('-');
            if (parts.length === 3) {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthIndex = months.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
                if (monthIndex !== -1) {
                    const day = parseInt(parts[0], 10);
                    const year = parseInt(parts[2], 10);
                    if (!isNaN(day) && !isNaN(year)) deadlineDate = new Date(year, monthIndex, day);
                }
                if (!deadlineDate && /^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
                    deadlineDate = new Date(deadline + 'T00:00:00');
                }
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
                deadlineDate = new Date(deadline + 'T00:00:00');
            }
        } else {
            deadlineDate = deadline;
        }
    }

    const normalizedTags = (() => {
        if (tags == null) return [];
        if (Array.isArray(tags)) return tags.map((t) => (t != null ? String(t).trim() : '')).filter(Boolean);
        return [String(tags).trim()].filter(Boolean);
    })();

    const taskData = {
        title,
        description,
        priority: priority || 'Medium',
        deadline: deadlineDate,
        project: projectId,
        assignee: assignee || req.user._id,
        reporter: req.user._id,
        tags: normalizedTags,
        subtasks: subtasks ? subtasks.map((st, idx) => ({
            id: st.id || `s${idx + 1}`,
            title: st.title,
            completed: st.completed || false
        })) : [],
        history: [{ status: 'To Do', timestamp: Date.now() }]
    };

    // Only add recurring if it has a valid value (not null, undefined, or empty string)
    if (recurring && recurring !== '' && recurring !== null && ['Daily', 'Weekly'].includes(recurring)) {
        taskData.recurring = recurring;
    }
    if (recurring === 'Weekly' && recurringDays && Array.isArray(recurringDays)) {
        taskData.recurringDays = recurringDays;
    }

    // Only add moduleId if provided
    if (moduleId) {
        taskData.moduleId = moduleId;
    }

    const templateTask = new Task(taskData);
    const savedTemplate = await templateTask.save();

    let taskToReturn = savedTemplate;
    // For Daily/Weekly, create the first instance so it shows in To Do immediately
    if ((recurring === 'Daily' || recurring === 'Weekly') && deadlineDate) {
        const instanceData = {
            title: savedTemplate.title,
            description: savedTemplate.description,
            priority: savedTemplate.priority,
            status: 'To Do',
            deadline: deadlineDate,
            project: savedTemplate.project,
            assignee: savedTemplate.assignee,
            reporter: savedTemplate.reporter,
            tags: savedTemplate.tags || [],
            subtasks: savedTemplate.subtasks || [],
            moduleId: savedTemplate.moduleId,
            parentRecurringId: savedTemplate._id,
            history: [{ status: 'To Do', timestamp: Date.now() }]
        };
        const instance = new Task(instanceData);
        const savedInstance = await instance.save();
        await savedInstance.populate('project', 'name');
        await savedInstance.populate('assignee', 'name avatar');
        taskToReturn = savedInstance;
    } else {
        await savedTemplate.populate('project', 'name');
        await savedTemplate.populate('assignee', 'name avatar');
    }

    const formatDeadline = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '';

    res.status(201).json({
        id: taskToReturn._id.toString(),
        title: taskToReturn.title,
        description: taskToReturn.description,
        priority: taskToReturn.priority,
        status: taskToReturn.status,
        deadline: formatDeadline(taskToReturn.deadline),
        project: taskToReturn.project?.name || '',
        assignee: taskToReturn.assignee?.name || '',
        tags: taskToReturn.tags || [],
        subtasks: taskToReturn.subtasks || [],
        recurring: taskToReturn.recurring || undefined,
        moduleId: taskToReturn.moduleId || undefined,
        progress: taskToReturn.progress || 0,
        startedAt: taskToReturn.startedAt,
        completedAt: taskToReturn.completedAt,
        history: taskToReturn.history || []
    });
});

// @desc    Update a task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);

    if (!task) {
        res.status(404);
        throw new Error('Task not found');
    }

    if (!canAccessTask(task, req.user)) {
        res.status(401);
        throw new Error('Not authorized to update this task');
    }

    const { title, description, priority, deadline, project, assignee, tags, subtasks, recurring, moduleId, progress } = req.body;

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority) task.priority = priority;
    if (deadline !== undefined) {
        if (typeof deadline === 'string' && deadline.includes('-')) {
            const parts = deadline.split('-');
            if (parts.length === 3) {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const day = parseInt(parts[0]);
                const monthIndex = months.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
                const year = parseInt(parts[2]);
                if (monthIndex !== -1) {
                    task.deadline = new Date(year, monthIndex, day);
                }
            }
        } else if (deadline) {
            task.deadline = deadline;
        }
    }
    if (project) {
        if (typeof project === 'string') {
            const projectDoc = await Project.findOne({ name: project });
            if (projectDoc) task.project = projectDoc._id;
        } else {
            task.project = project;
        }
    }
    if (assignee !== undefined) task.assignee = assignee;
    if (tags !== undefined) task.tags = tags;
    if (subtasks !== undefined) {
        task.subtasks = subtasks.map((st, idx) => ({
            id: st.id || `s${idx + 1}`,
            title: st.title,
            completed: st.completed || false
        }));
    }
    if (recurring !== undefined) {
        if (recurring && ['Daily', 'Weekly', 'Monthly'].includes(recurring)) {
            task.recurring = recurring;
        } else {
            task.recurring = undefined; // Remove recurring if set to null/empty
        }
    }
    if (moduleId !== undefined) task.moduleId = moduleId;
    if (progress !== undefined) task.progress = Math.max(0, Math.min(100, progress));

    const updatedTask = await task.save();
    await updatedTask.populate('project', 'name');
    await updatedTask.populate('assignee', 'name avatar');

    res.json({
        id: updatedTask._id.toString(),
        title: updatedTask.title,
        description: updatedTask.description,
        priority: updatedTask.priority,
        status: updatedTask.status,
        deadline: updatedTask.deadline ? new Date(updatedTask.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '',
        project: updatedTask.project?.name || '',
        assignee: updatedTask.assignee?.name || '',
        tags: updatedTask.tags || [],
        subtasks: updatedTask.subtasks || [],
        recurring: updatedTask.recurring || undefined,
        moduleId: updatedTask.moduleId || undefined,
        progress: updatedTask.progress || 0,
        startedAt: updatedTask.startedAt,
        completedAt: updatedTask.completedAt,
        history: updatedTask.history || []
    });
});

// @desc    Update task status
// @route   PATCH /api/tasks/:id/status
// @access  Private
const updateTaskStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
        res.status(404);
        throw new Error('Task not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && !task.assignee?.equals(req.user._id)) {
        res.status(401);
        throw new Error('Not authorized to update this task');
    }

    if (!['To Do', 'In Progress', 'Completed', 'Review'].includes(status)) {
        res.status(400);
        throw new Error('Invalid status');
    }

    const oldStatus = task.status;
    task.status = status;
    
    // Add to history
    if (!task.history) task.history = [];
    task.history.push({ status, timestamp: Date.now() });

    // Handle status-specific logic
    if (status === 'In Progress' && oldStatus === 'To Do') {
        task.startedAt = Date.now();
        task.progress = task.progress || 0;
    }
    
    if (status === 'Completed') {
        task.completedAt = Date.now();
        task.progress = 100;
        
        // Handle recurring tasks
        if (task.recurring) {
            const deadlineDate = task.deadline ? new Date(task.deadline) : new Date();
            let nextDeadline = new Date(deadlineDate);
            
            if (task.recurring === 'Daily') {
                nextDeadline.setDate(nextDeadline.getDate() + 1);
            } else if (task.recurring === 'Weekly') {
                nextDeadline.setDate(nextDeadline.getDate() + 7);
            } else if (task.recurring === 'Monthly') {
                nextDeadline.setMonth(nextDeadline.getMonth() + 1);
            }
            
            // Create new recurring task instance
            const newTask = new Task({
                title: task.title,
                description: task.description,
                priority: task.priority,
                status: 'To Do',
                deadline: nextDeadline,
                project: task.project,
                assignee: task.assignee,
                reporter: task.reporter,
                tags: task.tags,
                subtasks: task.subtasks.map(st => ({ ...st, completed: false })),
                recurring: task.recurring,
                moduleId: task.moduleId,
                history: [{ status: 'To Do', timestamp: Date.now() }]
            });
            await newTask.save();
        }
    }

    const updatedTask = await task.save();
    await updatedTask.populate('project', 'name');
    await updatedTask.populate('assignee', 'name avatar');

    res.json({
        id: updatedTask._id.toString(),
        title: updatedTask.title,
        description: updatedTask.description,
        priority: updatedTask.priority,
        status: updatedTask.status,
        deadline: updatedTask.deadline ? new Date(updatedTask.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '',
        project: updatedTask.project?.name || '',
        assignee: updatedTask.assignee?.name || '',
        tags: updatedTask.tags || [],
        subtasks: updatedTask.subtasks || [],
        recurring: updatedTask.recurring || undefined,
        moduleId: updatedTask.moduleId || undefined,
        progress: updatedTask.progress || 0,
        startedAt: updatedTask.startedAt,
        completedAt: updatedTask.completedAt,
        history: updatedTask.history || []
    });
});

// @desc    Update task progress
// @route   PATCH /api/tasks/:id/progress
// @access  Private
const updateTaskProgress = asyncHandler(async (req, res) => {
    const { progress } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
        res.status(404);
        throw new Error('Task not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && !task.assignee?.equals(req.user._id)) {
        res.status(401);
        throw new Error('Not authorized to update this task');
    }

    task.progress = Math.max(0, Math.min(100, progress || 0));
    const updatedTask = await task.save();
    await updatedTask.populate('project', 'name');
    await updatedTask.populate('assignee', 'name avatar');

    res.json({
        id: updatedTask._id.toString(),
        progress: updatedTask.progress
    });
});

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);

    if (!task) {
        res.status(404);
        throw new Error('Task not found');
    }

    if (!canAccessTask(task, req.user)) {
        res.status(401);
        throw new Error('Not authorized to delete this task');
    }

    await task.deleteOne();
    res.json({ message: 'Task removed', id: task._id.toString() });
});

// @desc    Get tasks for a specific employee
// @route   GET /api/tasks/employee/:employeeId
// @access  Private/Admin
const getEmployeeTasks = asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    
    const tasks = await Task.find({ assignee: employeeId })
        .populate('project', 'name')
        .populate('assignee', 'name avatar')
        .populate('reporter', 'name')
        .sort({ createdAt: -1 });
    
    const transformedTasks = tasks.map(task => ({
        id: task._id.toString(),
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        deadline: task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '',
        project: task.project?.name || '',
        assignee: task.assignee?.name || '',
        tags: task.tags || [],
        subtasks: task.subtasks || [],
        recurring: task.recurring || undefined,
        moduleId: task.moduleId || undefined,
        progress: task.progress || 0,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        history: task.history || []
    }));
    
    res.json(transformedTasks);
});

module.exports = {
    getTasks,
    getRecurringTemplates,
    getTaskById,
    createTask,
    updateTask,
    updateTaskStatus,
    updateTaskProgress,
    deleteTask,
    getEmployeeTasks
};
