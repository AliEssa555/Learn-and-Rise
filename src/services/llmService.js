const grooveService = require('./groqService');
const llamaCliService = require('./llamaCliService');
require('dotenv').config();

class LLMService {
    constructor() {
        this.useLocal = process.env.USE_LOCAL_LLM === 'true';
    }

    async generateResponse(prompt) {
        if (this.useLocal) {
            console.log('Using Local LLM (LlamaCLI)...');
            return await llamaCliService.generateResponse(prompt);
        } else {
            console.log('Using Online LLM (Groq)...');
            return await grooveService.generateResponse(prompt);
        }
    }
}

module.exports = new LLMService();
