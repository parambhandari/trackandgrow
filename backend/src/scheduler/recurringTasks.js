const cron = require('node-cron');
const Task = require('../models/Task');

/**
 * Every minute, create task instances for Daily/Weekly recurring templates
 * so that a new task appears in To Do on the right day at the same time.
 */
function startRecurringTaskScheduler() {
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

            const templates = await Task.find({
                recurring: { $in: ['Daily', 'Weekly'] },
                $or: [
                    { parentRecurringId: null },
                    { parentRecurringId: { $exists: false } }
                ],
                deadline: { $exists: true, $ne: null }
            });

            for (const template of templates) {
                const deadline = new Date(template.deadline);
                const templateHour = deadline.getHours();
                const templateMinute = deadline.getMinutes();
                if (now.getHours() !== templateHour || now.getMinutes() !== templateMinute) continue;

                const todayDay = now.getDay();
                if (template.recurring === 'Weekly') {
                    const days = template.recurringDays || [];
                    if (!days.includes(todayDay)) continue;
                }

                const existingInstance = await Task.findOne({
                    parentRecurringId: template._id,
                    deadline: { $gte: todayStart, $lte: todayEnd }
                });
                if (existingInstance) continue;

                const instanceDeadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), templateHour, templateMinute, 0, 0);
                const instance = new Task({
                    title: template.title,
                    description: template.description,
                    priority: template.priority,
                    status: 'To Do',
                    deadline: instanceDeadline,
                    project: template.project,
                    assignee: template.assignee,
                    reporter: template.reporter,
                    tags: template.tags || [],
                    subtasks: template.subtasks || [],
                    moduleId: template.moduleId,
                    parentRecurringId: template._id,
                    history: [{ status: 'To Do', timestamp: Date.now() }]
                });
                await instance.save();
            }
        } catch (err) {
            console.error('Recurring task scheduler error:', err.message);
        }
    });
    console.log('Recurring task scheduler started (runs every minute)');
}

module.exports = { startRecurringTaskScheduler };
