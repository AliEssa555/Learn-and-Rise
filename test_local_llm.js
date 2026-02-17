const llamaCliService = require('./src/services/llamaCliService');

async function test() {
    console.log("Starting LlamaCLI Test...");
    const start = Date.now();
    try {
        const response = await llamaCliService.generateResponse("What is the capital of France?");
        console.log("Response received:");
        console.log(response);
    } catch (error) {
        console.error("Test Failed:", error);
    }
    console.log(`Duration: ${(Date.now() - start) / 1000}s`);
}

test();
