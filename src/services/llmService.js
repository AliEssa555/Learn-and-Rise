const ollama = require('ollama').default;

class LLMService {
    constructor() {
        this.model = 'gemma3:4b';
    }

    async generateResponse(prompt) {
        try {
            const response = await ollama.chat({
                model: this.model,
                messages: [{ role: 'user', content: `You are an English tutor. ${prompt}` }],
            });
            return response.message.content;
        } catch (error) {
            console.error('LLM Error:', error);
            throw new Error('Failed to generate response from Ollama');
        }
    }
}

module.exports = new LLMService();
