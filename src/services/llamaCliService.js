const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

class LlamaCliService {
    constructor() {
        // Build path: project_root/llama.cpp/build/bin/Release/llama-cli.exe
        this.executablePath = path.join(process.cwd(), 'llama.cpp', 'build', 'bin', 'Release', 'llama-cli.exe');
        this.modelPath = path.join(process.cwd(), 'llama.cpp', 'qwen2.5-7b-q4_k_m.gguf');

        // Args from user request (modified for API usage):
        // -m qwen2.5-7b-q4_k_m.gguf -ngl 100 -c 8192 -t 8 -n -1
        // Removed -cnv because it keeps process alive (interactive), causing request to hang.
        this.defaultArgs = [
            '-m', this.modelPath,
            '-ngl', '32',
            '-c', '8192',
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
            console.log(`[LlamaCLI] Execution Start`);
            console.log(`[LlamaCLI] Path: ${this.executablePath}`);
            console.log(`[LlamaCLI] Model: ${this.modelPath}`);

            const args = [...this.defaultArgs, '-p', `User: ${prompt}\nAssistant:`];
            console.log(`[LlamaCLI] Args: ${args.join(' ')}`);

            const child = spawn(this.executablePath, args, {
                cwd: process.cwd()
            });

            let output = '';
            let errorOutput = '';

            // 5 minute timeout for generation (ingestion + generation can be slow)
            const timeout = setTimeout(() => {
                console.error(`[LlamaCLI] Generation TIMEOUT reached (300s). Killing process.`);
                child.kill('SIGKILL');
                reject(new Error("LLM generation timed out."));
            }, 300000);

            child.stdin.end();

            child.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
            });

            child.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                if (chunk.toLowerCase().includes('error') || chunk.toLowerCase().includes('failed')) {
                    console.error(`[LlamaCLI stderr] ${chunk.trim()}`);
                }
            });

            child.on('close', (code, signal) => {
                clearTimeout(timeout);
                console.log(`[LlamaCLI] Process exited with code ${code}, signal ${signal}`);

                if (code !== 0 && code !== null) {
                    const errorMsg = `LlamaCLI failed (code ${code}, signal ${signal}): ${errorOutput.slice(-500)}`;
                    console.error(`[LlamaCLI] ${errorMsg}`);
                    return reject(new Error(errorMsg));
                }

                if (!output.trim() && signal) {
                    return reject(new Error(`LlamaCLI was interrupted by signal ${signal}`));
                }

                resolve(output.trim());
            });

            child.on('error', (err) => {
                clearTimeout(timeout);
                console.error(`[LlamaCLI] Spawn Error:`, err);
                reject(err);
            });
        });
    }
}

module.exports = new LlamaCliService();
