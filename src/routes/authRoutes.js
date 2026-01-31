const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { message } = require('statuses');
require('dotenv').config();

const router = express.Router();

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body

        let user = await User.findOne({ email })
        if (user) {
            return res.status(400).json({ message: "User already exists" })
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ name, email, password: hashedPassword })
        await user.save()
        res.status(201).json({ message: "User registered successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Server error" })
    }

})

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        let user = await User.findOne({ email })

        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" })
        }

        //Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400)
        }

        //Generate JWT token
        const token = jwt.token({ id: user_id }, process.env.JWT_SECRET, { expiresIn: "1h" })

        res.status(200).json({ token })
    }
    catch (error) {
        res.status(500).json({ message: "Server error" })
    }
});

/*
router.get('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.redirect('/auth/login');
});

router.get('/signup', (req, res) => {
    res.render('login', { mode: 'signup' }); // Reuse login template or create signup
});
*/

module.exports = router;
