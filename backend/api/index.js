require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('../src/config/db');
const authRoutes = require('../src/routes/authRoutes');
const projectRoutes = require('../src/routes/projectRoutes');
const taskRoutes = require('../src/routes/taskRoutes');
const dashboardRoutes = require('../src/routes/dashboardRoutes');
const activityRoutes = require('../src/routes/activityRoutes');

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

// Middleware to ensure DB connection
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('DB Connection Failed in Middleware:', err);
        res.status(503).json({ message: 'Database connection failed', error: err.message });
    }
});

app.get('/', (req, res) => {
    res.send('API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity', activityRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
    });
});

module.exports = app;
