const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/roleMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// Project CRUD
router.route('/').get(protect, getProjects).post(protect, admin, createProject);
router.route('/all').get(protect, getAllProjects); // Get all projects for dropdown
router.route('/:id').get(protect, getProjectById).put(protect, admin, updateProject).delete(protect, admin, deleteProject);

// Module management - Employees can add modules to their assigned projects
router.route('/:id/modules').post(protect, addModule);
router.route('/:id/modules/:moduleId').delete(protect, admin, deleteModule);

// Folder management - Employees can add folders to their assigned projects
router.route('/:id/folders').post(protect, addFolder);
router.route('/:id/folders/:folderId').patch(protect, admin, renameFolder).delete(protect, admin, deleteFolder);

// File management - upload to Cloudinary (must be before /:id/files)
router.post('/:id/files/upload', protect, upload.single('file'), uploadFile);
router.route('/:id/files').post(protect, addFile);
router.route('/:id/files/:fileId').delete(protect, deleteFile);

module.exports = router;
