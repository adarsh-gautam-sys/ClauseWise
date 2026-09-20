/**
 * api.ts — typed fetch wrappers for all ClauseWise backend endpoints.
 *
 * Rules:
 * - One function per endpoint, return type matches backend response exactly.
 * - Throws an Error with a user-readable message on any non-2xx status.
 * - Never logs or stores document text (AGENTS.md).
 */

import type {
  UploadResult,
  ClassifyResult,
  AnalysisResult,
  AskResult,
  CompareResult,
  ExportResult,
} from "@/types";

const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ??
  "http://localhost:3001";

/** Extract a readable error message from an API error body. */
async function extractError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body["error"] === "string") return body["error"];
  } catch {
    // Ignore JSON parse errors on error bodies
  }
  return `Request failed (HTTP ${res.status}).`;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_BASE}/api/documents`, {
    method: "POST",
    body,
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json() as Promise<UploadResult>;
}

export async function uploadText(text: string): Promise<UploadResult> {
  const res = await fetch(`${API_BASE}/api/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json() as Promise<UploadResult>;
}

// ── Classify ──────────────────────────────────────────────────────────────────

export async function classifyDocument(
  documentId: string,
  signal?: AbortSignal,
): Promise<ClassifyResult> {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}/classify`, {
    method: "POST",
    signal,
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json() as Promise<ClassifyResult>;
}

// ── Analyze ───────────────────────────────────────────────────────────────────

export async function analyzeDocument(
  documentId: string,
  persona: string,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona }),
    signal,
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json() as Promise<AnalysisResult>;
}

// ── Ask ───────────────────────────────────────────────────────────────────────

export async function askQuestion(
  documentId: string,
  question: string,
  signal?: AbortSignal,
): Promise<AskResult> {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json() as Promise<AskResult>;
}

// ── Compare ───────────────────────────────────────────────────────────────────

export async function compareDocuments(
  docAId: string,
  docBId: string,
  signal?: AbortSignal,
): Promise<CompareResult> {
  const res = await fetch(`${API_BASE}/api/documents/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_a_id: docAId, doc_b_id: docBId }),
    signal,
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json() as Promise<CompareResult>;
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportDocument(
  documentId: string,
  persona: string,
  outOfScopeQuestions: string[],
  signal?: AbortSignal,
): Promise<ExportResult> {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona, out_of_scope_questions: outOfScopeQuestions }),
    signal,
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json() as Promise<ExportResult>;
}
