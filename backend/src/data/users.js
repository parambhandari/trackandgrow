const bcrypt = require('bcryptjs');

const users = [
    {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
        status: 'online'
    },
    {
        name: 'John Doe',
        email: 'employee@example.com',
        password: 'password123',
        role: 'employee',
        status: 'online'
    },
    {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        role: 'employee',
        status: 'busy'
    },
];

module.exports = users;
