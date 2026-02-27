const llamaCliService = require('./llamaCliService');
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
            return await llamaCliService.generateResponse(prompt);
        }
    };
}

class LLMService {
    constructor() {
        this.useLocal = process.env.USE_LOCAL_LLM === 'true';
        this.history = []; // Simple in-memory history for LCEL
    }

    async generateResponse(userPrompt, systemContext = "") {
        console.log(`[LLMService] Generating response (Local: ${this.useLocal})`);

        // If modern LangChain is ready
        if (this.useLocal && LlamaChatModel && ChatPromptTemplate) {
            return await this._generateWithLCEL(userPrompt, systemContext);
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
     * Modern LCEL (LangChain Expression Language) implementation.
     */
    async _generateWithLCEL(userPrompt, systemContext) {
        console.log("[LLMService] Executing via modern LCEL sequence...");

        const model = new LlamaChatModel({});

        // Build modern prompt with history
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", systemContext || "You are a helpful language learning assistant."],
            ...this.history,
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

            // Update history (Keep last 10 messages for context)
            this.history.push(["human", userPrompt]);
            this.history.push(["ai", response]);
            if (this.history.length > 10) this.history = this.history.slice(-10);

            return response;
        } catch (err) {
            console.error("[LLMService] LCEL Execution Error:", err.message);
            return await llamaCliService.generateResponse(userPrompt); // Final fallback
        }
    }

    clearHistory() {
        this.history = [];
    }
}

module.exports = new LLMService();
