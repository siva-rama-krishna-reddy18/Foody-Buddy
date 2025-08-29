// services/embeddingService.js
const { HfInference } = require('@huggingface/inference');

const {
  HUGGING_FACE_API_KEY = 'hf_PobweTVxJpurCbUatJCpxXQctkyuYMIMT',
  HF_EMBED_MODEL = 'sentence-transformers/all-MiniLM-L6-v2',
  PGVECTOR_DIM = '384'
} = process.env;

const hf = new HfInference(HUGGING_FACE_API_KEY);

async function embed(text) {
  // HF featureExtraction returns number[][] or number[]
  const r = await hf.featureExtraction({ model: HF_EMBED_MODEL, inputs: text });
  const vec = Array.isArray(r[0]) ? r[0] : r;
  return vec.map(Number);
}

module.exports = { embed, PGVECTOR_DIM: Number(PGVECTOR_DIM) };
