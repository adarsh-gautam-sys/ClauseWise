/**
 * In-memory document store with TTL-based auto-purge.
 *
 * AGENTS.md rule: document text must never be written to disk or a log file.
 * This module keeps everything in process memory and evicts entries after a
 * configurable TTL so memory does not grow unboundedly.
 *
 * The store is intentionally NOT exported as a singleton object with mutable
 * state visible to tests — callers interact through the typed functions below.
 */

import type { Classification } from "../prompts/classify.js";
import type { AnalysisResponse } from "../prompts/analyze.js";

/** A single chunk of text derived from a document. */
export interface Chunk {
  /** 0-based position within the document. */
  index: number;
  text: string;
}

/** Everything we hold in memory about an uploaded document. */
export interface StoredDocument {
  documentId: string;
  /** Full extracted plain text — held only for downstream analysis routes. */
  fullText: string;
  chunks: Chunk[];
  /** ISO timestamp of ingestion — used for TTL checks. */
  ingestedAt: string;
  /** Approximate character count of the original text. */
  charCount: number;
  /** Classification result — populated by POST /:id/classify. */
  classification?: Classification;
  /** Clause analysis result — populated by POST /:id/analyze. */
  analysis?: AnalysisResponse;
  /**
   * Dense embedding vectors for each text chunk — populated lazily on the
   * first POST /:id/ask call.  Parallel array: chunkEmbeddings[i] is the
   * embedding for chunks[i].  Used for Q&A retrieval.
   */
  chunkEmbeddings?: number[][];

  /**
   * Dense embedding vectors for each analysed clause's plain_language_summary
   * — populated lazily on the first POST /compare call that references this
   * document.  Parallel array: clauseEmbeddings[i] is the embedding for
   * analysis.clauses[i].  Used for cross-document clause alignment.
   */
  clauseEmbeddings?: number[][];
}

// ── Configuration ─────────────────────────────────────────────────────────────

/** How long a document lives in memory before being evicted. */
const TTL_MS = 30 * 60 * 1_000; // 30 minutes

/** How often the background sweep runs. */
const PURGE_INTERVAL_MS = 5 * 60 * 1_000; // every 5 minutes

/** Maximum number of documents retained simultaneously in memory (LRU capacity bound). */
const MAX_DOCUMENTS = 100;

// ── Internal store ────────────────────────────────────────────────────────────

const store = new Map<string, StoredDocument>();

// ── TTL sweep ─────────────────────────────────────────────────────────────────

function purgeExpired(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, doc] of store.entries()) {
    if (new Date(doc.ingestedAt).getTime() < cutoff) {
      store.delete(id);
    }
  }
}

// Unref so this timer does not prevent clean process shutdown.
const purgeTimer = setInterval(purgeExpired, PURGE_INTERVAL_MS);
purgeTimer.unref();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Persist a document in memory with strict LRU capacity bounds.
 * Call this exactly once per uploaded document.
 */
export function storeDocument(doc: StoredDocument): void {
  // Enforce bounded memory: evict least-recently-used item if at capacity
  if (store.size >= MAX_DOCUMENTS && !store.has(doc.documentId)) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) {
      store.delete(oldestKey);
    }
  }
  store.set(doc.documentId, doc);
}

/**
 * Retrieve a document by its ID.
 * Refreshes access order for LRU tracking.
 * Returns undefined if the ID is unknown or the entry has expired.
 */
export function getDocument(documentId: string): StoredDocument | undefined {
  const doc = store.get(documentId);
  if (!doc) return undefined;

  // Lazy expiry check on read — belt-and-suspenders alongside the sweep.
  if (new Date(doc.ingestedAt).getTime() < Date.now() - TTL_MS) {
    store.delete(documentId);
    return undefined;
  }

  // Refresh LRU recency
  store.delete(documentId);
  store.set(documentId, doc);

  return doc;
}

/** Explicitly remove a document before its TTL (e.g. user-triggered deletion). */
export function deleteDocument(documentId: string): void {
  store.delete(documentId);
}

/**
 * Attach a classification result to an already-stored document.
 * No-op if the document has already expired or was never stored.
 */
export function setClassification(documentId: string, classification: Classification): void {
  const doc = store.get(documentId);
  if (doc) {
    doc.classification = classification;
  }
}

/**
 * Attach a clause analysis result to an already-stored document.
 * No-op if the document has already expired or was never stored.
 */
export function setAnalysis(documentId: string, analysis: AnalysisResponse): void {
  const doc = store.get(documentId);
  if (doc) {
    doc.analysis = analysis;
  }
}

/**
 * Cache the pre-computed chunk embeddings on the document record.
 * Called once per document on the first Q&A request; subsequent questions
 * skip the embedding step and read directly from this cache.
 * No-op if the document has already expired or was never stored.
 */
export function setChunkEmbeddings(documentId: string, embeddings: number[][]): void {
  const doc = store.get(documentId);
  if (doc) {
    doc.chunkEmbeddings = embeddings;
  }
}

/**
 * Cache pre-computed clause-summary embeddings for cross-document comparison.
 * Called once per document on the first /compare call that references it;
 * subsequent comparisons reuse the cached vectors.
 * No-op if the document has already expired or was never stored.
 */
export function setClauseEmbeddings(documentId: string, embeddings: number[][]): void {
  const doc = store.get(documentId);
  if (doc) {
    doc.clauseEmbeddings = embeddings;
  }
}

/** Exposed only for unit tests — do not call in production code. */
export function _storeSize(): number {
  return store.size;
}
