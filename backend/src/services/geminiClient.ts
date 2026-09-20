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

const GENERATION_MODEL = "gemini-3.6-flash";
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
// ── API error normaliser ──────────────────────────────────────────────────────

/**
 * Convert a Gemini SDK error to an AppError with a meaningful HTTP status.
 * Raw Gemini errors carry a numeric `code` (gRPC) mapped to HTTP statuses:
 *   429  → too many requests / quota exhausted  → 429
 *   503  → service unavailable                  → 503
 *   400  → bad request (schema, invalid model)  → 502 (upstream bad response)
 *   404  → model not found                      → 502
 *   default                                     → 502
 */
function normaliseGeminiError(err: unknown): AppError {
  if (err != null && typeof err === "object" && "error" in err) {
    const inner = (err as { error: unknown }).error;
    if (inner != null && typeof inner === "object" && "code" in inner) {
      const code = (inner as { code: number }).code;
      const msg = "message" in inner ? String((inner as { message: unknown }).message) : "";

      if (code === 429 || code === 402) {
        // Quota exhausted — surface to user so they can retry later.
        return new AppError(429, "AI service quota exhausted. Please try again in a few moments.");
      }
      if (code === 503) {
        return new AppError(503, "AI service temporarily unavailable. Please try again shortly.");
      }
      // Log non-quota upstream errors at error level without exposing internals.
      logger.error("Gemini upstream error", msg);
    }
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

  try {
    const response = await genai.models.generateContent({
      model: GENERATION_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: jsonSchema,
      },
    });

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
 * Produce a dense embedding vector for the given text.
 *
 * @param text  The text to embed (document excerpt, clause, query, etc.).
 * @returns     Float array representing the embedding.
 */
export async function embedText(text: string): Promise<number[]> {
  try {
    const response = await genai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [{ role: "user", parts: [{ text }] }],
    });

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
