const admin = require('firebase-admin');
const serviceAccount = require('./firebase-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve();
        return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

async function wipeTranscripts() {
    console.log('Starting deep wipe of transcripts collection...');

    const transcripts = await db.collection('transcripts').get();
    console.log(`Found ${transcripts.size} top-level transcripts.`);

    for (const doc of transcripts.docs) {
        console.log(`Deleteting transcript: ${doc.id}`);

        // 1. Delete messages subcollections under each user chat
        const chats = await doc.ref.collection('chats').get();
        for (const chatDoc of chats.docs) {
            console.log(`  Deleting chat history for user: ${chatDoc.id}`);
            await deleteCollection(`${doc.ref.path}/chats/${chatDoc.id}/messages`, 100);
            await chatDoc.ref.delete();
        }

        // 2. Delete the transcript document itself
        await doc.ref.delete();
    }

    console.log('Cleanup complete. Start with a clean slate!');
    process.exit(0);
}

wipeTranscripts().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
