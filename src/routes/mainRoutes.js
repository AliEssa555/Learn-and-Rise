const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

router.get('/', async (req, res) => {
    try {
        const db = admin.firestore();
        // Fetch last 3 transcripts that were updated (we'll check for those with history)
        const snapshot = await db.collection('transcripts')
            .orderBy('createdAt', 'desc')
            .limit(10) // Fetch more to filter for active chats if needed
            .get();

        const recentConvos = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            // Check if there's at least one message in the 'chats' subcollection
            // Path: transcripts/{videoId}/chats/default_user/messages
            const chatSnap = await db.collection('transcripts')
                .doc(doc.id)
                .collection('chats')
                .doc('default_user')
                .collection('messages')
                .limit(1)
                .get();

            if (!chatSnap.empty) {
                recentConvos.push({
                    videoId: doc.id,
                    url: data.url,
                    preview: data.fullText ? data.fullText.slice(0, 100) + '...' : 'Conversation context...',
                    date: data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'Recently'
                });
            }
            if (recentConvos.length >= 3) break;
        }

        res.render('main', {
            recentConvos,
            user: req.user
        });
    } catch (error) {
        console.error("[MainRoute] Error fetching history:", error);
        res.render('main', { recentConvos: [], user: req.user });
    }
});

// Alias for old charts/redirects if needed
router.get('/dashboard', (req, res) => {
    res.redirect('/');
});

module.exports = router;
