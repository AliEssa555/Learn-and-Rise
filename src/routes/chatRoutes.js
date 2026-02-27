const express = require('express');
const router = express.Router();
const llmService = require('../services/llmService');
const transcriptService = require('../services/transcriptService');

// Store simple context in memory for this session
// In production, use Redis or DB
let sessionContext = "";

router.get('/chat_interface', (req, res) => {
    res.render('chat', {
        user: req.user
    });
});

router.post('/process_transcript', async (req, res) => {
    try {
        const { youtube_url } = req.body;
        const traceId = req.headers['x-trace-id'] || 'no-trace';
        console.log(`[ChatRoute] [${traceId}] Received URL: ${youtube_url}`);

        if (!youtube_url) return res.status(400).json({ error: 'YouTube URL required' });

        // Get Transcript
        console.log(`[ChatRoute] Fetching transcript...`);
        const { fullText, items } = await transcriptService.getTranscript(youtube_url);

        if (!fullText || fullText.trim().length === 0) {
            console.warn(`[ChatRoute] Transcript is empty for URL: ${youtube_url}`);
            return res.status(400).json({ error: 'Video has no transcript or captions are disabled.' });
        }

        console.log(`[ChatRoute] Transcript fetched (${fullText.length} chars)`);

        sessionContext = fullText;

        // Generate QA Pairs (Simple 1-shot generation)
        const chunk = fullText.slice(0, 6000); // Increased slightly for more context
        const prompt = `Based on this video transcript, generate 3 thought-provoking Q&A pairs. Format: 'Q: ... A: ...'. Context: ${chunk}`;

        console.log(`[ChatRoute] Requesting QA generation from LLM...`);

        // Increase request timeout for this long operation
        req.setTimeout(600000); // 10 minutes (for heavy local LLM ingestion)

        const qaResponse = await llmService.generateResponse(prompt);
        console.log(`[ChatRoute] LLM responded with ${qaResponse.length} chars`);

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

        if (qaPairs.length === 0) {
            console.warn(`[ChatRoute] No Q&A pairs parsed from LLM response`);
            qaPairs.push(["What is this video about?", "Ask me to find out!"]);
        }

        console.log(`[ChatRoute] Sending ${qaPairs.length} Q&A pairs to client (Final step)`);
        res.json({
            message: 'Transcript processed',
            qa_pairs: qaPairs
        });
    } catch (error) {
        console.error(`[ChatRoute] Error processing transcript:`, error);
        res.status(500).json({
            error: error.message || 'Internal Server Error during transcript processing',
            details: error.stack // Added for debugging, remove in production
        });
    }
});

router.post('/process_input', async (req, res) => {
    try {
        const { message, input_type } = req.body;
        console.log(`[ChatRoute] Received input (${input_type || 'text'}): "${message}"`);

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Use refined signature: generateResponse(userInput, systemContext)
        const systemContext = sessionContext
            ? `You are a helpful language learning assistant. Use this video transcript as context: ${sessionContext.slice(0, 2000)}`
            : "You are a helpful assistant.";

        console.log(`[ChatRoute] Requesting generation from LLM...`);
        const response = await llmService.generateResponse(message, systemContext);
        console.log(`[ChatRoute] LLM responded (${response.length} chars)`);

        res.json({
            user_input: message,
            bot_response: response,
            input_type: input_type || 'text'
        });

    } catch (error) {
        console.error(`[ChatRoute] Error processing input:`, error);
        res.status(500).json({
            error: error.message || 'Internal Server Error during input processing',
            details: error.stack
        });
    }
});

module.exports = router;
