const llamaCliService = require('./src/services/llamaCliService');

async function test() {
    console.log("Starting LlamaCLI Test...");
    const start = Date.now();
    try {
        const prompt = process.argv[2] || "Explain the importance of hydration.";
        console.log(`Testing LLM with prompt: "${prompt}"`);
        const response = await llamaCliService.generateResponse(prompt);
        console.log("Response received:");
        console.log(response);
    } catch (error) {
        console.error("Test Failed:", error);
    }
    console.log(`Duration: ${(Date.now() - start) / 1000}s`);
}

test();
