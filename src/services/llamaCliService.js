const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

class LlamaCliService {
    constructor() {
        // Build path: project_root/llama.cpp/build/bin/Release/llama-cli.exe
        this.executablePath = path.join(process.cwd(), 'llama.cpp', 'build', 'bin', 'Release', 'llama-cli.exe');
        this.modelPath = path.join(process.cwd(), 'llama.cpp', 'qwen2.5-7b-q4_k_m.gguf');
        this.logPath = path.join(process.cwd(), 'llama_cli.log');

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
            console.log(`[LlamaCLI] Execution Start (Logging internal details to llama_cli.log)`);

            // Initialize or Clear log file
            fs.writeFileSync(this.logPath, `--- LlamaCLI Run Start: ${new Date().toISOString()} ---\n`);

            const args = [...this.defaultArgs, '-p', `User: ${prompt}\nAssistant:`];

            const child = spawn(this.executablePath, args, {
                cwd: process.cwd()
            });

            let output = '';
            let errorOutput = '';

            // 5 minute timeout for generation (ingestion + generation can be slow)
            const timeout = setTimeout(() => {
                const msg = `[LlamaCLI] Generation TIMEOUT reached (300s).`;
                console.error(msg);
                fs.appendFileSync(this.logPath, `\n\nERROR: ${msg}\n`);
                child.kill('SIGKILL');
                reject(new Error("LLM generation timed out."));
            }, 300000);

            child.stdin.end();

            const startTime = Date.now();
            let ingestionFinished = false;

            child.stdout.on('data', (data) => {
                if (!ingestionFinished) {
                    const ingestionTime = ((Date.now() - startTime) / 1000).toFixed(2);
                    console.log(`[LlamaCLI] Prompt ingestion finished in ${ingestionTime}s. Starting generation...`);
                    ingestionFinished = true;
                }
                const chunk = data.toString();
                output += chunk;
                // Append output to log file
                fs.appendFileSync(this.logPath, chunk);
            });

            child.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                // Append stderr to log file for diagnostics
                fs.appendFileSync(this.logPath, `[STDERR] ${chunk}`);
            });

            child.on('close', (code, signal) => {
                clearTimeout(timeout);
                const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`[LlamaCLI] Process exited after ${totalTime}s. (Code ${code})`);

                fs.appendFileSync(this.logPath, `\n\n--- Process exited after ${totalTime}s. Code: ${code}, Signal: ${signal} ---\n`);

                if (code !== 0 && code !== null) {
                    const errorMsg = `LlamaCLI failed (code ${code}). Check llama_cli.log for details.`;
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
                fs.appendFileSync(this.logPath, `\n\nSPAWN ERROR: ${err.message}\n`);
                reject(err);
            });
        });
    }
}

module.exports = new LlamaCliService();
