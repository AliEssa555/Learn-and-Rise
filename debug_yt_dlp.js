const fs = require('fs');
const transcriptService = require('./src/services/transcriptService');

const videoId = 'dIUEwTn6VWw';
const url = `https://www.youtube.com/watch?v=${videoId}`;
const logFile = 'yt_dlp_test_log.txt';

function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

fs.writeFileSync(logFile, 'Starting yt-dlp Strategy Test: ' + new Date().toISOString() + '\n');

async function run() {
    log(`Testing TranscriptService.getTranscript for: ${url}`);
    try {
        const result = await transcriptService.getTranscript(url);
        if (result && result.fullText) {
            log('SUCCESS!');
            log('Full Text Length: ' + result.fullText.length);
            log('Preview: ' + result.fullText.slice(0, 200) + '...');
        } else {
            log('FAILED: Result was empty');
        }
    } catch (e) {
        log('CRASHED: ' + e.message);
        log(e.stack);
    }
}

run().then(() => log('\nTest Finished.'));
