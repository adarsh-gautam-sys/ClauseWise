/**
 * POST /api/documents — document ingestion endpoint.
 *
 * Accepts either:
 *   a) a multipart file upload (PDF, DOCX, TXT, max 5 MB), or
 *   b) a JSON body with a `text` field (raw pasted content).
 *
 * Not both. Sends 400 if both or neither are provided.
 *
 * AGENTS.md rules enforced here:
 *   - No extracted text or user content is written to disk or logged.
 *   - Rate-limited to protect against abuse.
 *   - All errors go through next(err) → centralized error middleware.
 *   - No Gemini SDK import — AI features added later via geminiClient.ts.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import { ALLOWED_MIME_TYPES, AppError, extractText } from "../lib/textExtractor.js";
import { chunkText, previewText } from "../lib/chunker.js";
import { storeDocument, getDocument, setClassification } from "../lib/documentStore.js";
import { generateStructured } from "../services/geminiClient.js";
import { buildClassifyPrompt, classificationSchema } from "../prompts/classify.js";

export const documentsRouter = Router();

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum file upload size in bytes (5 MB). */
const MAX_FILE_BYTES = 5 * 1_024 * 1_024;

/**
 * Maximum pasted-text length in characters.
 * ~150 000 chars ≈ a 50-page contract at ~3 000 chars/page.
 * Keeps in-memory footprint predictable and prevents runaway requests.
 */
const MAX_TEXT_CHARS = 150_000;

// ── Rate limiter ──────────────────────────────────────────────────────────────

/**
 * 10 uploads per IP per minute.
 * Legal document analysis is a heavyweight operation; generous enough for
 * interactive use, tight enough to prevent abuse or accidental loops from
 * racking up Gemini API bills.
 */
const uploadRateLimit = rateLimit({
  windowMs: 60 * 1_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads. Please wait a moment before trying again." },
});

// ── Multer — memory storage only (no disk writes) ─────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      // Attach our typed error; multer passes it to next() automatically.
      cb(
        new AppError(
          400,
          `Unsupported file type "${file.mimetype}". Upload a PDF, DOCX, or TXT file.`,
        ),
      );
    }
  },
});

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/documents
 *
 * Multipart (file) request:
 *   Content-Type: multipart/form-data
 *   Field name:   "file"
 *
 * JSON (pasted text) request:
 *   Content-Type: application/json
 *   Body:         { "text": "..." }
 *
 * Success response (201):
 *   {
 *     "documentId": "<uuid>",
 *     "chunkCount": 42,
 *     "preview": "This Agreement is entered into..."
 *   }
 */
documentsRouter.post(
  "/",
  uploadRateLimit,
  // Use single-file upload middleware; multer size/type errors flow to next().
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hasFile = !!req.file;
      const hasText =
        typeof req.body === "object" &&
        req.body !== null &&
        typeof (req.body as Record<string, unknown>)["text"] === "string" &&
        (req.body as Record<string, string>)["text"].trim().length > 0;

      // ── Mutual exclusivity check ───────────────────────────────────────────

      if (hasFile && hasText) {
        throw new AppError(400, "Provide a file upload or pasted text, not both.");
      }

      if (!hasFile && !hasText) {
        throw new AppError(
          400,
          'No content provided. Upload a file (PDF, DOCX, TXT) or include a "text" field in the JSON body.',
        );
      }

      // ── Extract plain text ─────────────────────────────────────────────────

      let plainText: string;

      if (hasFile) {
        // req.file is guaranteed non-null by hasFile check above.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const file = req.file!;
        plainText = await extractText(file.buffer, file.mimetype);
      } else {
        // hasText is true — pasted text path
        plainText = (req.body as Record<string, string>)["text"].trim();

        if (plainText.length > MAX_TEXT_CHARS) {
          throw new AppError(
            413,
            `Pasted text exceeds the ${MAX_TEXT_CHARS.toLocaleString()}-character limit. ` +
              `Please upload a file instead.`,
          );
        }
      }

      // ── Chunk & store ──────────────────────────────────────────────────────

      const chunks = chunkText(plainText);

      if (chunks.length === 0) {
        throw new AppError(422, "No usable text could be extracted from the document.");
      }

      const documentId = uuidv4();

      storeDocument({
        documentId,
        fullText: plainText,
        chunks,
        ingestedAt: new Date().toISOString(),
        charCount: plainText.length,
      });

      // ── Respond ────────────────────────────────────────────────────────────

      res.status(201).json({
        documentId,
        chunkCount: chunks.length,
        preview: previewText(plainText),
      });
    } catch (err) {
      // Forward AppErrors and unexpected errors alike to centralized middleware.
      next(err);
    }
  },
);

// ── Classify route ────────────────────────────────────────────────────────────

/**
 * 5 classify calls per IP per minute.
 * Each call makes a Gemini API request; tighter than the upload limit to
 * protect free-tier quota from accidental loops or abuse.
 */
const classifyRateLimit = rateLimit({
  windowMs: 60 * 1_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many classification requests. Please wait a moment before trying again." },
});

/**
 * POST /api/documents/:id/classify
 *
 * Retrieves the stored document, sends its text to Gemini for classification,
 * validates the structured response with Zod, stores the result, and returns it.
 *
 * Success response (200):
 *   {
 *     "documentId": "<uuid>",
 *     "document_type": "nda",
 *     "confidence": "high"
 *   }
 */
documentsRouter.post(
  "/:id/classify",
  classifyRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };

      // ── Retrieve document ────────────────────────────────────────────────────

      const doc = getDocument(id);
      if (!doc) {
        throw new AppError(
          404,
          "Document not found or has expired. Please upload the document again.",
        );
      }

      // ── Build prompt (template in prompts/classify.ts per AGENTS.md) ─────────

      const prompt = buildClassifyPrompt(doc.fullText);

      // ── Call Gemini — only via geminiClient.ts, per AGENTS.md —————————————

      const rawResponse = await generateStructured(prompt, classificationSchema);

      // ── Parse & validate (AGENTS.md: validate every LLM response before use) ──

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawResponse);
      } catch {
        throw new AppError(
          502,
          "Classification service returned an unexpected response. Please try again.",
        );
      }

      const result = classificationSchema.safeParse(parsed);
      if (!result.success) {
        throw new AppError(
          502,
          "Classification service returned an invalid response. Please try again.",
        );
      }

      const classification = result.data;

      // ── Store alongside document ─────────────────────────────────────────────

      setClassification(id, classification);

      // ── Respond ──────────────────────────────────────────────────────────────

      res.status(200).json({
        documentId: id,
        ...classification,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── Multer error normalisation ────────────────────────────────────────────────

/**
 * Multer emits its own error types (MulterError) for size violations.
 * Catch them here and convert to AppError so the centralized handler
 * returns the right HTTP status and never leaks internals.
 */
documentsRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err != null && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    if (code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: `File exceeds the ${MAX_FILE_BYTES / 1_024 / 1_024} MB size limit.`,
      });
      return;
    }
  }
  // Not a multer error — pass through to app-level handler.
  next(err);
});
