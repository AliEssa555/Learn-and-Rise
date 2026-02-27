const express = require('express');
const router = express.Router();
const llmService = require('../services/llmService');
const transcriptService = require('../services/transcriptService');
const vectorService = require('../services/vectorService');

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
        const { fullText, cached, qa_pairs: cachedPairs } = await transcriptService.getTranscript(youtube_url);

        if (!fullText || fullText.trim().length === 0) {
            console.warn(`[ChatRoute] Transcript is empty for URL: ${youtube_url}`);
            return res.status(400).json({ error: 'Video has no transcript or captions are disabled.' });
        }

        sessionContext = fullText;
        const videoId = transcriptService.extractVideoId(youtube_url);

        // TRIGGER RAG INDEXING (Async)
        // We don't await this to keep the UI fast, but we log the start
        vectorService.upsertTranscript(videoId, fullText).catch(err => {
            console.error(`[ChatRoute] Background RAG indexing failed:`, err.message);
        });

        // If we have cached Q&A pairs, return them immediately
        if (cached && cachedPairs && cachedPairs.length > 0) {
            console.log(`[ChatRoute] Using ${cachedPairs.length} cached Q&A pairs`);
            return res.json({
                message: 'Transcript loaded (from cache)',
                // Ensure format is consistent for UI: [[Q, A], ...]
                qa_pairs: cachedPairs.map(p => Array.isArray(p) ? p : [p.question, p.answer])
            });
        }

        console.log(`[ChatRoute] Transcript fetched (${fullText.length} chars)`);

        // Generate QA Pairs
        const chunk = fullText.slice(0, 6000);
        const prompt = `Based on this video transcript, generate 3 thought-provoking Q&A pairs. Format: 'Q: ... A: ...'. Context: ${chunk}`;

        console.log(`[ChatRoute] Requesting QA generation from LLM...`);
        req.setTimeout(600000);

        const qaResponse = await llmService.generateResponse(prompt);
        console.log(`[ChatRoute] LLM responded with ${qaResponse.length} chars`);

        // Robust parsing: convert to array of objects to avoid Firestore nested array error
        const qaPairs = [];
        const lines = qaResponse.split('\n');
        let currentQ = "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("Q:")) {
                currentQ = trimmed.replace(/^Q:\s*/i, '');
            } else if (trimmed.startsWith("A:") && currentQ) {
                const answer = trimmed.replace(/^A:\s*/i, '');
                qaPairs.push({ question: currentQ, answer: answer });
                currentQ = "";
            }
        }

        if (qaPairs.length === 0) {
            console.warn(`[ChatRoute] No Q&A pairs parsed from LLM response`);
            qaPairs.push({ question: "What is this video about?", answer: "Ask me to find out!" });
        }

        // Save newly generated pairs to cache
        try {
            const admin = require('firebase-admin');
            await admin.firestore().collection('transcripts').doc(videoId).update({
                qa_pairs: qaPairs
            });
            console.log(`[ChatRoute] Generated Q&A pairs saved to Firestore for ${videoId}`);
        } catch (saveError) {
            console.warn(`[ChatRoute] Failed to persist generated Q&A pairs: ${saveError.message}`);
        }

        console.log(`[ChatRoute] Sending ${qaPairs.length} Q&A pairs to client`);
        res.json({
            message: 'Transcript processed and questions generated',
            qa_pairs: qaPairs.map(p => [p.question, p.answer]) // Compatibility with UI (array of arrays for frontend)
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

        // Use refined signature: generateResponse(userInput, systemContext, videoId)
        const systemContext = sessionContext
            ? `You are a helpful language learning assistant. Use this video transcript as context: ${sessionContext.slice(0, 2000)}`
            : "You are a helpful assistant.";

        // Attempt to extract videoId for persistent history
        let videoId = null;
        if (req.body.youtube_url) {
            videoId = transcriptService.extractVideoId(req.body.youtube_url);
        } else if (req.headers.referer) {
            videoId = transcriptService.extractVideoId(req.headers.referer);
        }

        console.log(`[ChatRoute] Requesting generation from LLM (VideoID: ${videoId})...`);
        const response = await llmService.generateResponse(message, systemContext, videoId);
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
