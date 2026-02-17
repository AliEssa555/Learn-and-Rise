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
            return res.render('login', { mode: 'signup', error: "User already exists" });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ name, email, password: hashedPassword })
        await user.save()

        // Generate Token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

        // Set cookie and redirect
        res.cookie('token', token, { httpOnly: true });
        res.redirect('/');
    }
    catch (error) {
        console.error(error);
        res.render('login', { mode: 'signup', error: "Server error during registration" });
    }

})

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        let user = await User.findOne({ email })

        if (!user) {
            return res.render('login', { error: "Invalid credentials" });
        }

        //Verify password
        console.log('Password provided:', password);
        console.log('Stored hash:', user.password);
        if (!password || !user.password) {
            console.error('Missing password or hash');
            return res.render('login', { error: "Invalid credentials" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { error: "Invalid credentials" });
        }

        //Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" })

        // Set cookie and redirect
        res.cookie('token', token, { httpOnly: true });
        res.redirect('/');
    }
    catch (error) {
        console.error(error);
        res.render('login', { error: "Server error during login" });
    }
});

router.get('/logout', (req, res) => {
    res.clearCookie('token'); // changed from 'auth_token' to matches potentially what client uses, or just standard clearing
    res.redirect('/auth/login');
});

router.get('/signup', (req, res) => {
    res.render('login', { mode: 'signup' });
});


module.exports = router;
