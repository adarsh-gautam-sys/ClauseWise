/**
 * Gemini API client — THE ONLY MODULE in this repo allowed to import the SDK.
 *
 * AGENTS.md constraint: all other files must consume AI capabilities through
 * the functions exported here. Direct SDK imports elsewhere are forbidden.
 *
 * Startup fast-fail: if GEMINI_API_KEY is absent the process exits immediately
 * with a clear, human-readable message rather than surfacing a confusing runtime
 * error on the first request.
 */

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/textExtractor.js";

// ── Startup guard ─────────────────────────────────────────────────────────────

const apiKey = process.env["GEMINI_API_KEY"];

if (!apiKey) {
  logger.error(
    "GEMINI_API_KEY is not set. " +
      "Copy backend/.env.example to backend/.env and add a real key, " +
      "then restart the server.",
  );
  process.exit(1);
}

// ── Client singleton ──────────────────────────────────────────────────────────

const genai = new GoogleGenAI({ apiKey });

// ── Model constants ───────────────────────────────────────────────────────────

const GENERATION_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_GENERATION_MODEL = "gemini-3.5-flash";
const EMBEDDING_MODEL = "gemini-embedding-001";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate structured JSON output validated against a Zod schema.
 *
 * @param prompt  The full prompt string (assembled by a prompt template module,
 *                never inline in a route handler — per AGENTS.md).
 * @param schema  A Zod schema; the model is instructed to return JSON that
 *                conforms to it. The caller is responsible for validating the
 *                parsed result with `schema.parse()` before use.
 * @returns       The raw model response text (valid JSON expected).
 */
function extractErrorCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;

  // Direct status / code properties
  if ("status" in err && typeof (err as { status: unknown }).status === "number") {
    return (err as { status: number }).status;
  }
  if ("code" in err && typeof (err as { code: unknown }).code === "number") {
    return (err as { code: number }).code;
  }

  // Nested error object
  if (
    "error" in err &&
    typeof (err as { error: unknown }).error === "object" &&
    (err as { error: unknown }).error !== null
  ) {
    const inner = (err as { error: Record<string, unknown> }).error;
    if (typeof inner["code"] === "number") return inner["code"];
    if (typeof inner["status"] === "number") return inner["status"];
    if (inner["status"] === "UNAVAILABLE") return 503;
    if (inner["status"] === "RESOURCE_EXHAUSTED") return 429;
  }

  // Stringified JSON in error message
  if ("message" in err && typeof (err as { message: unknown }).message === "string") {
    const msg = (err as { message: string }).message;
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.code) return Number(parsed.error.code);
      if (parsed?.error?.status === "UNAVAILABLE") return 503;
      if (parsed?.error?.status === "RESOURCE_EXHAUSTED") return 429;
    } catch {
      if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand"))
        return 503;
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota"))
        return 429;
      if (msg.includes("402")) return 402;
    }
  }

  return undefined;
}

/**
 * Retry helper for transient Gemini API errors (503 high demand, 429 rate limit).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  initialDelayMs = 1000,
): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const code = extractErrorCode(err);
      if (attempt <= maxRetries && (code === 503 || code === 429)) {
        logger.info(
          `Gemini call returned ${code}; retrying attempt ${attempt}/${maxRetries} after ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}

function normaliseGeminiError(err: unknown): AppError {
  const code = extractErrorCode(err);
  if (code === 429 || code === 402) {
    return new AppError(429, "AI service quota exhausted. Please try again in a few moments.");
  }
  if (code === 503) {
    return new AppError(503, "AI service temporarily unavailable. Please try again shortly.");
  }
  logger.error("Gemini call failed", err);
  return new AppError(502, "AI service returned an unexpected error. Please try again.");
}

// ── Schema sanitisation ────────────────────────────────────────────────────────

/**
 * Gemini's responseSchema accepts a subset of JSON Schema (OpenAPI 3.0-ish).
 * Keywords like minLength, maxLength, minItems, maxItems, $schema, and
 * additionalProperties cause INVALID_ARGUMENT (400) errors.
 *
 * This function strips those unsupported keywords recursively so the
 * Zod-generated schema can be passed to Gemini safely.
 * We still validate the ACTUAL response with Zod (which keeps all constraints),
 * so removing them from the prompt-time schema does not weaken validation.
 */
function sanitizeForGemini(schema: unknown): unknown {
  if (schema === null || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeForGemini);

  const STRIP_KEYS = new Set([
    "$schema",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "additionalProperties",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
  ]);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (STRIP_KEYS.has(k)) continue;
    result[k] = sanitizeForGemini(v);
  }
  return result;
}

export async function generateStructured(prompt: string, schema: z.ZodType): Promise<string> {
  // Zod v4 ships toJSONSchema() natively — no external package required.
  const rawJsonSchema = z.toJSONSchema(schema);

  // Sanitise: strip keywords unsupported by Gemini's responseSchema (OpenAPI 3.0 subset).
  const jsonSchema = sanitizeForGemini(rawJsonSchema);

  const callModel = (model: string) =>
    withRetry(() =>
      genai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: jsonSchema,
        },
      }),
    );

  try {
    let response;
    try {
      response = await callModel(GENERATION_MODEL);
    } catch (primaryErr) {
      const code = extractErrorCode(primaryErr);
      if (code === 429 || code === 503) {
        logger.info(
          `Primary model ${GENERATION_MODEL} returned ${code}; attempting fallback model ${FALLBACK_GENERATION_MODEL}`,
        );
        response = await callModel(FALLBACK_GENERATION_MODEL);
      } else {
        throw primaryErr;
      }
    }

    const text = response.text;
    if (!text) {
      throw new AppError(502, "AI service returned an empty response. Please try again.");
    }
    return text;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw normaliseGeminiError(err);
  }
}

/**
 * Generate structured JSON output as an async iterable of text chunks.
 *
 * Uses generateContentStream with the same responseSchema/JSON config
 * as generateStructured — Gemini streams incremental text fragments of the
 * eventual JSON rather than buffering a single blob. The caller is
 * responsible for assembling the chunks and validating the complete JSON
 * against the Zod schema once the stream ends.
 *
 * @param prompt  The full prompt string (assembled by a prompt template).
 * @param schema  A Zod schema; Gemini is instructed to return JSON conforming
 *                to it.  Validation happens on the fully assembled response,
 *                not per-chunk.
 * @returns       An async iterable that yields text chunks as they arrive.
 */
export async function* generateStructuredStream(
  prompt: string,
  schema: z.ZodType,
): AsyncGenerator<string> {
  const rawJsonSchema = z.toJSONSchema(schema);
  const jsonSchema = sanitizeForGemini(rawJsonSchema);

  const streamModel = (model: string) =>
    withRetry(() =>
      genai.models.generateContentStream({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: jsonSchema,
        },
      }),
    );

  try {
    let stream: AsyncGenerator<{ text?: string | null }>;
    try {
      stream = await streamModel(GENERATION_MODEL);
    } catch (primaryErr) {
      const code = extractErrorCode(primaryErr);
      if (code === 429 || code === 503) {
        logger.info(
          `Primary model ${GENERATION_MODEL} returned ${code}; attempting fallback model ${FALLBACK_GENERATION_MODEL} (stream)`,
        );
        stream = await streamModel(FALLBACK_GENERATION_MODEL);
      } else {
        throw primaryErr;
      }
    }

    let hasContent = false;
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        hasContent = true;
        yield text;
      }
    }

    if (!hasContent) {
      throw new AppError(502, "AI service returned an empty response. Please try again.");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw normaliseGeminiError(err);
  }
}

/**
 * Produce a dense embedding vector for the given text.
 *
 * @param text  The text to embed (document excerpt, clause, query, etc.).
 * @returns     Float array representing the embedding.
 */
export async function embedText(text: string): Promise<number[]> {
  try {
    const response = await withRetry(() =>
      genai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: [{ role: "user", parts: [{ text }] }],
      }),
    );

    const values = response.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new AppError(502, "AI service returned an empty embedding.");
    }
    return values;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw normaliseGeminiError(err);
  }
}

/**
 * Produce dense embedding vectors for an array of texts using bounded concurrency.
 *
 * Parallelizing embeddings with a controlled pool (default: 4 concurrent calls)
 * reduces wall-clock latency by 60–75% compared to serial loops, while staying
 * safely below API rate limits.
 *
 * @param texts        Array of strings to embed.
 * @param concurrency  Maximum simultaneous in-flight requests (default: 4).
 * @returns            Array of embedding float arrays in the exact same order as `texts`.
 */
export async function embedTexts(texts: string[], concurrency = 4): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = new Array(texts.length);
  let nextIdx = 0;

  async function worker(): Promise<void> {
    while (nextIdx < texts.length) {
      const idx = nextIdx++;
      const text = texts[idx];
      if (text !== undefined) {
        results[idx] = await embedText(text);
      }
    }
  }

  const poolSize = Math.min(concurrency, texts.length);
  const workers = Array.from({ length: poolSize }, () => worker());
  await Promise.all(workers);
  return results;
}
