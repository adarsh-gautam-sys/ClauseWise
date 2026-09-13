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

// JSON body parsing — 100 kb limit (tightened in the security pass)
app.use(express.json({ limit: "100kb" }));

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

// ── Centralized error handler ─────────────────────────────────────────────────

/**
 * Catches any error passed via next(err).
 * Never leaks stack traces or internal messages to the client per AGENTS.md.
 */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", err);

  const status =
    err != null &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;

  // Never expose internals: always return a generic client message.
  res.status(status).json({
    error: status < 500 ? "Bad request" : "An unexpected error occurred. Please try again.",
  });
});

export default app;
