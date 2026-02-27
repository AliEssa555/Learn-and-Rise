const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

class LlamaCliService {
    constructor() {
        // Build path: project_root/llama.cpp/build/bin/Release/llama-cli.exe
        this.executablePath = path.join(process.cwd(), 'llama.cpp', 'build', 'bin', 'Release', 'llama-cli.exe');
        this.modelPath = path.join(process.cwd(), 'llama.cpp', 'qwen2.5-7b-q4_k_m.gguf');
        this.logDir = path.join(process.cwd(), 'logs');
        this.logPath = path.join(this.logDir, 'llama_cli.log');

        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        // Args from user request (modified for API usage):
        // -m qwen2.5-7b-q4_k_m.gguf -ngl 100 -c 8192 -t 8 -n -1
        // Removed -cnv because it keeps process alive (interactive), causing request to hang.
        this.defaultArgs = [
            '-m', this.modelPath,
            '-ngl', '32',
            '-c', '4096', // Reduced context to 4096 for faster "prompt ingestion"
            '-t', '8',
            '-n', '512',
            '--temp', '0.1',
            '--repeat-penalty', '1.1',
            '--no-display-prompt'
        ];
    }

    async generateResponse(prompt) {
        if (!prompt || !prompt.trim()) {
            console.warn("[LlamaCLI] Received empty prompt, skipping generation.");
            return "No input provided for generation.";
        }
        return new Promise((resolve, reject) => {
            console.log(`[LlamaCLI] Starting generation... (Internal logs in logs/llama_cli.log)`);

            // Use non-blocking write stream
            const logStream = fs.createWriteStream(this.logPath);
            logStream.write(`--- LlamaCLI Run Start: ${new Date().toISOString()} ---\n`);

            const args = [...this.defaultArgs, '-p', `User: ${prompt}\nAssistant:`];

            const child = spawn(this.executablePath, args, {
                cwd: process.cwd(),
                detached: true, // Create a new process group on Windows
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';
            const MAX_STRING_SIZE = 10 * 1024 * 1024; // 10MB limit

            const timeout = setTimeout(() => {
                const msg = `[LlamaCLI] Generation TIMEOUT reached (300s).`;
                console.error(msg);
                logStream.write(`\n\nERROR: ${msg}\n`);
                child.kill('SIGKILL');
                reject(new Error("LLM generation timed out."));
            }, 300000);

            // Important: Handle parent process exit to clean up child
            const cleanup = () => {
                if (child.exitCode === null) {
                    console.log("[LlamaCLI] Parent process exiting, killing child...");
                    child.kill('SIGKILL');
                }
            };
            process.on('exit', cleanup);
            process.on('SIGINT', cleanup);

            if (child.stdin) child.stdin.end();

            const startTime = Date.now();
            let ingestionFinished = false;

            child.stdout.on('data', (data) => {
                const chunk = data.toString();

                if (output.length + chunk.length > MAX_STRING_SIZE) {
                    console.error("[LlamaCLI] Runaway output detected (>10MB). Killing process.");
                    child.kill('SIGKILL');
                    return;
                }

                output += chunk;

                if (!ingestionFinished && output.trim().length > 0) {
                    const ingestionTime = ((Date.now() - startTime) / 1000).toFixed(2);
                    console.log(`[LlamaCLI] Prompt ingestion finished in ${ingestionTime}s. Generating output...`);
                    ingestionFinished = true;
                }

                logStream.write(chunk);
            });

            child.stderr.on('data', (data) => {
                const chunk = data.toString();

                if (errorOutput.length + chunk.length > MAX_STRING_SIZE) {
                    child.kill('SIGKILL');
                    return;
                }

                errorOutput += chunk;
                logStream.write(`[STDERR] ${chunk}`);

                if (chunk.includes('Found 1 Vulkan devices')) {
                    console.log(`[LlamaCLI] GPU detected: Vulkan acceleration active.`);
                }
            });

            child.on('close', (code, signal) => {
                clearTimeout(timeout);
                process.removeListener('exit', cleanup);
                process.removeListener('SIGINT', cleanup);

                const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
                logStream.write(`\n\n--- Process finished in ${totalTime}s. Code: ${code}, Signal: ${signal} ---\n`);
                logStream.end();

                if (code !== 0 && code !== null) {
                    let errorMsg = `LlamaCLI failed (code ${code}).`;
                    if (code === 130) {
                        errorMsg = "LlamaCLI was interrupted (Code 130). This usually means the server restarted or nodemon detected a change.";
                    }

                    console.error(`[LlamaCLI] ${errorMsg}`);
                    // Only show stderr if it's not a standard interrupt
                    if (code !== 130) {
                        console.error(`[LlamaCLI] Last error output: ${errorOutput.slice(-500).trim()}`);
                    }
                    return reject(new Error(`${errorMsg} See logs/llama_cli.log for full details.`));
                }

                console.log(`[LlamaCLI] Completed in ${totalTime}s.`);
                resolve(output.trim());
            });

            child.on('error', (err) => {
                clearTimeout(timeout);
                console.error(`[LlamaCLI] Spawn Error:`, err);
                logStream.write(`\n\nSPAWN ERROR: ${err.message}\n`);
                logStream.end();
                reject(err);
            });
        });
    }
}

module.exports = new LlamaCliService();
