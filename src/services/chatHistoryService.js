const admin = require('firebase-admin');

class ChatHistoryService {
    get db() {
        return admin.firestore();
    }

    /**
     * Get recent chat history for a specific video and user.
     * @param {string} videoId 
     * @param {string} userId (Required if multi-user, otherwise use 'default')
     * @param {number} limit 
     */
    async getHistory(videoId, userId = 'default_user', limit = 6) {
        try {
            console.log(`[ChatHistoryService] Loading history for ${videoId} (User: ${userId})...`);
            const snapshot = await this.db.collection('transcripts')
                .doc(videoId)
                .collection('chats')
                .doc(userId)
                .collection('messages')
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            if (snapshot.empty) return [];

            // Return in chronological order
            return snapshot.docs.reverse().map(doc => {
                const data = doc.data();
                return [data.role, data.content];
            });
        } catch (error) {
            console.error(`[ChatHistoryService] Error loading history:`, error.message);
            return [];
        }
    }

    /**
     * Add a message to the persistent history.
     */
    async addMessage(videoId, role, content, userId = 'default_user') {
        try {
            await this.db.collection('transcripts')
                .doc(videoId)
                .collection('chats')
                .doc(userId)
                .collection('messages')
                .add({
                    role, // 'human' or 'ai'
                    content,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            console.log(`[ChatHistoryService] Message saved to Firestore.`);
        } catch (error) {
            console.warn(`[ChatHistoryService] Failed to save message:`, error.message);
        }
    }

    /**
     * Clear history for a video/user session.
     */
    async clearHistory(videoId, userId = 'default_user') {
        // Implementation for clearing would require deleting all docs in the messages sub-collection
        // For now, we mainly rely on limits.
    }
}

module.exports = new ChatHistoryService();
