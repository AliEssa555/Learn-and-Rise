const express = require('express');
const router = express.Router();
const transcriptService = require('../services/transcriptService');
const llmService = require('../services/llmService');

router.get('/', (req, res) => {
    res.render('player');
});

router.post('/process_video', async (req, res) => {
    try {
        const { youtube_url } = req.body;
        // Fetch transcript with timestamps
        const { items } = await transcriptService.getTranscript(youtube_url);
        res.json({ transcript: items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/explain', async (req, res) => {
    try {
        const { word, context } = req.body;
        const prompt = `Explain the word "${word}" in the context of this sentence: "${context}". Provide a simple definition and an example.`;
        const explanation = await llmService.generateResponse(prompt);
        res.json({ explanation });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
