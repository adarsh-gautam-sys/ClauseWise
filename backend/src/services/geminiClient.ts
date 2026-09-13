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

const GENERATION_MODEL = "gemini-2.0-flash";
const EMBEDDING_MODEL = "text-embedding-004";

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
export async function generateStructured(prompt: string, schema: z.ZodType): Promise<string> {
  // Zod v4 ships toJSONSchema() natively — no external package required.
  const jsonSchema = z.toJSONSchema(schema);

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
    throw new Error("Gemini returned an empty response for generateStructured");
  }
  return text;
}

/**
 * Produce a dense embedding vector for the given text.
 *
 * @param text  The text to embed (document excerpt, clause, query, etc.).
 * @returns     Float array representing the embedding.
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [{ role: "user", parts: [{ text }] }],
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini returned an empty embedding");
  }
  return values;
}
