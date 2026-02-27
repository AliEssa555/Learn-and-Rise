const express = require('express');
const admin = require('firebase-admin');
const fetch = require('node-fetch'); // Required to call the Firebase REST API for password verification
require('dotenv').config();

const router = express.Router();

// The Web API Key from Firebase Console (Project Settings -> General)
// Needed for the REST API to verify passwords since Admin SDK doesn't do sign-in.
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;

router.get('/login', (req, res) => {
    res.render('login', { mode: 'login', error: null });
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        try {
            await admin.auth().getUserByEmail(email);
            return res.render('login', { mode: 'signup', error: "User already exists in Firebase" });
        } catch (error) {
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }
        }

        // Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
        });

        // Generate custom token or directly log them in via REST
        if (!FIREBASE_WEB_API_KEY) {
            console.log("No FIREBASE_WEB_API_KEY found, user created but skipping auto-login");
            return res.redirect('/auth/login');
        }

        // Auto-login new user to give them a session cookie
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({ email, password, returnSecureToken: true }),
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message);
        }

        // Create session cookie (expires in 5 days)
        const expiresIn = 1000 * 60 * 60 * 24 * 5;
        const sessionCookie = await admin.auth().createSessionCookie(data.idToken, { expiresIn });

        res.cookie('token', sessionCookie, { maxAge: expiresIn, httpOnly: true });
        res.redirect('/');

    } catch (error) {
        console.error("Registration Error:", error);
        res.render('login', { mode: 'signup', error: error.message || "Server error during registration" });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!FIREBASE_WEB_API_KEY) {
            console.error("Missing FIREBASE_WEB_API_KEY in .env");
            return res.render('login', { error: "Server Configuration Error: Missing Firebase Web API Key" });
        }

        // Verify password via Firebase REST API
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({ email, password, returnSecureToken: true }),
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.error) {
            console.error("Login Error from Firebase:", data.error.message);
            return res.render('login', { error: "Invalid credentials" });
        }

        const idToken = data.idToken;

        // Create session cookie (expires in 5 days)
        const expiresIn = 1000 * 60 * 60 * 24 * 5;
        const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });

        res.cookie('token', sessionCookie, { maxAge: expiresIn, httpOnly: true });
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
