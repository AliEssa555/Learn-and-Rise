const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

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
    async getHistory(videoId, userId, limit = 6) {
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
    async addMessage(videoId, role, content, userId) {
        try {
            await this.db.collection('transcripts')
                .doc(videoId)
                .collection('chats')
                .doc(userId)
                .collection('messages')
                .add({
                    role, // 'human' or 'ai'
                    content,
                    createdAt: FieldValue.serverTimestamp()
                });
            console.log(`[ChatHistoryService] Message saved to Firestore.`);
        } catch (error) {
            console.warn(`[ChatHistoryService] Failed to save message:`, error.message);
        }
    }

    /**
     * Clear history for a video/user session.
     */
    async clearHistory(videoId, userId) {
        try {
            console.log(`[ChatHistoryService] Deleting history for ${videoId} (User: ${userId})...`);
            const messagesRef = this.db.collection('transcripts')
                .doc(videoId)
                .collection('chats')
                .doc(userId)
                .collection('messages');

            const snapshot = await messagesRef.get();
            if (!snapshot.empty) {
                const batch = this.db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }

            // Also delete the chat document itself
            await this.db.collection('transcripts')
                .doc(videoId)
                .collection('chats')
                .doc(userId)
                .delete();

            console.log(`[ChatHistoryService] History cleared for ${userId} on ${videoId}`);
        } catch (error) {
            console.error(`[ChatHistoryService] Delete failed:`, error.message);
            throw error;
        }
    }
}

module.exports = new ChatHistoryService();
