const { PrismaClient } = require('@prisma/client');
const { HfInference } = require('@huggingface/inference');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

const HF_API_KEY   = process.env.HUGGING_FACE_API_KEY || '';
const EMBED_MODEL  = process.env.HF_EMBED_MODEL_ID || 'sentence-transformers/all-MiniLM-L6-v2';
const EMBED_DIM    = Number(process.env.HF_EMBED_DIM || 384);
const hf = HF_API_KEY ? new HfInference(HF_API_KEY) : null;

// Turn array -> pgvector literal: "[0.1,0.2,...]"
function toPgVectorLiteral(vec) {
  const arr = Array.from(vec, Number);
  if (arr.length !== EMBED_DIM) throw new Error(`Embedding dim ${arr.length} != ${EMBED_DIM}`);
  return `[${arr.join(',')}]`;
}

async function embedText(text) {
  if (!hf) throw new Error('Missing HUGGING_FACE_API_KEY for embeddings');
  let out = await hf.featureExtraction({ model: EMBED_MODEL, inputs: text });
  // normalize to 1D
  if (Array.isArray(out) && Array.isArray(out[0])) out = out[0];
  if (!Array.isArray(out)) throw new Error('Unexpected embedding format from HF');
  if (out.length !== EMBED_DIM) {
    throw new Error(`Got dim ${out.length}, expected ${EMBED_DIM}. Set HF_EMBED_DIM or use a 384-dim model.`);
  }
  return Float32Array.from(out);
}

/**
 * Upsert a single product's embedding by productId
 */
async function upsertProductEmbedding(productId) {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, description: true, ingredients: true, category: true }
  });
  if (!p) throw new Error(`Product not found: ${productId}`);

  const content = [
    p.name || '',
    p.description || '',
    Array.isArray(p.ingredients) ? p.ingredients.join(', ') : '',
    p.category || ''
  ].filter(Boolean).join(' — ');

  if (!content) throw new Error('No text content to embed');

  const v = await embedText(content);
  const vecLit = toPgVectorLiteral(v);

  // Use raw SQL because Prisma doesn't have a native "vector" type
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO public.embeddings (id, owner_type, owner_id, content, embedding, metadata)
    VALUES ($1, 'product', $2, $3, $4::vector, '{}'::jsonb)
    ON CONFLICT (owner_type, owner_id)
    DO UPDATE SET content = EXCLUDED.content,
                  embedding = EXCLUDED.embedding,
                  metadata = EXCLUDED.metadata
    `,
    uuidv4(),        // $1 id
    p.id,            // $2 owner_id
    content,         // $3 content
    vecLit           // $4 vector literal "[...]" cast to ::vector
  );

  return { ownerType: 'product', ownerId: p.id };
}

/**
 * Reindex all products
 */
async function reindexAllProducts() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, description: true, ingredients: true, category: true }
  });
  let ok = 0, fail = 0;

  for (const p of products) {
    try { await upsertProductEmbedding(p.id); ok += 1; }
    catch (e) { console.error('[embed][fail]', p.id, e.message); fail += 1; }
  }
  return { ok, fail, total: products.length };
}

module.exports = {
  upsertProductEmbedding,
  reindexAllProducts,
};
