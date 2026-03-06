const express = require('express');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

// Get secret from .env
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-for-dev-only';

router.get('/login', (req, res) => {
    res.render('login', { mode: 'login', error: null });
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const db = admin.firestore();

        // 1. Check if user already exists in Firestore
        const userDoc = await db.collection('users').doc(email).get();
        if (userDoc.exists) {
            return res.render('login', { mode: 'signup', error: "User already exists" });
        }

        // 2. Hash the password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 3. Save user to Firestore
        const newUser = {
            name,
            email,
            passwordHash,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(email).set(newUser);

        // 4. Issue JWT
        const token = jwt.sign(
            { email: newUser.email, name: newUser.name },
            JWT_SECRET,
            { expiresIn: '5d' }
        );

        // 5. Set cookie and redirect
        res.cookie('token', token, { maxAge: 1000 * 60 * 60 * 24 * 5, httpOnly: true });
        res.redirect('/');

    } catch (error) {
        console.error("Registration Error:", error);
        res.render('login', { mode: 'signup', error: "Server error during registration" });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const db = admin.firestore();

        // 1. Find user in Firestore
        const userDoc = await db.collection('users').doc(email).get();
        if (!userDoc.exists) {
            return res.render('login', { error: "Invalid credentials" });
        }

        const userData = userDoc.data();

        // 2. Compare passwords
        const isMatch = await bcrypt.compare(password, userData.passwordHash);
        if (!isMatch) {
            return res.render('login', { error: "Invalid credentials" });
        }

        // 3. Issue JWT
        const token = jwt.sign(
            { email: userData.email, name: userData.name },
            JWT_SECRET,
            { expiresIn: '5d' }
        );

        // 4. Set cookie and redirect
        res.cookie('token', token, { maxAge: 1000 * 60 * 60 * 24 * 5, httpOnly: true });
        res.redirect('/');
    }
    catch (error) {
        console.error("Login Server Error:", error);
        res.render('login', { error: "Server error during login" });
    }
});

router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/auth/login');
});

router.get('/signup', (req, res) => {
    res.render('login', { mode: 'signup', error: null });
});

module.exports = router;
