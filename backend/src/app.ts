/**
 * Express application factory.
 *
 * app.ts configures middleware and routes only — it does NOT bind a port.
 * server.ts is the entrypoint that calls app.listen().
 * This separation makes the app importable in unit tests without side-effects.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import path from "node:path";
import fs from "node:fs";
import { logger } from "./lib/logger.js";
import { documentsRouter } from "./routes/documents.js";
import { AppError } from "./lib/textExtractor.js";

// ── CORS ──────────────────────────────────────────────────────────────────────

/**
 * Only allow requests from the Vite dev server in development.
 * The production origin should be set via the FRONTEND_ORIGIN env var.
 *
 * Cloud Run single-service note (defense in depth):
 * When frontend and backend share one Cloud Run service, browser requests
 * are same-origin and do not strictly require CORS headers. However, this
 * restriction is retained as defense in depth against unauthorized cross-origin
 * requests from third-party sites, and ensures smooth operation in split
 * local-development environments where Vite runs on port 5173.
 */
const allowedOrigin = process.env["FRONTEND_ORIGIN"] ?? "http://localhost:5173";

// ── App construction ──────────────────────────────────────────────────────────

const app = express();

// Trust reverse proxy hops (e.g. Google Frontend on Cloud Run)
app.set("trust proxy", 1);

// HTTP payload compression (gzip/deflate) — reduces wire transfer sizes by ~75%
app.use(compression());

// CORS — restricted to frontend's dev origin (defense in depth in production)
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

// ── API 404 Handler ───────────────────────────────────────────────────────────
// All unhandled routes under /api return 404 JSON and never fall through to SPA fallback.
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found." });
});

// ── Frontend Static Serving & SPA Fallback ────────────────────────────────────

/**
 * Resolve the directory containing the built frontend assets (frontend/dist).
 * Checks FRONTEND_DIST_PATH, monorepo relative paths, and container layout.
 */
function resolveFrontendDistPath(): string | null {
  const candidates = [
    process.env["FRONTEND_DIST_PATH"],
    path.resolve(import.meta.dirname, "../../frontend/dist"),
    path.resolve(import.meta.dirname, "../frontend/dist"),
    path.resolve(process.cwd(), "frontend/dist"),
    path.resolve(process.cwd(), "../frontend/dist"),
    path.resolve(process.cwd(), "public"),
    path.resolve(import.meta.dirname, "./public"),
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      fs.existsSync(candidate) &&
      fs.existsSync(path.join(candidate, "index.html"))
    ) {
      return candidate;
    }
  }

  return null;
}

const frontendDistPath = resolveFrontendDistPath();

if (frontendDistPath) {
  const indexHtmlPath = path.join(frontendDistPath, "index.html");

  // Serve static assets from frontend/dist with HTTP caching headers
  app.use(
    express.static(frontendDistPath, {
      maxAge: "1d",
      setHeaders: (res, filePath) => {
        // Hashed assets in /assets/ can be cached immutably for 1 year
        if (filePath.includes("assets")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith(".html")) {
          // HTML files must never be cached so users always get the latest bundle hash
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  // SPA fallback for all client-side navigation GET routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexHtmlPath);
    } else {
      next();
    }
  });
}

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
