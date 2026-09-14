/**
 * Cosine similarity utilities for RAG (Retrieval-Augmented Generation).
 *
 * This module is intentionally free of I/O, side-effects, and Gemini SDK
 * imports.  Every export is a pure function so it can be unit-tested without
 * mocks and reused across future retrieval features.
 *
 * Why cosine similarity?
 *   Text embeddings from models like gemini-embedding-001 have fixed L2 norm
 *   per-model; cosine similarity (dot-product / product-of-norms) therefore
 *   measures directional closeness in semantic space — exactly what we want
 *   when asking "which chunk is most topically related to this question?".
 */

import type { Chunk } from "./documentStore.js";

// ── Core math ──────────────────────────────────────────────────────────────────

/**
 * Compute the cosine similarity between two dense embedding vectors.
 *
 * Returns a value in [-1, 1]:
 *   1  → identical direction (most similar)
 *   0  → orthogonal (unrelated)
 *  -1  → opposite direction
 *
 * Returns 0 for degenerate cases (empty vectors, zero-magnitude vectors)
 * rather than throwing, so callers can safely sort without guarding.
 *
 * @param a  First embedding vector (must be same length as b).
 * @param b  Second embedding vector (must be same length as a).
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || b.length !== a.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    // Both vectors are the same length; TypeScript's strict index access
    // makes these appear possibly undefined, but the length check above
    // guarantees they are present.
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0; // Zero-magnitude guard — avoids NaN.

  return dot / denom;
}

// ── Retrieval ──────────────────────────────────────────────────────────────────

/**
 * Retrieve the `k` chunks most similar to `queryEmbedding` from a
 * pre-computed embedding index.
 *
 * Ordering contract: returned chunks are in descending similarity order
 * (most relevant first).  Ties are broken by original chunk index to keep
 * results deterministic.
 *
 * @param queryEmbedding   Embedding of the incoming question.
 * @param chunkEmbeddings  Parallel array of embeddings — one per chunk.
 *                         Must satisfy: chunkEmbeddings.length === chunks.length
 * @param chunks           The source chunks (text + index).
 * @param k                How many top chunks to return (clamped to
 *                         [1, chunks.length] so the call is always safe).
 * @returns                Up to `k` chunks, most relevant first.
 */
export function topKChunks(
  queryEmbedding: readonly number[],
  chunkEmbeddings: readonly (readonly number[])[],
  chunks: readonly Chunk[],
  k: number,
): Chunk[] {
  if (chunks.length === 0 || chunkEmbeddings.length === 0) return [];

  // Clamp k to a valid range.
  const safeK = Math.max(1, Math.min(k, chunks.length));

  // Score every chunk.
  const scored = chunks.map((chunk, i) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunkEmbeddings[i] ?? []),
    originalIndex: i,
  }));

  // Sort: highest score first; original index as tiebreaker (stable).
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.originalIndex - b.originalIndex;
  });

  return scored.slice(0, safeK).map((s) => s.chunk);
}
