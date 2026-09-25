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

const API_BASE = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";

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

// ── SSE stream helpers ────────────────────────────────────────────────────────

/**
 * Result of an SSE streaming request.
 * Directly awaitable as a Promise<T>, but also exposes `.result` and `.abort()`.
 * `onChunk` is called with each incremental text chunk for live UI feedback.
 */
export interface StreamResult<T> extends Promise<T> {
  /** Promise that resolves with the full, validated payload once streaming completes. */
  result: Promise<T>;
  /** Abort the underlying fetch request. */
  abort: () => void;
}

export type StreamOptions = {
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
};

/**
 * Consume an SSE endpoint that sends:
 *   data: {"chunk":"..."}\n\n   (incremental text fragments)
 *   event: done\ndata: <full JSON payload>\n\n
 *   event: error\ndata: {"error":"..."}\n\n
 * Also gracefully handles standard application/json responses (e.g. cached responses or test mocks).
 */
function consumeSSE<T>(
  url: string,
  options: RequestInit,
  onChunk?: (chunk: string) => void,
): StreamResult<T> {
  const controller = new AbortController();
  const mergedSignal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  const result = (async (): Promise<T> => {
    const res = await fetch(url, {
      ...options,
      signal: mergedSignal,
    });

    if (!res.ok) throw new Error(await extractError(res));

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("Response body is not readable.");

    const decoder = new TextDecoder();
    let buffer = "";
    let finalPayload: T | null = null;
    let sseError: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages (delimited by \n\n)
      const parts = buffer.split("\n\n");
      // Keep the last (possibly incomplete) part in the buffer
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n");

        // Check for named events (event: done, event: error)
        const eventLine = lines.find((l) => l.startsWith("event: "));
        const dataLine = lines.find((l) => l.startsWith("data: "));
        const dataStr = dataLine?.slice(6);

        if (eventLine === "event: done" && dataStr) {
          finalPayload = JSON.parse(dataStr) as T;
        } else if (eventLine === "event: error" && dataStr) {
          const errBody = JSON.parse(dataStr) as { error: string };
          sseError = errBody.error;
        } else if (dataStr && !eventLine) {
          // Unnamed data event = incremental chunk
          try {
            const chunkData = JSON.parse(dataStr) as { chunk: string };
            if (chunkData.chunk && onChunk) {
              onChunk(chunkData.chunk);
            }
          } catch {
            // Non-JSON data line — skip
          }
        }
      }
    }

    if (sseError) throw new Error(sseError);
    if (!finalPayload) throw new Error("Stream ended without a valid response.");
    return finalPayload;
  })();

  const streamResult = result as unknown as StreamResult<T>;
  streamResult.result = result;
  streamResult.abort = () => controller.abort();
  return streamResult;
}

// ── Analyze ───────────────────────────────────────────────────────────────────

/**
 * Stream-based document analysis.
 * Returns a StreamResult whose `.result` (or awaiting the function directly)
 * resolves with the full AnalysisResult once the server validates and sends the `done` SSE event.
 *
 * @param options  Optional AbortSignal or StreamOptions with onChunk callback.
 */
export function analyzeDocument(
  documentId: string,
  persona: string,
  options?: AbortSignal | StreamOptions,
): StreamResult<AnalysisResult> {
  const opts: StreamOptions =
    options instanceof AbortSignal ? { signal: options } : (options ?? {});
  return consumeSSE<AnalysisResult>(
    `${API_BASE}/api/documents/${documentId}/analyze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona }),
      signal: opts.signal,
    },
    opts.onChunk,
  );
}

// ── Ask ───────────────────────────────────────────────────────────────────────

/**
 * Stream-based Q&A.
 * Returns a StreamResult whose `.result` (or awaiting the function directly)
 * resolves with the full AskResult once the server validates and sends the `done` SSE event.
 *
 * @param options  Optional AbortSignal or StreamOptions with onChunk callback.
 */
export function askQuestion(
  documentId: string,
  question: string,
  options?: AbortSignal | StreamOptions,
): StreamResult<AskResult> {
  const opts: StreamOptions =
    options instanceof AbortSignal ? { signal: options } : (options ?? {});
  return consumeSSE<AskResult>(
    `${API_BASE}/api/documents/${documentId}/ask`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal: opts.signal,
    },
    opts.onChunk,
  );
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
