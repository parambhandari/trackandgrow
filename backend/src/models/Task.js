const mongoose = require('mongoose');

const taskSchema = mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['To Do', 'In Progress', 'Completed', 'Review'],
        default: 'To Do'
    },
    deadline: { type: Date },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Assigned Employee
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Creator (Admin)
    tags: [String],
    progress: { type: Number, default: 0, min: 0, max: 100 },
    subtasks: [{
        id: { type: String },
        title: { type: String, required: true },
        completed: { type: Boolean, default: false }
    }],
    recurring: {
        type: String,
        enum: ['Daily', 'Weekly'],
        required: false,
        default: undefined
    },
    /** For Weekly: 0=Sun, 1=Mon, ..., 6=Sat (Date.getDay()) */
    recurringDays: [Number],
    /** Set on auto-created instances; points to the recurring template task */
    parentRecurringId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    moduleId: { type: String },
    startedAt: { type: Number },
    completedAt: { type: Number },
    history: [{
        status: { type: String, required: true },
        timestamp: { type: Number, default: Date.now }
    }]
}, {
    timestamps: true,
});

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
