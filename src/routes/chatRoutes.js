const express = require('express');
const router = express.Router();
const llmService = require('../services/llmService');
const transcriptService = require('../services/transcriptService');

// Store simple context in memory for this session
// In production, use Redis or DB
let sessionContext = "";

router.post('/process_transcript', async (req, res) => {
    try {
        const { youtube_url } = req.body;
        if (!youtube_url) return res.status(400).json({ error: 'YouTube URL required' });

        // Get Transcript
        const { fullText, items } = await transcriptService.getTranscript(youtube_url);

        sessionContext = fullText;

        // Generate QA Pairs (Simple 1-shot generation)
        const chunk = fullText.slice(0, 4000); // Limit context
        const prompt = `Based on this video transcript, generate 3 thought-provoking Q&A pairs. Format: 'Q: ... A: ...'. Context: ${chunk}`;

        const qaResponse = await llmService.generateResponse(prompt);

        // Naive parsing
        const qaPairs = [];
        const lines = qaResponse.split('\n');
        let currentQ = "";

        for (const line of lines) {
            if (line.includes("Q:")) currentQ = line;
            else if (line.includes("A:") && currentQ) {
                qaPairs.push([currentQ, line]);
                currentQ = "";
            }
        }

        if (qaPairs.length === 0) qaPairs.push(["What is this video about?", "Ask me to find out!"]);

        res.json({
            message: 'Transcript processed',
            qa_pairs: qaPairs
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/process_input', async (req, res) => {
    try {
        const { message, input_type } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Inject context
        let context = "";
        if (sessionContext) {
            context = `Context: ${sessionContext.slice(0, 2000)}...\n`;
        }

        const prompt = `${context} User Question: ${message}`;
        const response = await llmService.generateResponse(prompt);

        res.json({
            user_input: message,
            bot_response: response,
            input_type: input_type || 'text'
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
