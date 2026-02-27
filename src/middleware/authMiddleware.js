const admin = require('firebase-admin');

const authMiddleware = async (req, res, next) => {
    // Check for auth cookie
    const token = req.cookies.token;

    // Allow public paths (auth routes or static files)
    const publicPaths = ['/auth', '/css', '/js', '/images'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // Redirect if no token
    if (!token) {
        return res.redirect('/auth/login');
    }

    try {
        const decodedClaims = await admin.auth().verifySessionCookie(token, true /** checkRevoked */);
        req.user = decodedClaims;
        next();
    } catch (err) {
        console.error("Session cookie verification failed:", err.message);
        res.clearCookie('token');
        return res.redirect('/auth/login');
    }
};

module.exports = authMiddleware;
