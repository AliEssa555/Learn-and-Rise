const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
    // Check for auth cookie (simple mock)
    const authToken = req.cookies['auth_token'];

    // Allow public paths
    const publicPaths = ['/auth/login', '/auth/signup', '/css', '/js', '/images'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // Redirect if no token
    if (!authToken) {
        return res.redirect('/auth/login');
    }

    next();
};

module.exports = authMiddleware;
