const jwt = require('jsonwebtoken');
const User = require('../models/User');

let jwtSecretWarned = false;

const protect = async (req, res, next) => {
    let token;

    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'your_jwt_secret_key_here') {
        if (!jwtSecretWarned) {
            jwtSecretWarned = true;
            console.warn('⚠️  WARNING: JWT_SECRET is missing or default. Set a strong JWT_SECRET in .env for production.');
        }
    }

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            
            const secretToUse = secret || 'temporary_dev_secret_change_in_production';
            const decoded = jwt.verify(token, secretToUse);

            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user) {
                res.status(401);
                return res.json({ message: 'User not found' });
            }

            next();
        } catch (error) {
            if (error.name === 'JsonWebTokenError' && error.message === 'invalid signature') {
                res.status(401);
                return res.json({ message: 'Session invalid. Please log in again.' });
            }
            if (error.name === 'TokenExpiredError') {
                res.status(401);
                return res.json({ message: 'Session expired. Please log in again.' });
            }
            console.error(error);
            res.status(401);
            return res.json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401);
        return res.json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };
