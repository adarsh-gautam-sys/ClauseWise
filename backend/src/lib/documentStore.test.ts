import { describe, it, expect, beforeEach } from "vitest";
import {
  storeDocument,
  getDocument,
  deleteDocument,
  setClassification,
  _storeSize,
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
});
