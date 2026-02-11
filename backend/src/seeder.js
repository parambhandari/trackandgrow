const mongoose = require('mongoose');
const dotenv = require('dotenv');
const users = require('./data/users');
const User = require('./models/User');
const Project = require('./models/Project');
const Task = require('./models/Task');
const connectDB = require('./config/db');

const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

connectDB();

const importData = async () => {
    try {
        await Task.deleteMany();
        await Project.deleteMany();
        await User.deleteMany();

        // Create users one by one to trigger password hashing middleware
        const createdUsers = [];
        for (const userData of users) {
            const user = await User.create(userData);
            createdUsers.push(user);
        }

        const adminUser = createdUsers[0]._id;

        console.log('Data Imported!');
        console.log('Admin user created:', createdUsers[0].email);
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await Task.deleteMany();
        await Project.deleteMany();
        await User.deleteMany();

        console.log('Data Destroyed!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

if (process.argv[2] === '-d') {
    destroyData();
} else {
    importData();
}
