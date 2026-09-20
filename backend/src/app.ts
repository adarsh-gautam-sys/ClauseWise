/**
 * Express application factory.
 *
 * app.ts configures middleware and routes only — it does NOT bind a port.
 * server.ts is the entrypoint that calls app.listen().
 * This separation makes the app importable in unit tests without side-effects.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { logger } from "./lib/logger.js";
import { documentsRouter } from "./routes/documents.js";
import { AppError } from "./lib/textExtractor.js";

// ── CORS ──────────────────────────────────────────────────────────────────────

/**
 * Only allow requests from the Vite dev server in development.
 * The production origin should be set via the FRONTEND_ORIGIN env var.
 */
const allowedOrigin = process.env["FRONTEND_ORIGIN"] ?? "http://localhost:5173";

// ── App construction ──────────────────────────────────────────────────────────

const app = express();

// CORS — restricted to frontend's dev origin
app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    optionsSuccessStatus: 200,
  }),
);

// JSON body parsing — 2 MB limit to accommodate up to 150 000 character pasted text
app.use(express.json({ limit: "2mb" }));

// ── Request logging middleware ────────────────────────────────────────────────

app.use((req: Request, res: Response, next: NextFunction) => {
  const startMs = Date.now();

  res.on("finish", () => {
    logger.request({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs: Date.now() - startMs,
    });
  });

  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/api/documents", documentsRouter);

// ── 404 handler for unknown routes ────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found." });
});

// ── Centralized error handler ─────────────────────────────────────────────────

/**
 * Catches any error passed via next(err).
 * Never leaks stack traces or internal messages to the client per AGENTS.md.
 */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // AppErrors carry a user-safe message — surface it directly.
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error("AppError 5xx", err);
    res.status(err.status).json({ error: err.message });
    return;
  }

  // Handle standard HTTP client errors (e.g. malformed JSON or payload too large from body-parser)
  if (err != null && typeof err === "object") {
    const errorObj = err as { status?: unknown; statusCode?: unknown };
    const status =
      typeof errorObj.status === "number"
        ? errorObj.status
        : typeof errorObj.statusCode === "number"
          ? errorObj.statusCode
          : undefined;

    if (status !== undefined && status >= 400 && status < 500) {
      const message =
        status === 400
          ? "Malformed JSON in request body."
          : status === 413
            ? "Request payload exceeds size limit."
            : "Bad request.";
      res.status(status).json({ error: message });
      return;
    }
  }

  logger.error("Unhandled error", err);

  // Unknown errors: never leak internals to the client.
  res.status(500).json({ error: "An unexpected error occurred. Please try again." });
});

export default app;
