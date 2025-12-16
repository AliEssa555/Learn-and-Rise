const { YoutubeTranscript } = require('youtube-transcript');

class TranscriptService {
    async getTranscript(url) {
        try {
            // Fetch transcript
            const transcriptItems = await YoutubeTranscript.fetchTranscript(url);

            // Format into full text
            const fullText = transcriptItems.map(item => item.text).join(' ');

            // Return both raw items (for timestamps) and full text
            return {
                fullText,
                items: transcriptItems
            };
        } catch (error) {
            console.error('Transcript Error:', error);
            throw new Error('Failed to fetch transcript. Video might not have captions enabled.');
        }
    }
}

module.exports = new TranscriptService();
