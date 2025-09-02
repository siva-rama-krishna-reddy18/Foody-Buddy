// src/services/embeddingService.js
const { HfInference } = require('@huggingface/inference');

const DEBUG = process.env.NODE_ENV === 'development';

// Initialize Hugging Face client
let hf;
try {
  hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
} catch (error) {
  console.warn('[EMBEDDING] Hugging Face not configured, embeddings disabled');
}

async function generateEmbedding(text) {
  try {
    if (!hf) {
      if (DEBUG) console.log('[EMBEDDING] Hugging Face not available, skipping embedding');
      return null;
    }
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn('[EMBEDDING] Invalid text provided for embedding');
      return null;
    }
    
    if (DEBUG) console.log(`[EMBEDDING] Generating embedding for: "${text.substring(0, 50)}..."`);
    
    const result = await hf.featureExtraction({
      model: 'BAAI/bge-small-en-v1.5',
      inputs: text.trim()
    });
    
    let embedding;
    if (Array.isArray(result)) {
      embedding = Array.isArray(result[0]) ? result[0] : result;
    } else if (result && typeof result === 'object' && result.data) {
      embedding = result.data;
    } else {
      embedding = result;
    }
    
    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.warn('[EMBEDDING] Invalid embedding format received');
      return null;
    }
    
    if (DEBUG) console.log(`[EMBEDDING] Generated ${embedding.length}-dimensional embedding`);
    return embedding;
    
  } catch (error) {
    if (error.message?.includes('permission') || error.message?.includes('auth')) {
      if (DEBUG) console.log('[EMBEDDING] API permission issue, skipping embedding');
    } else {
      console.error('[EMBEDDING] Generation error:', error.message);
    }
    return null;
  }
}

if (DEBUG) {
  console.log('[EMBEDDING] Service loaded');
}

module.exports = {
  generateEmbedding
};