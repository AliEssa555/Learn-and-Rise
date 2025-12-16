const express = require('express');
const router = express.Router();
const googleTTS = require('google-tts-api');
const llmService = require('../services/llmService');

router.get('/', (req, res) => {
    res.render('podcast');
});

router.post('/generate_script', async (req, res) => {
    try {
        const { topic } = req.body;
        const prompt = `Write a short, engaging podcast script about ${topic}. Keep it under 200 words.`;
        const script = await llmService.generateResponse(prompt);
        res.json({ script });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/generate_audio', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        // google-tts-api returns a URL to the audio file
        const url = googleTTS.getAudioUrl(text, {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com',
        });

        // Return URL directly to frontend audio player
        res.json({ audio_url: url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
