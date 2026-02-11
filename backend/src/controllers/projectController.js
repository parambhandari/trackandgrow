const Project = require('../models/Project');
const Task = require('../models/Task');
const asyncHandler = require('express-async-handler');
const { cloudinary, isConfigured } = require('../config/cloudinary');

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
const getProjects = asyncHandler(async (req, res) => {
    let projects;
    if (req.user.role === 'admin') {
        projects = await Project.find({}).populate('manager', 'name email').populate('team', 'name avatar');
    } else {
        // Employees see projects they are assigned to
        projects = await Project.find({ team: req.user._id }).populate('manager', 'name email').populate('team', 'name avatar');
    }
    
    // Calculate tasksCount and completedTasks for each project
    const projectsWithStats = await Promise.all(projects.map(async (project) => {
        const tasks = await Task.find({ project: project._id });
        const tasksCount = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'Completed').length;
        
        return {
            ...project.toObject(),
            id: project._id.toString(),
            tasksCount,
            completedTasks
        };
    }));
    
    res.json(projectsWithStats);
});

// @desc    Get projects for dropdown/list (admin: all; employee: only assigned)
// @route   GET /api/projects/all
// @access  Private
const getAllProjects = asyncHandler(async (req, res) => {
    let projects;
    if (req.user.role === 'admin') {
        projects = await Project.find({}).populate('manager', 'name email').populate('team', 'name avatar');
    } else {
        // Employees see only projects assigned to them (same as GET /api/projects)
        projects = await Project.find({ team: req.user._id }).populate('manager', 'name email').populate('team', 'name avatar');
    }
    
    const projectsWithStats = await Promise.all(projects.map(async (project) => {
        const tasks = await Task.find({ project: project._id });
        const tasksCount = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'Completed').length;
        
        return {
            ...project.toObject(),
            id: project._id.toString(),
            tasksCount,
            completedTasks
        };
    }));
    
    res.json(projectsWithStats);
});

// @desc    Create a project
// @route   POST /api/projects
// @access  Private/Admin
const createProject = asyncHandler(async (req, res) => {
    const { name, category, iconColor, initial, team, modules, folders, files } = req.body;

    const project = new Project({
        name,
        category,
        iconColor: iconColor || 'bg-blue-100 text-blue-600',
        initial: initial || name.substring(0, 1).toUpperCase(),
        manager: req.user._id,
        team: team || [],
        modules: modules || [],
        folders: folders || [],
        files: files || []
    });

    const createdProject = await project.save();
    res.status(201).json({
        ...createdProject.toObject(),
        id: createdProject._id.toString(),
        tasksCount: 0,
        completedTasks: 0
    });
});

// @desc    Get project by ID
// @route   GET /api/projects/:id
// @access  Private
const getProjectById = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id).populate('team', 'name avatar');

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check access (team may be populated or array of ObjectIds)
    const userIdStr = req.user._id.toString();
    const teamIds = (project.team || []).map(m => (m._id || m).toString());
    if (req.user.role !== 'admin' && !teamIds.includes(userIdStr)) {
        res.status(401);
        throw new Error('Not authorized to view this project');
    }

    // Calculate stats
    const tasks = await Task.find({ project: project._id });
    const tasksCount = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Completed').length;

    res.json({
        ...project.toObject(),
        id: project._id.toString(),
        tasksCount,
        completedTasks
    });
});

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private/Admin
const updateProject = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && !project.manager.equals(req.user._id)) {
        res.status(401);
        throw new Error('Not authorized to update this project');
    }

    const { name, category, iconColor, initial, team } = req.body;

    if (name) project.name = name;
    if (category) project.category = category;
    if (iconColor) project.iconColor = iconColor;
    if (initial) project.initial = initial;
    if (team !== undefined) {
        // Normalize team to array of valid MongoDB ObjectIds (24-char hex strings only)
        let raw = team;
        if (typeof team === 'string') {
            try {
                raw = JSON.parse(team);
            } catch {
                raw = [];
            }
        }
        if (!Array.isArray(raw)) raw = [];
        project.team = raw
            .map((id) => (id && typeof id === 'object' && id._id ? id._id : id))
            .map((id) => String(id).trim())
            .filter((str) => /^[a-fA-F0-9]{24}$/.test(str));
    }

    const updatedProject = await project.save();
    
    // Calculate stats
    const tasks = await Task.find({ project: updatedProject._id });
    const tasksCount = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Completed').length;

    res.json({
        ...updatedProject.toObject(),
        id: updatedProject._id.toString(),
        tasksCount,
        completedTasks
    });
});

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private/Admin
const deleteProject = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && !project.manager.equals(req.user._id)) {
        res.status(401);
        throw new Error('Not authorized to delete this project');
    }

    // Delete all tasks associated with this project
    await Task.deleteMany({ project: project._id });

    await project.deleteOne();
    res.json({ message: 'Project removed', id: project._id.toString() });
});

// @desc    Add a module to a project
// @route   POST /api/projects/:id/modules
// @access  Private/Admin
const addModule = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check authorization - Admin, manager, or team member can add modules
    const isTeamMember = project.team.some(memberId => memberId.equals(req.user._id));
    if (req.user.role !== 'admin' && !project.manager.equals(req.user._id) && !isTeamMember) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const { name } = req.body;
    if (!name) {
        res.status(400);
        throw new Error('Module name is required');
    }

    const newModule = {
        id: Date.now().toString(),
        name: name.trim()
    };

    project.modules.push(newModule);
    await project.save();

    res.json({
        ...project.toObject(),
        id: project._id.toString()
    });
});

// @desc    Delete a module from a project
// @route   DELETE /api/projects/:id/modules/:moduleId
// @access  Private/Admin
const deleteModule = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check authorization - Admin, manager, or team member can add modules
    const isTeamMember = project.team.some(memberId => memberId.equals(req.user._id));
    if (req.user.role !== 'admin' && !project.manager.equals(req.user._id) && !isTeamMember) {
        res.status(401);
        throw new Error('Not authorized');
    }

    project.modules = project.modules.filter(m => m.id !== req.params.moduleId);
    await project.save();

    res.json({
        ...project.toObject(),
        id: project._id.toString()
    });
});

// @desc    Add a folder to a project
// @route   POST /api/projects/:id/folders
// @access  Private/Admin
const addFolder = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check authorization - Admin, manager, or team member can add modules
    const isTeamMember = project.team.some(memberId => memberId.equals(req.user._id));
    if (req.user.role !== 'admin' && !project.manager.equals(req.user._id) && !isTeamMember) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const { name, moduleId } = req.body;
    if (!name) {
        res.status(400);
        throw new Error('Folder name is required');
    }

    const newFolder = {
        id: 'fld' + Date.now().toString(),
        name: name.trim(),
        moduleId: moduleId || undefined
    };

    project.folders.push(newFolder);
    await project.save();

    res.json({
        ...project.toObject(),
        id: project._id.toString()
    });
});

// @desc    Rename a folder in a project
// @route   PATCH /api/projects/:id/folders/:folderId
// @access  Private/Admin
const renameFolder = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check authorization - Admin, manager, or team member can add modules
    const isTeamMember = project.team.some(memberId => memberId.equals(req.user._id));
    if (req.user.role !== 'admin' && !project.manager.equals(req.user._id) && !isTeamMember) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const { name } = req.body;
    if (!name) {
        res.status(400);
        throw new Error('Folder name is required');
    }

    const folder = project.folders.id(req.params.folderId);
    if (!folder) {
        res.status(404);
        throw new Error('Folder not found');
    }

    folder.name = name.trim();
    await project.save();

    res.json({
        ...project.toObject(),
        id: project._id.toString()
    });
});

// @desc    Delete a folder from a project
// @route   DELETE /api/projects/:id/folders/:folderId
// @access  Private/Admin
const deleteFolder = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check authorization - Admin, manager, or team member can add modules
    const isTeamMember = project.team.some(memberId => memberId.equals(req.user._id));
    if (req.user.role !== 'admin' && !project.manager.equals(req.user._id) && !isTeamMember) {
        res.status(401);
        throw new Error('Not authorized');
    }

    // Remove folder and all files in it
    project.folders = project.folders.filter(f => f.id !== req.params.folderId);
    project.files = project.files.filter(f => f.folderId !== req.params.folderId);
    await project.save();

    res.json({
        ...project.toObject(),
        id: project._id.toString()
    });
});

// @desc    Upload file(s) to Cloudinary and add to project
// @route   POST /api/projects/:id/files/upload
// @access  Private
const uploadFile = asyncHandler(async (req, res) => {
    if (!isConfigured()) {
        res.status(503);
        throw new Error('File upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
    }
    const project = await Project.findById(req.params.id);
    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }
    const userIdStr = req.user._id.toString();
    const teamIds = (project.team || []).map(m => (m._id || m).toString());
    if (req.user.role !== 'admin' && !teamIds.includes(userIdStr)) {
        res.status(401);
        throw new Error('Not authorized');
    }
    if (!req.file || !req.file.buffer) {
        res.status(400);
        throw new Error('No file provided');
    }
    const folderId = req.body.folderId || undefined;

    const uploadPromise = new Promise((resolve, reject) => {
        const opts = { resource_type: 'auto' };
        const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
        stream.end(req.file.buffer);
    });

    const result = await uploadPromise;
    const typeMap = { image: 'image', video: 'video', raw: 'other' };
    let type = typeMap[result.resource_type] || 'other';
    if (req.file.mimetype && req.file.mimetype.startsWith('audio/')) type = 'audio';
    if (req.file.mimetype === 'application/pdf') type = 'pdf';
    if (req.file.mimetype && (req.file.mimetype.includes('document') || req.file.mimetype.includes('word') || req.file.mimetype.includes('sheet'))) type = 'doc';

    const newFile = {
        id: Date.now().toString(),
        name: req.file.originalname || result.public_id || 'file',
        type,
        url: result.secure_url,
        size: result.bytes ? (result.bytes / (1024 * 1024)).toFixed(2) + ' MB' : '0 MB',
        uploadedBy: req.user.name || 'User',
        uploadedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        folderId
    };
    project.files.push(newFile);
    await project.save();

    res.json({
        ...project.toObject(),
        id: project._id.toString()
    });
});

// @desc    Add a file to a project (metadata only; use /files/upload for actual upload)
// @route   POST /api/projects/:id/files
// @access  Private
const addFile = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && !project.team.some(memberId => memberId.equals(req.user._id))) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const { name, type, url, size, moduleId, folderId } = req.body;
    if (!name || !type || !url) {
        res.status(400);
        throw new Error('File name, type, and URL are required');
    }

    const newFile = {
        id: Date.now().toString(),
        name: name.trim(),
        type,
        url,
        size: size || '0 MB',
        uploadedBy: req.user.name,
        uploadedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        moduleId: moduleId || undefined,
        folderId: folderId || undefined
    };

    project.files.push(newFile);
    await project.save();

    res.json({
        ...project.toObject(),
        id: project._id.toString()
    });
});

// @desc    Delete a file from a project
// @route   DELETE /api/projects/:id/files/:fileId
// @access  Private
const deleteFile = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && !project.team.some(memberId => memberId.equals(req.user._id))) {
        res.status(401);
        throw new Error('Not authorized');
    }

    project.files = project.files.filter(f => f.id !== req.params.fileId);
    await project.save();

    res.json({
        ...project.toObject(),
        id: project._id.toString()
    });
});

module.exports = {
    getProjects,
    getAllProjects,
    createProject,
    getProjectById,
    updateProject,
    deleteProject,
    addModule,
    deleteModule,
    addFolder,
    renameFolder,
    deleteFolder,
    uploadFile,
    addFile,
    deleteFile
};
