import { describe, it, expect, beforeEach } from "vitest";
import {
  storeDocument,
  getDocument,
  deleteDocument,
  setClassification,
  _storeSize,
  MemoryDocumentStore,
  estimateDocBytes,
} from "./documentStore.js";

describe("documentStore", () => {
  const sampleDoc = {
    documentId: "test-doc-123",
    fullText: "This is sample agreement text.",
    chunks: [{ index: 0, text: "This is sample agreement text." }],
    ingestedAt: new Date().toISOString(),
    charCount: 30,
  };

  beforeEach(() => {
    deleteDocument("test-doc-123");
  });

  it("stores and retrieves a document", () => {
    storeDocument(sampleDoc);
    const retrieved = getDocument("test-doc-123");
    expect(retrieved).toBeDefined();
    expect(retrieved?.documentId).toBe("test-doc-123");
    expect(retrieved?.fullText).toBe("This is sample agreement text.");
  });

  it("attaches classification to an existing document", () => {
    storeDocument(sampleDoc);
    setClassification("test-doc-123", {
      document_type: "nda",
      confidence: "high",
    });

    const retrieved = getDocument("test-doc-123");
    expect(retrieved?.classification).toEqual({
      document_type: "nda",
      confidence: "high",
    });
  });

  it("returns undefined for non-existent document", () => {
    const doc = getDocument("non-existent");
    expect(doc).toBeUndefined();
  });

  it("removes document when deleted", () => {
    storeDocument(sampleDoc);
    deleteDocument("test-doc-123");
    expect(getDocument("test-doc-123")).toBeUndefined();
  });

  it("expires old documents on access", () => {
    const expiredDoc = {
      ...sampleDoc,
      documentId: "expired-doc",
      ingestedAt: new Date(Date.now() - 31 * 60 * 1_000).toISOString(),
    };
    storeDocument(expiredDoc);
    const retrieved = getDocument("expired-doc");
    expect(retrieved).toBeUndefined();
  });

  it("enforces LRU capacity bound and evicts oldest items when exceeding limit", () => {
    for (let i = 0; i < 105; i++) {
      storeDocument({
        ...sampleDoc,
        documentId: `lru-doc-${i}`,
      });
    }
    // Maximum store size must not exceed 100
    expect(_storeSize()).toBeLessThanOrEqual(100);
    // Oldest document (lru-doc-0) should have been evicted
    expect(getDocument("lru-doc-0")).toBeUndefined();
    // Most recent document (lru-doc-104) should still exist
    expect(getDocument("lru-doc-104")).toBeDefined();
  });

  it("enforces byte-budget LRU eviction when memory exceeds limit even with few documents", () => {
    // Single document size with 1000-char text is ~2.4KB
    const doc1 = {
      ...sampleDoc,
      documentId: "heavy-doc-1",
      fullText: "A".repeat(1000),
    };
    const estimated = estimateDocBytes(doc1);
    expect(estimated).toBeGreaterThan(2000);

    // Create an isolated store instance with a tight 3.5 KB budget (fits 1 doc, evicts on 2nd)
    const store = new MemoryDocumentStore({
      maxDocuments: 50,
      maxStoreBytes: 3500,
    });

    try {
      store.storeDocument(doc1);
      expect(store.getDocument("heavy-doc-1")).toBeDefined();
      expect(store.size()).toBe(1);

      const doc2 = {
        ...sampleDoc,
        documentId: "heavy-doc-2",
        fullText: "B".repeat(1000),
      };

      store.storeDocument(doc2);

      // Total bytes of 2 heavy docs (~5KB) exceeds 3.5KB budget:
      // Oldest doc1 must be evicted to prevent memory pressure
      expect(store.size()).toBe(1);
      expect(store.getDocument("heavy-doc-1")).toBeUndefined();
      expect(store.getDocument("heavy-doc-2")).toBeDefined();

      const metrics = store.getMetrics();
      expect(metrics.count).toBe(1);
      expect(metrics.estimatedBytes).toBeLessThanOrEqual(3500);
    } finally {
      store.stopTimer();
    }
  });

  it("accurately factors dense embedding vectors into byte estimation", () => {
    // 1 vector with 768 dimensions * 8 bytes = 6144 bytes
    const docWithVectors = {
      ...sampleDoc,
      chunkEmbeddings: [new Array(768).fill(0.1)],
    };
    const baseBytes = estimateDocBytes(sampleDoc);
    const vectorBytes = estimateDocBytes(docWithVectors);

    expect(vectorBytes - baseBytes).toBeGreaterThanOrEqual(6144);
  });
});
