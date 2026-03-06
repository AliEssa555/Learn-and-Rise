const jwt = require('jsonwebtoken');
require('dotenv').config();

// Get secret from .env
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-for-dev-only';

const authMiddleware = async (req, res, next) => {
    // Check for auth cookie
    const token = req.cookies.token;

    // Allow public paths (auth routes or static files)
    const publicPaths = ['/auth', '/css', '/js', '/images', '/favicon.png'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // Redirect if no token
    if (!token) {
        return res.redirect('/auth/login');
    }

    try {
        // Verify custom JWT token
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("JWT verification failed:", err.message);
        res.clearCookie('token');
        return res.redirect('/auth/login');
    }
};

module.exports = authMiddleware;
