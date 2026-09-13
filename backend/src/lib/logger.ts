/**
 * Request-scoped logger for ClauseWise backend.
 *
 * AGENTS.md rule: never log document text or user question content.
 * We enforce this structurally: the only accepted fields are a fixed set
 * of primitive request/response metadata. There is no free-form "extra"
 * or "data" escape hatch.
 */

/** The closed set of fields that may be logged. */
export interface RequestLogEntry {
  /** HTTP method, e.g. "GET" */
  method: string;
  /** Request path, e.g. "/api/health" */
  path: string;
  /** HTTP status code */
  status: number;
  /** Round-trip latency in milliseconds */
  latencyMs: number;
  /** Optional stable request ID for correlation (never document content) */
  requestId?: string;
}

function formatEntry(entry: RequestLogEntry): string {
  const parts: string[] = [
    new Date().toISOString(),
    entry.method.toUpperCase().padEnd(6),
    entry.path,
    String(entry.status),
    `${entry.latencyMs}ms`,
  ];
  if (entry.requestId !== undefined) {
    parts.push(`rid=${entry.requestId}`);
  }
  return parts.join(" ");
}

export const logger = {
  /**
   * Log a completed HTTP request.
   * Only call this after the response has been sent so `status` is final.
   */
  request(entry: RequestLogEntry): void {
    // Route to stderr for status >= 500, stdout otherwise.
    if (entry.status >= 500) {
      process.stderr.write(formatEntry(entry) + "\n");
    } else {
      process.stdout.write(formatEntry(entry) + "\n");
    }
  },

  /** Log a plain informational message (startup banners, etc.). */
  info(message: string): void {
    process.stdout.write(`${new Date().toISOString()} INFO  ${message}\n`);
  },

  /** Log an error message without exposing a stack trace externally. */
  error(message: string, err?: unknown): void {
    const detail =
      err instanceof Error ? ` — ${err.message}` : err != null ? ` — ${String(err)}` : "";
    process.stderr.write(`${new Date().toISOString()} ERROR ${message}${detail}\n`);
  },
};
