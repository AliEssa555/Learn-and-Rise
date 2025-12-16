const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', (req, res) => {
    // Mock login - accept any non-empty input
    const { email, password } = req.body;
    if (email && password) {
        // Set simple auth cookie
        res.cookie('auth_token', 'logged_in_user', { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        res.redirect('/');
    } else {
        res.render('login', { error: 'Invalid credentials' });
    }
});

router.get('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.redirect('/auth/login');
});

router.get('/signup', (req, res) => {
    res.render('login', { mode: 'signup' }); // Reuse login template or create signup
});

module.exports = router;
