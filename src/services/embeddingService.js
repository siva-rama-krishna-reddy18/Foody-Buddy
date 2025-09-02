// src/services/embeddingService.js
const DEBUG = process.env.NODE_ENV === 'development';

// Use a different variable name to avoid conflicts
let embeddingClient;
let embeddingEnabled = false;

try {
  if (process.env.HUGGINGFACE_API_KEY && process.env.HUGGINGFACE_API_KEY !== 'test_key') {
    const { HfInference } = require('@huggingface/inference');
    embeddingClient = new HfInference(process.env.HUGGINGFACE_API_KEY);
    embeddingEnabled = true;
    if (DEBUG) console.log('[EMBEDDING] Service initialized');
  } else {
    if (DEBUG) console.log('[EMBEDDING] API key not configured');
  }
} catch (error) {
  console.warn('[EMBEDDING] Initialization failed:', error.message);
}

async function generateEmbedding(text) {
  try {
    if (!embeddingEnabled || !embeddingClient) {
      if (DEBUG) console.log('[EMBEDDING] Service not available');
      return null;
    }
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return null;
    }
    
    if (DEBUG) console.log(`[EMBEDDING] Generating embedding...`);
    
    const result = await embeddingClient.featureExtraction({
      model: 'BAAI/bge-small-en-v1.5',
      inputs: text.trim()
    });
    
    let embedding = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : result;
    
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return null;
    }
    
    if (DEBUG) console.log(`[EMBEDDING] Generated ${embedding.length}-dimensional embedding`);
    return embedding;
    
  } catch (error) {
    console.error('[EMBEDDING] Error:', error.message);
    return null;
  }
}

module.exports = {
  generateEmbedding
};