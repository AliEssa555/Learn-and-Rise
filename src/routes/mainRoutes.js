const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('main');
});

// Alias for old charts/redirects if needed
router.get('/dashboard', (req, res) => {
    res.redirect('/');
});

module.exports = router;
