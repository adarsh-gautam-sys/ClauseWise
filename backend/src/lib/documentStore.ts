/**
 * Document store with TTL-based auto-purge and dual-constraint LRU eviction.
 *
 * AGENTS.md rule: document text must never be written to disk, a persistent database,
 * or a log file. All data is ephemeral with strict TTL eviction.
 *
 * Scalability Architecture:
 * 1. Interface Decoupling: Provides the `DocumentStore` interface so ephemeral
 *    distributed storage adapters (e.g. Redis / Google Cloud Memorystore / Valkey)
 *    can be plugged in without changing domain or route code.
 * 2. Dual-Constraint LRU: The default in-memory implementation enforces both:
 *    - Max document count (MAX_DOCUMENTS = 100)
 *    - Max byte budget (MAX_STORE_BYTES = 50 MB, configurable via env var)
 *    Dynamically tracks the byte footprint of raw text, chunks, and dense 768-dim
 *    Float64 embedding vectors, evicting LRU documents before container memory pressure
 *    occurs under heavy concurrent traffic.
 * 3. Horizontal Scaling: Compatible with Cloud Run Session Affinity, pinning client
 *    flows to the container instance holding their active document session.
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
   * first POST /:id/ask call. Parallel array: chunkEmbeddings[i] is the
   * embedding for chunks[i]. Used for Q&A retrieval.
   */
  chunkEmbeddings?: number[][];
  /**
   * Dense embedding vectors for each analysed clause's plain_language_summary
   * — populated lazily on the first POST /compare call that references this
   * document. Parallel array: clauseEmbeddings[i] is the embedding for
   * analysis.clauses[i]. Used for cross-document clause alignment.
   */
  clauseEmbeddings?: number[][];
}

// ── Configuration ─────────────────────────────────────────────────────────────

/** How long a document lives in memory before being evicted (30 minutes). */
export const DEFAULT_TTL_MS = 30 * 60 * 1_000;

/** How often the background sweep runs (every 5 minutes). */
export const PURGE_INTERVAL_MS = 5 * 60 * 1_000;

/** Maximum number of documents retained simultaneously in memory. */
export const DEFAULT_MAX_DOCUMENTS = 100;

/**
 * Maximum estimated memory in bytes (50 MB default).
 * Leaves 450+ MB of headroom for V8 runtime, Express, and streaming buffers
 * within Cloud Run's 512Mi allocation.
 */
export const DEFAULT_MAX_STORE_BYTES = 50 * 1024 * 1024;

/**
 * Estimate the in-memory byte weight of a StoredDocument in V8.
 * Accounts for 2 bytes per UTF-16 character, 8 bytes per Float64 vector dimension,
 * and standard JS object/array overheads.
 */
export function estimateDocBytes(doc: StoredDocument): number {
  let bytes = 256; // baseline object & ID overhead

  // Full extracted plain text (2 bytes per UTF-16 character)
  if (doc.fullText) {
    bytes += doc.fullText.length * 2;
  }

  // Chunks array and string elements
  if (doc.chunks) {
    bytes += doc.chunks.length * 48; // Array element & chunk object overhead
    for (const chunk of doc.chunks) {
      if (chunk.text) {
        bytes += chunk.text.length * 2;
      }
    }
  }

  // Chunk embeddings (N vectors x 768 dimensions x 8 bytes Float64)
  if (doc.chunkEmbeddings) {
    for (const vec of doc.chunkEmbeddings) {
      bytes += vec.length * 8 + 32;
    }
  }

  // Clause embeddings (M vectors x 768 dimensions x 8 bytes Float64)
  if (doc.clauseEmbeddings) {
    for (const vec of doc.clauseEmbeddings) {
      bytes += vec.length * 8 + 32;
    }
  }

  // Analysis result text content
  if (doc.analysis) {
    bytes += (doc.analysis.summary?.length ?? 0) * 2 + 128;
    for (const c of doc.analysis.clauses) {
      bytes +=
        (c.plain_language_summary?.length ?? 0) * 2 +
        (c.why_it_matters?.length ?? 0) * 2 +
        (c.section_reference?.length ?? 0) * 2 +
        96;
    }
  }

  // Classification metadata
  if (doc.classification) {
    bytes += 128;
  }

  return bytes;
}

// ── Pluggable DocumentStore Interface ──────────────────────────────────────────

export interface DocumentStore {
  storeDocument(doc: StoredDocument): void;
  getDocument(documentId: string): StoredDocument | undefined;
  deleteDocument(documentId: string): void;
  setClassification(documentId: string, classification: Classification): void;
  setAnalysis(documentId: string, analysis: AnalysisResponse): void;
  setChunkEmbeddings(documentId: string, embeddings: number[][]): void;
  setClauseEmbeddings(documentId: string, embeddings: number[][]): void;
  getMetrics(): { count: number; estimatedBytes: number; maxBytes: number; maxCount: number };
}

// ── In-Memory Implementation with Dual-Constraint LRU ──────────────────────────

export class MemoryDocumentStore implements DocumentStore {
  private readonly store = new Map<string, StoredDocument>();
  private readonly ttlMs: number;
  private readonly maxDocuments: number;
  private readonly maxStoreBytes: number;
  private currentBytes = 0;
  private readonly purgeTimer: NodeJS.Timeout;

  constructor(options?: { ttlMs?: number; maxDocuments?: number; maxStoreBytes?: number }) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    this.maxDocuments = options?.maxDocuments ?? DEFAULT_MAX_DOCUMENTS;
    this.maxStoreBytes =
      options?.maxStoreBytes ?? (Number(process.env["MAX_STORE_BYTES"]) || DEFAULT_MAX_STORE_BYTES);

    this.purgeTimer = setInterval(() => this.purgeExpired(), PURGE_INTERVAL_MS);
    this.purgeTimer.unref();
  }

  public stopTimer(): void {
    clearInterval(this.purgeTimer);
  }

  private evictIfNecessary(): void {
    // Evict least-recently-used documents until BOTH count and byte budget are satisfied
    while (
      (this.store.size > this.maxDocuments || this.currentBytes > this.maxStoreBytes) &&
      this.store.size > 0
    ) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) break;

      const evicted = this.store.get(oldestKey);
      if (evicted) {
        this.currentBytes = Math.max(0, this.currentBytes - estimateDocBytes(evicted));
      }
      this.store.delete(oldestKey);
    }
  }

  public purgeExpired(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, doc] of this.store.entries()) {
      if (new Date(doc.ingestedAt).getTime() < cutoff) {
        this.currentBytes = Math.max(0, this.currentBytes - estimateDocBytes(doc));
        this.store.delete(id);
      }
    }
  }

  public storeDocument(doc: StoredDocument): void {
    // If replacing an existing key, subtract its previous footprint
    const existing = this.store.get(doc.documentId);
    if (existing) {
      this.currentBytes = Math.max(0, this.currentBytes - estimateDocBytes(existing));
      this.store.delete(doc.documentId);
    }

    const docSize = estimateDocBytes(doc);
    this.currentBytes += docSize;
    this.store.set(doc.documentId, doc);

    this.evictIfNecessary();
  }

  public getDocument(documentId: string): StoredDocument | undefined {
    const doc = this.store.get(documentId);
    if (!doc) return undefined;

    // Lazy expiry check on read
    if (new Date(doc.ingestedAt).getTime() < Date.now() - this.ttlMs) {
      this.currentBytes = Math.max(0, this.currentBytes - estimateDocBytes(doc));
      this.store.delete(documentId);
      return undefined;
    }

    // Refresh LRU recency
    this.store.delete(documentId);
    this.store.set(documentId, doc);

    return doc;
  }

  public deleteDocument(documentId: string): void {
    const doc = this.store.get(documentId);
    if (doc) {
      this.currentBytes = Math.max(0, this.currentBytes - estimateDocBytes(doc));
      this.store.delete(documentId);
    }
  }

  public setClassification(documentId: string, classification: Classification): void {
    const doc = this.store.get(documentId);
    if (doc) {
      const prevSize = estimateDocBytes(doc);
      doc.classification = classification;
      const newSize = estimateDocBytes(doc);
      this.currentBytes = Math.max(0, this.currentBytes - prevSize + newSize);
      this.evictIfNecessary();
    }
  }

  public setAnalysis(documentId: string, analysis: AnalysisResponse): void {
    const doc = this.store.get(documentId);
    if (doc) {
      const prevSize = estimateDocBytes(doc);
      doc.analysis = analysis;
      const newSize = estimateDocBytes(doc);
      this.currentBytes = Math.max(0, this.currentBytes - prevSize + newSize);
      this.evictIfNecessary();
    }
  }

  public setChunkEmbeddings(documentId: string, embeddings: number[][]): void {
    const doc = this.store.get(documentId);
    if (doc) {
      const prevSize = estimateDocBytes(doc);
      doc.chunkEmbeddings = embeddings;
      const newSize = estimateDocBytes(doc);
      this.currentBytes = Math.max(0, this.currentBytes - prevSize + newSize);
      this.evictIfNecessary();
    }
  }

  public setClauseEmbeddings(documentId: string, embeddings: number[][]): void {
    const doc = this.store.get(documentId);
    if (doc) {
      const prevSize = estimateDocBytes(doc);
      doc.clauseEmbeddings = embeddings;
      const newSize = estimateDocBytes(doc);
      this.currentBytes = Math.max(0, this.currentBytes - prevSize + newSize);
      this.evictIfNecessary();
    }
  }

  public getMetrics(): {
    count: number;
    estimatedBytes: number;
    maxBytes: number;
    maxCount: number;
  } {
    return {
      count: this.store.size,
      estimatedBytes: this.currentBytes,
      maxBytes: this.maxStoreBytes,
      maxCount: this.maxDocuments,
    };
  }

  public size(): number {
    return this.store.size;
  }

  public estimatedBytes(): number {
    return this.currentBytes;
  }
}

// ── Global Singleton Instance & Backward-Compatible Functions ─────────────────

const defaultStore = new MemoryDocumentStore();

export function storeDocument(doc: StoredDocument): void {
  defaultStore.storeDocument(doc);
}

export function getDocument(documentId: string): StoredDocument | undefined {
  return defaultStore.getDocument(documentId);
}

export function deleteDocument(documentId: string): void {
  defaultStore.deleteDocument(documentId);
}

export function setClassification(documentId: string, classification: Classification): void {
  defaultStore.setClassification(documentId, classification);
}

export function setAnalysis(documentId: string, analysis: AnalysisResponse): void {
  defaultStore.setAnalysis(documentId, analysis);
}

export function setChunkEmbeddings(documentId: string, embeddings: number[][]): void {
  defaultStore.setChunkEmbeddings(documentId, embeddings);
}

export function setClauseEmbeddings(documentId: string, embeddings: number[][]): void {
  defaultStore.setClauseEmbeddings(documentId, embeddings);
}

export function getStoreMetrics(): {
  count: number;
  estimatedBytes: number;
  maxBytes: number;
  maxCount: number;
} {
  return defaultStore.getMetrics();
}

/** Exposed for tests and internal assertions. */
export function _storeSize(): number {
  return defaultStore.size();
}

export function _storeEstimatedBytes(): number {
  return defaultStore.estimatedBytes();
}
