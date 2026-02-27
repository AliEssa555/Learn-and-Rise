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
            '--no-display-prompt',
            '--reverse-prompt', 'User:',
            '--reverse-prompt', 'System:'
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
                fs.writeFileSync(tempPromptPath, `User: ${prompt}\nAssistant:`);
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
        const assistantMarker = "Assistant:";
        const lastMarkerIndex = cleaned.lastIndexOf(assistantMarker);

        if (lastMarkerIndex !== -1) {
            cleaned = cleaned.substring(lastMarkerIndex + assistantMarker.length).trim();
        }

        // Also remove any leftover statistics block if salvaged
        if (cleaned.includes('[ Prompt:')) {
            cleaned = cleaned.split('[ Prompt:')[0].trim();
        }

        return cleaned;
    }
}

module.exports = new LlamaCliService();
