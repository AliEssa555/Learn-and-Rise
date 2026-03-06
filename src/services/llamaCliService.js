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

        // Zombie Process Tracking
        this.activeProcesses = new Set();
        process.on('SIGINT', () => {
            if (this.activeProcesses.size > 0) {
                console.log(`\n[LlamaCLI] Killing ${this.activeProcesses.size} active process(es)...`);
                this.activeProcesses.forEach(proc => {
                    try { proc.kill('SIGKILL'); } catch (e) { }
                });
                this.activeProcesses.clear();
            }
            process.exit(0);
        });

        // Args from user request (modified for API usage):
        // -m qwen2.5-7b-q4_k_m.gguf -ngl 100 -c 8192 -t 8 -n -1
        // Removed -cnv because it keeps process alive (interactive), causing request to hang.
        this.defaultArgs = [
            '-m', this.modelPath,
            '-ngl', '999',
            '-c', '2048', // Reduced context to 4096 for faster "prompt ingestion"
            '-t', '4',
            '-n', '256',
            '--temp', '0.3',
            '--repeat-penalty', '1.1',
            '--no-display-prompt',
            '--log-disable'
        ];
    }

    async generateResponse(prompt) {
        if (!prompt || !prompt.trim()) {
            console.warn("[LlamaCLI] Received empty prompt, skipping generation.");
            return "No input provided for generation.";
        }

        const runId = Math.random().toString(36).substring(7);
        const tempPromptPath = path.join(this.logDir, `prompt_${runId}.txt`);

        return new Promise((resolve, reject) => {
            try {
                // Write prompt to file to avoid command-line length limits and shell-escaping issues
                fs.writeFileSync(tempPromptPath, prompt);
            } catch (fsErr) {
                console.error("[LlamaCLI] Failed to write temp prompt:", fsErr);
                return reject(fsErr);
            }

            console.log(`[LlamaCLI] [${runId}] Starting generation...`);

            // Use non-blocking write stream for internal debugging
            const logStream = fs.createWriteStream(this.logPath, { flags: 'a' });
            logStream.write(`\n--- LlamaCLI Run Start [${runId}]: ${new Date().toISOString()} ---\n`);

            // Use -f instead of -p for maximum reliability with multi-line prompts
            const args = [...this.defaultArgs, '-f', tempPromptPath];

            const child = spawn(this.executablePath, args, {
                cwd: process.cwd(),
                detached: true,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            this.activeProcesses.add(child);
            child.on('exit', () => this.activeProcesses.delete(child));

            let output = '';
            let errorOutput = '';
            let killedDueToRunaway = false;
            let lastValidLength = 0;
            const MAX_STRING_SIZE = 10 * 1024 * 1024; // 10MB limit

            const timeout = setTimeout(() => {
                const msg = `[LlamaCLI] [${runId}] Generation TIMEOUT reached (300s).`;
                console.error(msg);
                child.kill('SIGKILL');
                reject(new Error("LLM generation timed out."));
            }, 300000);

            const cleanup = () => {
                if (child.exitCode === null) child.kill('SIGKILL');
                try { if (fs.existsSync(tempPromptPath)) fs.unlinkSync(tempPromptPath); } catch (e) { }
            };
            process.on('exit', cleanup);
            process.on('SIGINT', cleanup);

            const startTime = Date.now();
            let ingestionFinished = false;

            child.stdout.on('data', (data) => {
                const chunk = data.toString();

                if (!killedDueToRunaway && output.length + chunk.length > MAX_STRING_SIZE) {
                    console.error(`[LlamaCLI] [${runId}] Runaway output detected (>10MB). Killing.`);
                    killedDueToRunaway = true;
                    child.kill('SIGKILL');
                    return;
                }

                if (!killedDueToRunaway) {
                    output += chunk;

                    // SMART SALVAGING: Track last valid point (stats or stop tokens)
                    const statsIndex = output.indexOf('[ Prompt:');
                    if (statsIndex !== -1) {
                        lastValidLength = statsIndex;
                    } else if (output.includes('User:')) {
                        lastValidLength = output.lastIndexOf('User:');
                    } else {
                        lastValidLength = output.length;
                    }

                    if (!ingestionFinished && output.trim().length > 0) {
                        const ingestionTime = ((Date.now() - startTime) / 1000).toFixed(2);
                        console.log(`[LlamaCLI] [${runId}] Ingestion finished in ${ingestionTime}s. Generating...`);
                        ingestionFinished = true;
                    }
                }
                logStream.write(chunk);
            });

            child.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                logStream.write(`[ERR] ${chunk}`);
                if (chunk.includes('Found 1 Vulkan devices')) {
                    console.log(`[LlamaCLI] [${runId}] GPU detected.`);
                }
            });

            child.on('close', (code, signal) => {
                clearTimeout(timeout);
                process.removeListener('exit', cleanup);
                process.removeListener('SIGINT', cleanup);

                // Cleanup temp file
                try { if (fs.existsSync(tempPromptPath)) fs.unlinkSync(tempPromptPath); } catch (e) { }

                const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
                logStream.write(`\n--- Run Finished [${runId}] in ${totalTime}s. Code: ${code} ---\n`);
                logStream.end();

                if (killedDueToRunaway) {
                    const salvaged = output.substring(0, lastValidLength).trim();
                    if (salvaged.length > 50) {
                        console.log(`[LlamaCLI] [${runId}] Runaway triggered, salvaging ${salvaged.length} chars.`);
                        return resolve(this._cleanResponse(salvaged));
                    }
                    return reject(new Error("LlamaCLI produced runaway output (>10MB)."));
                }

                if (code !== 0 && code !== null) {
                    console.error(`[LlamaCLI] [${runId}] Failed with code ${code}.`);
                    return reject(new Error(`LlamaCLI failed (code ${code}).`));
                }

                console.log(`[LlamaCLI] [${runId}] Completed in ${totalTime}s.`);
                resolve(this._cleanResponse(output));
            });

            child.on('error', (err) => {
                clearTimeout(timeout);
                cleanup();
                console.error(`[LlamaCLI] [${runId}] Spawn Error:`, err);
                reject(err);
            });
        });
    }

    _cleanResponse(output) {
        let cleaned = output.trim();

        // 1. Strip ALL startup logs and prompt echos by looking for the last known marker
        const markers = ["<|im_start|>assistant", "assistant:", "Response:", "AI:"];
        let bestIndex = -1;
        let bestMarker = "";

        for (const marker of markers) {
            const idx = cleaned.lastIndexOf(marker);
            if (idx > bestIndex) {
                bestIndex = idx;
                bestMarker = marker;
            }
        }

        if (bestIndex !== -1) {
            cleaned = cleaned.substring(bestIndex + bestMarker.length).trim();
        } else {
            // Fallback: If no markers found, aggressively strip known llama-cli startup noise
            // This handles cases where the model might start responding without the marker
            const noisePatterns = [
                /^Loading model.*?available commands.*?>\s*/is,
                /^build : .*?>\s*/is,
                /^.*?\d{2}:\d{2}:\d{2}.*?:\s*/, // Log timestamps
                /<\|im_start\|>system.*?<\|im_end\|>\s*/is, // Remove system prompt
                /<\|im_start\|>user.*?<\|im_end\|>\s*/is,   // Remove user prompt
                /<\|im_start\|>user.*?(?=Transcript:)/is,   // Partial user prompt
                /Transcript:.*?James May.*?(?=\s|$)/is      // Specific known noise from user's example
            ];

            for (const pattern of noisePatterns) {
                cleaned = cleaned.replace(pattern, '').trim();
            }
        }

        // 2. Remove trailing ChatML stop tokens or boilerplate
        cleaned = cleaned.replace(/<\|im_end\|>$/g, '').trim();

        // 3. Remove statistical metadata e.g., "[ Prompt: 512 tokens, ... ]"
        if (cleaned.includes('[ Prompt:')) {
            cleaned = cleaned.split('[ Prompt:')[0].trim();
        }

        return cleaned;
    }
}

module.exports = new LlamaCliService();
