/**
 * Server-side plain-text extraction for PDF, DOCX, and TXT files.
 *
 * AGENTS.md rule: extracted text must never be written to disk or logged.
 * All extraction operates on the in-memory Buffer from multer's memoryStorage.
 *
 * A corrupted or unreadable file throws an AppError with status 422 so the
 * route handler can forward it to the centralized error middleware.
 *
 * pdf-parse API (v2+):
 *   new PDFParse({ data: buffer }) then .getText() → { text: string }
 *
 * mammoth API:
 *   mammoth.extractRawText({ buffer }) → { value: string }
 */

import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

// ── Supported MIME types ──────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

// ── Typed application error ───────────────────────────────────────────────────

/**
 * A structured error that carries an HTTP status for the centralized
 * error middleware.
 * Uses regular property assignment instead of parameter-property syntax
 * to remain compatible with `erasableSyntaxOnly: true`.
 */
export class AppError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

// ── Internal types for pdf-parse v2 ──────────────────────────────────────────

interface PdfTextResult {
  text: string;
}

interface PdfParseInstance {
  getText(): Promise<PdfTextResult>;
}

// Cast constructor — @types/pdf-parse targets the older v1 API.
type PdfParseConstructor = new (options: { data: Buffer }) => PdfParseInstance;
const PDFParseClass = PDFParse as unknown as PdfParseConstructor;

// ── Extraction ────────────────────────────────────────────────────────────────

/**
 * Extract UTF-8 plain text from a file buffer.
 *
 * @param buffer   Raw file bytes from multer memoryStorage.
 * @param mimeType Validated MIME type.
 * @returns        Trimmed plain-text string.
 * @throws         AppError(422) if the file is corrupted or unreadable.
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === "application/pdf") {
      const parser = new PDFParseClass({ data: buffer });
      const result = await parser.getText();
      const text = result.text.trim();
      if (!text) {
        throw new AppError(
          422,
          "The PDF contains no extractable text (it may be image-only or encrypted).",
        );
      }
      return text;
    }

    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (!text) {
        throw new AppError(422, "The DOCX contains no extractable text.");
      }
      return text;
    }

    if (mimeType === "text/plain") {
      const text = buffer.toString("utf-8").trim();
      if (!text) {
        throw new AppError(422, "The uploaded text file is empty.");
      }
      return text;
    }

    // Unreachable after MIME validation, but keeps TS exhaustiveness happy.
    throw new AppError(400, "Unsupported file type.");
  } catch (err) {
    // Re-throw our own errors unchanged.
    if (err instanceof AppError) throw err;
    // Wrap parsing library errors as 422 — corrupted or unreadable file.
    throw new AppError(
      422,
      "Could not read the file. It may be corrupted, password-protected, or in an unexpected format.",
    );
  }
}
