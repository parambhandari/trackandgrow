const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role, // Send role to frontend
            token: generateToken(user._id),
            avatar: user.avatar,
        });
    } else {
        res.status(401);
        res.json({ message: 'Invalid email or password' });
    }
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (or Admin only depending on workflow)
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        res.json({ message: 'User already exists' });
        return;
    }

    const user = await User.create({
        name,
        email,
        password,
        role: role || 'employee', // Default to employee if not specified
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        res.status(400);
        res.json({ message: 'Invalid user data' });
    }
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
    });
});

// @desc    Get all users (employees)
// @route   GET /api/auth/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-password');
    res.json(users);
});

// @desc    Get all employees with their task counts
// @route   GET /api/auth/employees-with-tasks
// @access  Private/Admin
const getEmployeesWithTasks = asyncHandler(async (req, res) => {
    const Task = require('../models/Task');
    
    const employees = await User.find({ role: 'employee' }).select('-password');
    
    const employeesWithTasks = await Promise.all(
        employees.map(async (employee) => {
            const taskCount = await Task.countDocuments({ assignee: employee._id });
            const completedCount = await Task.countDocuments({ 
                assignee: employee._id, 
                status: 'Completed' 
            });
            const inProgressCount = await Task.countDocuments({ 
                assignee: employee._id, 
                status: 'In Progress' 
            });
            const pendingCount = await Task.countDocuments({ 
                assignee: employee._id, 
                status: { $in: ['To Do', 'Review'] } 
            });
            
            return {
                _id: employee._id,
                name: employee.name,
                email: employee.email,
                avatar: employee.avatar,
                taskCount,
                completedCount,
                inProgressCount,
                pendingCount
            };
        })
    );
    
    res.json(employeesWithTasks);
});

module.exports = { authUser, registerUser, getUserProfile, getUsers, getEmployeesWithTasks };
