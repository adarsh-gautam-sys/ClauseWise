/**
 * UploadScreen
 *
 * The primary interaction surface for ClauseWise.
 * Layout: persona selector → document input → analyze CTA.
 *
 * The persona selector is intentionally *above* the dropzone — it is the
 * first choice, not an afterthought. Making it first signals that this is
 * context-aware analysis, not a generic file parser.
 *
 * CTA disabled until both persona and document (file or non-empty text) are
 * provided. Loading state disables all inputs and shows a spinner.
 *
 * API integration: POST /api/documents with multipart/form-data (file) or
 * application/json (text). URL from VITE_API_URL env var.
 */

import { useState, useCallback } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { PersonaSelector, type Persona } from "./PersonaSelector";
import { DocumentDropzone } from "./DocumentDropzone";
import { cn } from "../lib/cn";

const API_BASE = import.meta.env["VITE_API_URL"] ?? "http://localhost:3001";

export interface UploadResult {
  documentId: string;
  chunkCount: number;
  preview: string;
}

interface UploadScreenProps {
  onSuccess: (result: UploadResult, persona: Persona) => void;
}

export function UploadScreen({ onSuccess }: UploadScreenProps) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /* ── Derived state ──────────────────────────────────────────────────────── */
  const hasDocument = mode === "file" ? file !== null : text.trim().length > 0;
  const canSubmit = persona !== null && hasDocument && !uploading;

  /* ── File/text change handlers (clear upload error on new selection) ─────── */
  const handleFileChange = useCallback((f: File | null) => {
    setFile(f);
    setUploadError(null);
  }, []);

  const handleTextChange = useCallback((t: string) => {
    setText(t);
    setUploadError(null);
  }, []);

  /* ── Submit ──────────────────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setUploading(true);
    setUploadError(null);

    try {
      let response: Response;

      if (mode === "file" && file) {
        const formData = new FormData();
        formData.append("document", file);
        response = await fetch(`${API_BASE}/api/documents`, {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch(`${API_BASE}/api/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const msg =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as Record<string, unknown>)["error"])
            : `Upload failed (${response.status})`;
        throw new Error(msg);
      }

      const result = (await response.json()) as UploadResult;
      if (!persona) return; // impossible: canSubmit requires persona !== null
      onSuccess(result, persona);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      {/* ── Page heading ───────────────────────────────────────────────────── */}
      <div className="mb-10 text-center">
        <h1
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: "var(--foreground)" }}
        >
          Understand what you're signing
        </h1>
        <p
          className="mx-auto mt-3 max-w-md text-base leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          Upload any contract. Get plain-language explanations, risk-flagged clauses, and a
          lawyer-ready question list — in minutes.
        </p>
      </div>

      {/* ── Upload card ────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} aria-label="Document upload form" noValidate>
        <div
          className="rounded-2xl border p-6 sm:p-8"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "0 2px 4px oklch(0 0 0 / 0.30), 0 8px 24px oklch(0 0 0 / 0.20)",
          }}
        >
          {/* Step 1 — Persona */}
          <div className="mb-7">
            <PersonaSelector value={persona} onChange={setPersona} />
          </div>

          {/* Divider */}
          <div
            className="mb-7 h-px w-full"
            style={{ background: "var(--border)" }}
            role="separator"
            aria-hidden="true"
          />

          {/* Step 2 — Document */}
          <DocumentDropzone
            onFileChange={handleFileChange}
            onTextChange={handleTextChange}
            mode={mode}
            onModeChange={setMode}
            file={file}
            text={text}
            disabled={uploading}
          />

          {/* ── Upload error ────────────────────────────────────────────────── */}
          {uploadError && (
            <p
              role="alert"
              className="mt-4 rounded-lg border px-4 py-3 text-sm"
              style={{
                borderColor: "var(--destructive)",
                background: "oklch(0.55 0.20 22 / 0.12)",
                color: "var(--destructive-foreground)",
              }}
            >
              {uploadError}
            </p>
          )}

          {/* ── CTA ─────────────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              canSubmit
                ? "cursor-pointer hover:opacity-90 active:scale-[0.99]"
                : "cursor-not-allowed opacity-40",
            )}
            style={
              {
                background: canSubmit ? "var(--primary)" : "var(--muted)",
                color: canSubmit ? "var(--primary-foreground)" : "var(--muted-foreground)",
                // focus ring offset uses ground color
                "--tw-ring-color": "var(--primary)",
                "--tw-ring-offset-color": "var(--surface)",
              } as React.CSSProperties
            }
            aria-describedby={
              !persona ? "cta-hint-persona" : !hasDocument ? "cta-hint-document" : undefined
            }
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span>Uploading…</span>
              </>
            ) : (
              <>
                <span>Analyze Document</span>
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>

          {/* Accessible hints for disabled CTA */}
          {!persona && (
            <p
              id="cta-hint-persona"
              className="mt-2.5 text-center text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Select who you are in this agreement to continue
            </p>
          )}
          {persona && !hasDocument && (
            <p
              id="cta-hint-document"
              className="mt-2.5 text-center text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Add a document to continue
            </p>
          )}
        </div>
      </form>

      {/* ── Feature summary ────────────────────────────────────────────────── */}
      <ul
        className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs"
        style={{ color: "var(--muted-foreground)" }}
        aria-label="Product features"
      >
        {[
          "Plain-language summaries",
          "Severity-flagged clauses",
          "Persona-aware analysis",
          "Lawyer question list",
          "No document storage",
        ].map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <span
              className="inline-block h-1 w-1 rounded-full"
              style={{ background: "var(--primary)" }}
              aria-hidden="true"
            />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
