const { YoutubeTranscript } = require('youtube-transcript');
const { getSubtitles } = require('youtube-captions-scraper');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

class TranscriptService {
    get db() {
        return admin.firestore();
    }
    extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    parseVTT(vttContent) {
        // Simple VTT parser: strip header, timestamps, and empty lines
        const lines = vttContent.split('\n');
        const textLines = [];
        let isContent = false;

        for (let line of lines) {
            line = line.trim();
            if (!line || line === 'WEBVTT' || line.startsWith('Kind:') || line.startsWith('Language:')) continue;

            // Skip timestamps (e.g., 00:00:00.000 --> 00:00:05.000)
            if (line.includes('-->')) {
                isContent = true;
                continue;
            }

            // If we are after a timestamp and the line isn't empty, it's text
            if (isContent && line !== '') {
                // Strip HTML tags (like <c>) and non-breaking spaces
                const cleanLine = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
                if (cleanLine.trim()) textLines.push(cleanLine.trim());
                isContent = false; // Wait for next timestamp or group
            }
        }

        // Deduplicate lines (YouTube VTT often repeats lines for rolling effect)
        const uniqueLines = [];
        for (let i = 0; i < textLines.length; i++) {
            if (textLines[i] !== textLines[i - 1]) {
                uniqueLines.push(textLines[i]);
            }
        }

        return uniqueLines.join(' ');
    }

    async getTranscriptWithYtDlp(videoId) {
        return new Promise((resolve, reject) => {
            const outputPath = path.join(process.cwd(), `tmp_sub_${videoId}`);
            const args = [
                '--write-auto-sub',
                '--write-sub',
                '--sub-lang', 'en',
                '--skip-download',
                '--no-cache-dir',
                '--no-update',
                '--output', outputPath,
                `https://www.youtube.com/watch?v=${videoId}`
            ];

            console.log(`[TranscriptService] Spawning yt-dlp for ${videoId}...`);
            const child = spawn('yt-dlp', args);

            const timeout = setTimeout(() => {
                child.kill();
                reject(new Error('yt-dlp timed out after 60 seconds'));
            }, 60000);

            child.on('close', (code) => {
                clearTimeout(timeout);
                if (code === 0) {
                    const possibleExtensions = ['.en.vtt', '.en-US.vtt', '.vtt'];
                    let vttPath = null;

                    for (const ext of possibleExtensions) {
                        const checkPath = outputPath + ext;
                        if (fs.existsSync(checkPath)) {
                            vttPath = checkPath;
                            break;
                        }
                    }

                    if (vttPath) {
                        try {
                            console.log(`[TranscriptService] yt-dlp SUCCESS: Found ${vttPath}`);
                            const vttContent = fs.readFileSync(vttPath, 'utf8');
                            const fullText = this.parseVTT(vttContent);
                            fs.unlinkSync(vttPath);
                            resolve(fullText);
                        } catch (e) {
                            reject(new Error(`Failed to read/parse VTT: ${e.message}`));
                        }
                    } else {
                        reject(new Error('yt-dlp succeeded but no .vtt file was found.'));
                    }
                } else {
                    reject(new Error(`yt-dlp exited with code ${code}`));
                }
            });

            child.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    async getTranscript(url) {
        let videoId = this.extractVideoId(url);
        if (!videoId) {
            console.error(`[TranscriptService] Could not extract Video ID from URL: ${url}`);
            throw new Error('Invalid YouTube URL');
        }

        console.log(`[TranscriptService] Target Video ID: ${videoId}`);

        // Step 0: Check Firestore Cache
        try {
            const doc = await this.db.collection('transcripts').doc(videoId).get();
            if (doc.exists) {
                console.log(`[TranscriptService] Cache HIT for ${videoId}`);
                const data = doc.data();
                return {
                    fullText: data.fullText,
                    items: [],
                    cached: true,
                    qa_pairs: data.qa_pairs || []
                };
            }
        } catch (error) {
            console.warn(`[TranscriptService] Cache check failed: ${error.message}`);
        }

        let fullText = "";
        let strategy = "";

        // Strategy 1: yt-dlp (Primary)
        try {
            fullText = await this.getTranscriptWithYtDlp(videoId);
            if (fullText && fullText.trim()) {
                strategy = "yt-dlp";
            }
        } catch (error) {
            console.warn(`[TranscriptService] yt-dlp failed: ${error.message}`);
        }

        // Strategy 2: Fallback
        if (!fullText) {
            try {
                const captions = await getSubtitles({ videoID: videoId, lang: 'en' });
                if (captions && captions.length > 0) {
                    fullText = captions.map(item => item.text).join(' ');
                    strategy = "captions-scraper";
                }
            } catch (error) {
                console.warn(`[TranscriptService] Fallback Strategy 2 failed: ${error.message}`);
            }
        }

        // Strategy 3: Fallback
        if (!fullText) {
            try {
                const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
                if (transcriptItems && transcriptItems.length > 0) {
                    fullText = transcriptItems.map(item => item.text).join(' ');
                    strategy = "youtube-transcript";
                }
            } catch (error) {
                console.warn(`[TranscriptService] Fallback Strategy 3 failed: ${error.message}`);
            }
        }

        if (fullText && fullText.trim()) {
            console.log(`[TranscriptService] SUCCESS via ${strategy} (${fullText.length} chars)`);

            // Save to Cache with QAPairs placeholder (populated later by route)
            try {
                await this.db.collection('transcripts').doc(videoId).set({
                    fullText,
                    videoId,
                    url,
                    strategy,
                    qa_pairs: [], // Initial empty, will be updated by process_transcript route
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log(`[TranscriptService] Result cached for ${videoId}`);
            } catch (cacheError) {
                console.warn(`[TranscriptService] Failed to cache result: ${cacheError.message}`);
            }

            return { fullText, items: [], cached: false, qa_pairs: [] };
        }

        console.error(`[TranscriptService] All transcript strategies failed for ${videoId}`);
        return { fullText: "", items: [] };
    }
}

module.exports = new TranscriptService();
