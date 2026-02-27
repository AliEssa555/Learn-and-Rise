const { Pinecone } = require('@pinecone-database/pinecone');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { PineconeStore } = require('@langchain/pinecone');
const path = require('path');
require('dotenv').config();

// Global singleton for the embedding pipeline to save RAM
let globalPipeline = null;

class LocalEmbeddings {
    async init() {
        if (!globalPipeline) {
            const { pipeline } = await import('@xenova/transformers');
            globalPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            console.log("[VectorService] Local embedding model 'all-MiniLM-L6-v2' loaded into memory.");
        }
    }

    async embedDocuments(texts) {
        await this.init();
        const embeddings = [];
        for (const text of texts) {
            const result = await globalPipeline(text, { pooling: 'mean', normalize: true });
            embeddings.push(Array.from(result.data));
        }
        return embeddings;
    }

    async embedQuery(text) {
        await this.init();
        const result = await globalPipeline(text, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
    }
}

class VectorService {
    constructor() {
        this.pc = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        this.indexName = process.env.PINECONE_INDEX || 'learn-and-rise';
        this.embeddings = new LocalEmbeddings();
    }

    /**
     * Chunks a transcript and upserts it to Pinecone.
     */
    async upsertTranscript(videoId, fullText) {
        if (!videoId || !fullText || fullText.trim().length === 0) {
            console.warn(`[VectorService] Skipping upsert: empty videoId or text.`);
            return false;
        }

        try {
            console.log(`[VectorService] Preparing RAG for video ${videoId}...`);

            // 1. Chunking
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200
            });
            const docs = await splitter.createDocuments([fullText], [{ videoId }]);
            console.log(`[VectorService] Created ${docs.length} chunks.`);

            // 2. Initialize Index
            const index = this.pc.index(this.indexName);

            // 3. Store in Pinecone (Use addDocuments for existing index)
            const vectorStore = await PineconeStore.fromExistingIndex(this.embeddings, {
                pineconeIndex: index,
                namespace: videoId,
                textKey: 'text'
            });

            if (docs.length > 0) {
                await vectorStore.addDocuments(docs);
            }

            console.log(`[VectorService] Successfully upserted chunks to Pinecone namespace: ${videoId}`);
            return true;
        } catch (error) {
            console.error(`[VectorService] Upsert Error:`, error.message);
            return false;
        }
    }

    /**
     * Searches for relevant chunks in a specific video namespace.
     */
    async search(videoId, query, k = 3) {
        try {
            console.log(`[VectorService] Searching RAG for: "${query}" (Namespace: ${videoId})`);
            const index = this.pc.index(this.indexName);

            const vectorStore = await PineconeStore.fromExistingIndex(this.embeddings, {
                pineconeIndex: index,
                namespace: videoId,
                textKey: 'text'
            });

            const results = await vectorStore.similaritySearch(query, k);
            return results.map(r => r.pageContent).join('\n\n');
        } catch (error) {
            console.warn(`[VectorService] Search failed or index empty:`, error.message);
            return "";
        }
    }
}

module.exports = new VectorService();
