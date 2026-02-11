const path = require('path');
const dotenv = require('dotenv');
// Load .env before any other local requires that use process.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('../src/config/db');
const authRoutes = require('../src/routes/authRoutes');
const projectRoutes = require('../src/routes/projectRoutes');
const taskRoutes = require('../src/routes/taskRoutes');
const dashboardRoutes = require('../src/routes/dashboardRoutes');
const activityRoutes = require('../src/routes/activityRoutes');

connectDB();

// Note: Recurring tasks scheduler is disabled for Vercel serverless deployment
// as cron jobs do not persist in ephemeral serverless functions.
// To use cron jobs on Vercel, consider using Vercel Cron Jobs.
// const { startRecurringTaskScheduler } = require('../src/scheduler/recurringTasks');
// startRecurringTaskScheduler();

const app = express();

// CORS: allow localhost (dev) + production frontend URL from env
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean) : []),
];
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. Postman, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity', activityRoutes);


module.exports = app;
