/**
 * Unit tests for backend/src/lib/similarity.ts
 *
 * All functions are pure — no mocks needed, no network calls.
 */

import { describe, it, expect } from "vitest";
import { cosineSimilarity, topKChunks } from "./similarity.js";
import type { Chunk } from "./documentStore.js";

// ── cosineSimilarity ───────────────────────────────────────────────────────────

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("returns 1 for parallel vectors (scalar multiple)", () => {
    expect(cosineSimilarity([1, 0], [3, 0])).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("returns -1 for anti-parallel vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  it("returns 0 for a zero-magnitude vector (no NaN)", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 when vectors have different lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("handles high-dimensional vectors correctly", () => {
    // Two identical 768-dim unit vectors — should be ~1.
    const dim = 768;
    const a = Array.from({ length: dim }, () => Math.random());
    const similarity = cosineSimilarity(a, a);
    expect(similarity).toBeCloseTo(1, 4);
  });

  it("is symmetric: sim(a,b) === sim(b,a)", () => {
    const a = [0.5, 0.3, 0.8];
    const b = [0.1, 0.9, 0.4];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

// ── topKChunks ─────────────────────────────────────────────────────────────────

/** Build a minimal Chunk for testing. */
function makeChunk(index: number, text = `Chunk ${index}`): Chunk {
  return { index, text };
}

describe("topKChunks", () => {
  it("returns the most similar chunk first", () => {
    // query = [1, 0], chunk 0 = [1, 0] (perfect match), chunk 1 = [0, 1] (orthogonal)
    const query = [1, 0];
    const embeddings = [
      [1, 0],
      [0, 1],
    ];
    const chunks = [makeChunk(0), makeChunk(1)];

    const result = topKChunks(query, embeddings, chunks, 1);
    expect(result).toHaveLength(1);
    expect(result[0]?.index).toBe(0);
  });

  it("returns top k chunks in descending similarity order", () => {
    // Deliberately construct embeddings with known similarity ordering.
    const query = [1, 0, 0];
    const embeddings = [
      [0, 1, 0], // sim ≈ 0 (orthogonal)
      [1, 0, 0], // sim = 1 (identical)
      [0.7, 0.7, 0], // sim ≈ 0.707
    ];
    const chunks = [makeChunk(0), makeChunk(1), makeChunk(2)];

    const result = topKChunks(query, embeddings, chunks, 3);
    expect(result[0]?.index).toBe(1); // sim = 1
    expect(result[1]?.index).toBe(2); // sim ≈ 0.707
    expect(result[2]?.index).toBe(0); // sim ≈ 0
  });

  it("clamps k to chunk count (k > length)", () => {
    const query = [1, 0];
    const embeddings = [
      [1, 0],
      [0, 1],
    ];
    const chunks = [makeChunk(0), makeChunk(1)];

    const result = topKChunks(query, embeddings, chunks, 100);
    expect(result).toHaveLength(2);
  });

  it("clamps k to minimum 1", () => {
    const query = [1, 0];
    const embeddings = [[1, 0]];
    const chunks = [makeChunk(0)];

    const result = topKChunks(query, embeddings, chunks, 0);
    expect(result).toHaveLength(1);
  });

  it("returns empty array for empty chunks", () => {
    expect(topKChunks([1, 0], [], [], 3)).toEqual([]);
  });

  it("never drops input chunks (output.length <= input.length)", () => {
    const n = 10;
    const query = Array.from({ length: 3 }, () => Math.random());
    const embeddings = Array.from({ length: n }, () =>
      Array.from({ length: 3 }, () => Math.random()),
    );
    const chunks = Array.from({ length: n }, (_, i) => makeChunk(i));

    const result = topKChunks(query, embeddings, chunks, 4);
    expect(result.length).toBeLessThanOrEqual(chunks.length);
    expect(result.length).toBe(4);
  });

  it("breaks ties by original index (lower index wins)", () => {
    // Two chunks with identical embedding → identical similarity → lower index first.
    const query = [1, 0];
    const same = [1, 0];
    const embeddings = [same, same];
    const chunks = [makeChunk(0, "first"), makeChunk(1, "second")];

    const result = topKChunks(query, embeddings, chunks, 2);
    expect(result[0]?.index).toBe(0);
    expect(result[1]?.index).toBe(1);
  });
});
