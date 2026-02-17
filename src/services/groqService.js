const { Groq } = require('groq-sdk');
require('dotenv').config();

class GroqService {
    constructor() {
        if (!process.env.GROQ_API_KEY) {
            console.warn("GROQ_API_KEY is missing in .env");
        }
        this.client = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
        this.model = 'llama3-70b-8192'; // Using a performant model similar to Qwen
    }

    async generateResponse(prompt) {
        try {
            const chatCompletion = await this.client.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: this.model,
            });
            return chatCompletion.choices[0]?.message?.content || "";
        } catch (error) {
            console.error('Groq API Error:', error);
            throw new Error(`Groq API failed: ${error.message}`);
        }
    }
}

module.exports = new GroqService();
