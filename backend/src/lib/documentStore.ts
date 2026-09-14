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
}

// ── Configuration ─────────────────────────────────────────────────────────────

/** How long a document lives in memory before being evicted. */
const TTL_MS = 30 * 60 * 1_000; // 30 minutes

/** How often the background sweep runs. */
const PURGE_INTERVAL_MS = 5 * 60 * 1_000; // every 5 minutes

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
 * Persist a document in memory.
 * Call this exactly once per uploaded document.
 */
export function storeDocument(doc: StoredDocument): void {
  store.set(doc.documentId, doc);
}

/**
 * Retrieve a document by its ID.
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

/** Exposed only for unit tests — do not call in production code. */
export function _storeSize(): number {
  return store.size;
}
