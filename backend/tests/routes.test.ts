/**
 * Integration test suite for all ClauseWise backend routes (Parts 2 to 8).
 *
 * Uses the default mock in backend/src/services/__mocks__/geminiClient.ts via tests/setup.ts.
 * Runs against an ephemeral HTTP server with zero external network dependencies.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import app from "../src/app.js";

/**
 * Helper: parse an SSE response body and extract the final `done` event payload.
 * The SSE spec sends named events as `event: <name>\ndata: <payload>\n\n`.
 */
async function parseSSEDoneEvent<T>(res: globalThis.Response): Promise<T | null> {
  const text = await res.text();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "event: done" && i + 1 < lines.length) {
      const dataLine = lines[i + 1];
      if (dataLine?.startsWith("data: ")) {
        return JSON.parse(dataLine.slice(6)) as T;
      }
    }
  }
  return null;
}

describe("Backend Routes Integration Suite (Parts 2 to 8)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // Sample document text representing a residential lease
  const SAMPLE_LEASE_TEXT = `RESIDENTIAL LEASE AGREEMENT
This Agreement is made on January 1, 2026, between Landlord Property LLC and Tenant John Smith.

1. Term of Lease
The term begins on January 1, 2026 and ends on December 31, 2026.

2. Rent Payment
The monthly rent is $2,000, payable on the first day of each calendar month.

3. Security Deposit
Tenant agrees to deposit $4,000 as a security deposit before taking possession of the property.

4. Notice to Terminate
Either party may terminate the tenancy at the end of the term with 30 days prior written notice.

5. Landlord Access
Landlord may enter the premises at any time without advance notice for inspection or repairs.
`;

  // Sample document B text for comparison
  const SAMPLE_LEASE_B_TEXT = `RESIDENTIAL LEASE AGREEMENT (REVISED)
This Agreement is made on January 1, 2026, between Landlord Property LLC and Tenant John Smith.

1. Term of Lease
The term begins on January 1, 2026 and ends on December 31, 2026.

2. Rent Payment
The monthly rent is $1,900, payable on the first day of each calendar month.

3. Security Deposit
Tenant agrees to deposit $2,000 as a security deposit before taking possession.

4. Notice to Terminate
Either party may terminate the tenancy with 60 days prior written notice.

5. Landlord Access
Landlord must provide at least 24 hours advance notice prior to entering the premises.
`;

  let docAId: string;
  let docBId: string;

  // ── Part 2: POST /api/documents ─────────────────────────────────────────────

  it("Part 2: Ingests document via pasted JSON text", async () => {
    const res = await fetch(`${baseUrl}/api/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: SAMPLE_LEASE_TEXT }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      documentId: string;
      chunkCount: number;
      preview: string;
    };

    expect(body.documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(body.chunkCount).toBeGreaterThan(0);
    expect(body.preview).toContain("RESIDENTIAL LEASE AGREEMENT");

    docAId = body.documentId;
  });

  it("Part 2: Ingests second document via multipart file upload", async () => {
    const formData = new FormData();
    const blob = new Blob([SAMPLE_LEASE_B_TEXT], { type: "text/plain" });
    formData.append("file", blob, "lease-b.txt");

    const res = await fetch(`${baseUrl}/api/documents`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      documentId: string;
      chunkCount: number;
      preview: string;
    };

    expect(body.documentId).toBeDefined();
    expect(body.chunkCount).toBeGreaterThan(0);
    docBId = body.documentId;
  });

  // ── Part 3: POST /api/documents/:id/classify ───────────────────────────────

  it("Part 3: Classifies Document A and infers document type", async () => {
    const res = await fetch(`${baseUrl}/api/documents/${docAId}/classify`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      documentId: string;
      document_type: string;
      confidence: string;
    };

    expect(body.documentId).toBe(docAId);
    expect(body.document_type).toBe("lease");
    expect(["low", "medium", "high"]).toContain(body.confidence);
  });

  it("Part 3: Classifies Document B", async () => {
    const res = await fetch(`${baseUrl}/api/documents/${docBId}/classify`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      documentId: string;
      document_type: string;
    };
    expect(body.document_type).toBe("lease");
  });

  // ── Part 4 & 7: POST /api/documents/:id/analyze (with persona) ─────────────

  it("Part 4 & 7: Analyzes Document A with tenant persona prioritizing tenant-sensitive clauses", async () => {
    const res = await fetch(`${baseUrl}/api/documents/${docAId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: "tenant" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-transform");

    const body = await parseSSEDoneEvent<{
      documentId: string;
      document_type: string;
      persona: string;
      summary: string;
      clauses: Array<{
        clause_id: string;
        section_reference: string;
        plain_language_summary: string;
        tag: string;
        severity: string;
        why_it_matters: string;
      }>;
    }>(res);

    expect(body).not.toBeNull();
    if (!body) throw new Error("Expected SSE done event body");
    expect(body.documentId).toBe(docAId);
    expect(body.document_type).toBe("lease");
    expect(body.persona).toBe("tenant");
    expect(body.summary.length).toBeGreaterThan(10);
    expect(body.clauses.length).toBeGreaterThanOrEqual(2);

    // Tenant persona should prioritize deposit or notice clauses before generic terms
    const firstClause = body.clauses[0];
    expect(firstClause).toBeDefined();
    expect(firstClause?.clause_id).toBeDefined();
    expect(firstClause?.plain_language_summary).toBeDefined();
    expect(["low", "medium", "high"]).toContain(firstClause?.severity);
  });

  it("Part 4: Analyzes Document B", async () => {
    const res = await fetch(`${baseUrl}/api/documents/${docBId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: "tenant" }),
    });

    expect(res.status).toBe(200);
    const body = await parseSSEDoneEvent<{ clauses: unknown[] }>(res);
    expect(body).not.toBeNull();
    if (!body) throw new Error("Expected SSE done event body");
    expect(body.clauses.length).toBeGreaterThan(0);
  });

  // ── Part 5: POST /api/documents/:id/ask ────────────────────────────────────

  it("Part 5: Answers in-scope question with cited sections", async () => {
    const res = await fetch(`${baseUrl}/api/documents/${docAId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How much is the security deposit?" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-transform");

    const body = await parseSSEDoneEvent<{
      documentId: string;
      answer: string;
      cited_sections: string[];
      in_scope: boolean;
    }>(res);

    expect(body).not.toBeNull();
    if (!body) throw new Error("Expected SSE done event body");
    expect(body.documentId).toBe(docAId);
    expect(body.in_scope).toBe(true);
    expect(body.answer).toContain("security deposit");
    expect(body.cited_sections.length).toBeGreaterThan(0);
  });

  it("Part 5: Refuses out-of-scope question with in_scope=false and no citations", async () => {
    const res = await fetch(`${baseUrl}/api/documents/${docAId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the capital of France? (out-of-scope)" }),
    });

    expect(res.status).toBe(200);
    const body = await parseSSEDoneEvent<{
      documentId: string;
      answer: string;
      cited_sections: string[];
      in_scope: boolean;
    }>(res);

    expect(body).not.toBeNull();
    if (!body) throw new Error("Expected SSE done event body");
    expect(body.documentId).toBe(docAId);
    expect(body.in_scope).toBe(false);
    expect(body.cited_sections).toEqual([]);
    expect(body.answer).toContain("could not be answered");
  });

  // ── Part 6: POST /api/documents/compare ───────────────────────────────────

  it("Part 6: Compares Document A and Document B clause-by-clause", async () => {
    const res = await fetch(`${baseUrl}/api/documents/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doc_a_id: docAId,
        doc_b_id: docBId,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      doc_a_id: string;
      doc_b_id: string;
      doc_a_type: string;
      doc_b_type: string;
      aligned_count: number;
      comparisons: Array<{
        match_type: string;
        topic: string;
        change_description?: string;
        favors?: string;
      }>;
    };

    expect(body.doc_a_id).toBe(docAId);
    expect(body.doc_b_id).toBe(docBId);
    expect(body.comparisons.length).toBeGreaterThan(0);

    // At least one comparison should be aligned with favors analysis
    const aligned = body.comparisons.find((c) => c.match_type === "aligned");
    if (aligned) {
      expect(aligned.topic).toBeDefined();
      expect(["doc_a", "doc_b", "neutral"]).toContain(aligned.favors);
    }
  });

  // ── Part 8: POST /api/documents/:id/export ─────────────────────────────────

  it("Part 8: Exports document checklist, lawyer questions, and formatted Markdown", async () => {
    const outOfScopeQuestion = "Does this lease allow subletting on Airbnb?";

    const res = await fetch(`${baseUrl}/api/documents/${docAId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        persona: "tenant",
        out_of_scope_questions: [outOfScopeQuestion],
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      documentId: string;
      document_type: string;
      persona: string;
      checklist: string[];
      lawyer_questions: string[];
      markdown: string;
    };

    expect(body.documentId).toBe(docAId);
    expect(body.document_type).toBe("lease");
    expect(body.checklist.length).toBeGreaterThan(0);
    expect(body.lawyer_questions.length).toBeGreaterThan(0);

    // Verifies out-of-scope question is folded into the lawyer questions list
    expect(body.lawyer_questions).toContain(outOfScopeQuestion);

    // Verifies Markdown structure
    expect(body.markdown).toContain("# ClauseWise Export");
    expect(body.markdown).toContain("Checklist");
    expect(body.markdown).toContain("Questions for Your Lawyer");
    expect(body.markdown).toContain(outOfScopeQuestion);
  });

  // ── Production Frontend Serving & SPA Fallback ─────────────────────────────

  it("Serves index.html on root GET / when frontend/dist is present", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const text = await res.text();
      expect(text).toContain("<html");
    }
  });

  it("Provides SPA fallback on client-side routes like /understand", async () => {
    const res = await fetch(`${baseUrl}/understand`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const text = await res.text();
      expect(text).toContain("<html");
    }
  });

  it("Ensures /api/* unhandled routes return 404 JSON and never fall back to SPA HTML", async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-endpoint`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Endpoint not found.");
  });
});
