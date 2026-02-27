const llamaCliService = require('./llamaCliService');
const chatHistoryService = require('./chatHistoryService');
const vectorService = require('./vectorService');
require('dotenv').config();

// Standard imports (will resolve once user runs npm install)
let SimpleChatModel, ChatPromptTemplate, StringOutputParser, HumanMessage, AIMessage, SystemMessage;

try {
    const coreChatModels = require("@langchain/core/language_models/chat_models");
    const corePrompts = require("@langchain/core/prompts");
    const coreOutputParsers = require("@langchain/core/output_parsers");
    const coreMessages = require("@langchain/core/messages");

    SimpleChatModel = coreChatModels.SimpleChatModel;
    ChatPromptTemplate = corePrompts.ChatPromptTemplate;
    StringOutputParser = coreOutputParsers.StringOutputParser;
    HumanMessage = coreMessages.HumanMessage;
    AIMessage = coreMessages.AIMessage;
    SystemMessage = coreMessages.SystemMessage;
} catch (e) {
    console.warn("[LLMService] Modern LangChain (@langchain/core) not yet available. Details:", e.message);
}

/**
 * Custom ChatModel wrapper for our llama-cli process.
 */
let LlamaChatModel;
if (SimpleChatModel) {
    LlamaChatModel = class extends SimpleChatModel {
        constructor(fields) {
            super(fields || {});
        }

        _llmType() {
            return "llama-cli";
        }

        async _call(prompt, options) {
            console.log(`[LlamaChatModel] Executing call to llama-cli...`);

            // Handle different LangChain input types (string, message object, message array)
            let promptText = "";
            if (typeof prompt === 'string') {
                promptText = prompt;
            } else if (Array.isArray(prompt)) {
                promptText = prompt.map(m => m.content || m.toString()).join('\n');
            } else if (prompt && prompt.content) {
                promptText = prompt.content;
            } else {
                promptText = prompt.toString();
            }

            // Final fallback to JSON if it still looks like an internal object
            if (promptText.includes('[object')) {
                promptText = JSON.stringify(prompt);
            }

            return await llamaCliService.generateResponse(promptText);
        }
    };
}

class LLMService {
    constructor() {
        this.useLocal = process.env.USE_LOCAL_LLM === 'true';
    }

    /**
     * @param {string} userPrompt 
     * @param {string} systemContext 
     * @param {string} videoId - Used for persistent history and RAG
     */
    async generateResponse(userPrompt, systemContext = "", videoId = null) {
        console.log(`[LLMService] Generating response (Local: ${this.useLocal})`);

        // If modern LangChain is ready
        if (this.useLocal && LlamaChatModel && ChatPromptTemplate) {
            return await this._generateWithLCEL(userPrompt, systemContext, videoId);
        }

        // Fallback 1: Direct Local LLM
        if (this.useLocal) {
            console.log("[LLMService] Fallback: Direct Local LLM (no LangChain)");
            return await llamaCliService.generateResponse(userPrompt);
        }

        // Fallback 2: Groq
        try {
            const groqService = require('./groqService');
            return await groqService.generateResponse(userPrompt);
        } catch (err) {
            console.error("[LLMService] All generation methods failed:", err.message);
            return "Error: Could not generate response.";
        }
    }

    /**
     * Modern LCEL implementation with persistent history and RAG.
     */
    async _generateWithLCEL(userPrompt, systemContext, videoId) {
        console.log("[LLMService] Executing via modern LCEL sequence...");

        const model = new LlamaChatModel({});

        // Load history from Firestore if videoId provided
        let historyMessages = [];
        if (videoId) {
            const savedHistory = await chatHistoryService.getHistory(videoId);
            // Format for ChatPromptTemplate: ["human", "message"]
            historyMessages = savedHistory.map(([role, content]) => [role, content]);
            console.log(`[LLMService] Loaded ${historyMessages.length} messages from persistent history.`);
        }

        // RAG SEARCH: Find relevant segments from the transcript
        let ragContext = "";
        if (videoId) {
            ragContext = await vectorService.search(videoId, userPrompt);
            if (ragContext) {
                console.log(`[LLMService] RAG Context found (${ragContext.length} chars).`);
            }
        }

        // Combine base system context with RAG context
        const finalSystemPrompt = `${systemContext || "You are a helpful language learning assistant."}
        
Context from the video transcript:
---
${ragContext || "No specific context found."}
---
Use the provided context to answer the user's question accurately. If the information isn't in the context, use your general knowledge but mention it's not specific to the video.`;

        // Build modern prompt with history
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", finalSystemPrompt],
            ...historyMessages,
            ["human", "{input}"],
        ]);

        try {
            const promptValue = await prompt.invoke({ input: userPrompt });

            // Format messages into a single string for our legacy SimpleChatModel
            const messages = promptValue.toChatMessages();
            const formattedPrompt = messages.map(m => {
                const type = m._getType();
                const role = type === 'human' ? 'User' : (type === 'system' ? 'System' : 'Assistant');
                return `${role}: ${m.content}`;
            }).join('\n');

            const response = await model.invoke(formattedPrompt);
            const responseContent = typeof response === 'string' ? response : response.content;

            // Save to Persistent History
            if (videoId) {
                await chatHistoryService.addMessage(videoId, 'human', userPrompt);
                await chatHistoryService.addMessage(videoId, 'ai', responseContent);
            }

            return responseContent;
        } catch (err) {
            console.error("[LLMService] LCEL Execution Error:", err.message);
            const fallback = await llamaCliService.generateResponse(userPrompt);
            return typeof fallback === 'string' ? fallback : (fallback.content || fallback.toString());
        }
    }
}

module.exports = new LLMService();
