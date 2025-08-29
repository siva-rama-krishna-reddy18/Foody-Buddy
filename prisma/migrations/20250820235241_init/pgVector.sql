-- Enable pgvector (idempotent)
CREATE EXTENSION IF NOT EXISTS "vector";

-- Embeddings table
CREATE TABLE IF NOT EXISTS "public"."embeddings" (
  "id"         UUID        PRIMARY KEY,
  "owner_type" TEXT        NOT NULL,
  "owner_id"   TEXT        NOT NULL,
  "content"    TEXT        NOT NULL,
  "embedding"  VECTOR(384) NOT NULL,  -- change 384 if your model's dimension differs
  "metadata"   JSONB,
  "created_at" TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Supporting indexes
CREATE INDEX IF NOT EXISTS "embeddings_owner_idx"
  ON "public"."embeddings" ("owner_type", "owner_id");

-- ANN index (IVFFLAT + cosine). Use this by default.
CREATE INDEX IF NOT EXISTS "embeddings_embedding_ivfflat_cosine"
  ON "public"."embeddings"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

-- Alternative (pgvector >= 0.5): HNSW + cosine. If you prefer HNSW, uncomment below
-- and (optionally) drop the IVFFLAT index above.
-- CREATE INDEX IF NOT EXISTS "embeddings_embedding_hnsw_cosine"
--   ON "public"."embeddings"
--   USING hnsw ("embedding" vector_cosine_ops)
--   WITH (m = 16, ef_construction = 200);
