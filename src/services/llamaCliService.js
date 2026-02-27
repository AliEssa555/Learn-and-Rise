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
            '-ngl', '100',
            '-c', '8192',
            '-t', '8',
            '-n', '-512', // Generate until end of text
            '--no-display-prompt'
        ];
    }

    async generateResponse(prompt) {
        return new Promise((resolve, reject) => {
            console.log(`[LlamaCLI] Spawning: ${this.executablePath} with model ${this.modelPath}`);

            // Use -p for one-shot generation
            const args = [...this.defaultArgs, '-p', `User: ${prompt}\nAssistant:`];

            const child = spawn(this.executablePath, args, {
                cwd: process.cwd()
            });

            let output = '';
            let errorOutput = '';

            // We do not need to write to stdin if using -p
            child.stdin.end();

            child.stdout.on('data', (data) => {
                const chunk = data.toString();
                // console.log('[LlamaCLI stdout]', chunk);
                output += chunk;
            });

            child.stderr.on('data', (data) => {
                const chunk = data.toString();
                // console.log('[LlamaCLI stderr]', chunk);
                errorOutput += chunk;
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    console.error(`LlamaCLI exited with code ${code}`);
                    // Fallback: if output is empty, reject.
                    if (!output.trim()) return reject(new Error(`LlamaCLI failed: ${errorOutput}`));
                }

                // Cleanup output: Remove the prompt itself if echoed, remove system headers
                // This is messy with CLIs. 
                // Returning raw output for now.
                resolve(output.trim());
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    }
}

module.exports = new LlamaCliService();
