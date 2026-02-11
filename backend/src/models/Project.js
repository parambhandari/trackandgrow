const mongoose = require('mongoose');

const projectSchema = mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    iconColor: { type: String, default: 'bg-blue-100 text-blue-600' },
    initial: { type: String },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin/Manager who created it
    team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Assigned employees
    modules: [{
        id: { type: String, required: true },
        name: { type: String, required: true }
    }],
    folders: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        moduleId: { type: String }
    }],
    files: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ['image', 'video', 'audio', 'pdf', 'doc', 'other'], required: true },
        url: { type: String, required: true },
        size: { type: String },
        uploadedBy: { type: String },
        uploadedAt: { type: String },
        moduleId: { type: String },
        folderId: { type: String }
    }]
}, {
    timestamps: true,
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
