/**
 * UploadScreen
 *
 * Shown on the Understand tab when no document is loaded yet.
 * Sequence: persona required (enforced via header) → file/paste →  upload.
 *
 * States: idle → uploading → error (retry) → success (→ UploadSuccess)
 *
 * API: POST /api/documents via multipart (file) or JSON (text).
 * URL from VITE_API_URL env var, default http://localhost:3001.
 *
 * Accessibility:
 * - Upload error rendered in an Alert with role="alert"
 * - CTA button aria-describedby hint explains why it's disabled
 * - Loading state announced via button text change + aria-live
 */

import { useState, useCallback } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentDropzone } from "@/components/DocumentDropzone";
import { cn } from "@/lib/utils";
import type { Persona } from "@/components/PersonaSelect";
import type { UploadResult } from "@/types";

// Re-export for legacy imports
export type { UploadResult };

const API_BASE = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3001";

interface UploadScreenProps {
  persona: Persona | "";
  onSuccess: (result: UploadResult) => void;
  /** Optional heading override — defaults to upload screen hero text. */
  label?: string;
  /** Optional submit button label — defaults to "Analyze Document". */
  submitLabel?: string;
}

export function UploadScreen({ persona, onSuccess, label, submitLabel = "Analyze Document" }: UploadScreenProps) {

  const [mode, setMode]       = useState<"file" | "paste">("file");
  const [file, setFile]       = useState<File | null>(null);
  const [text, setText]       = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const hasDocument = mode === "file" ? file !== null : text.trim().length > 0;
  const missingPersona = !persona;
  const canSubmit = !missingPersona && hasDocument && !uploading;

  const handleFileChange = useCallback((f: File | null) => {
    setFile(f);
    setUploadError(null);
  }, []);

  const handleTextChange = useCallback((t: string) => {
    setText(t);
    setUploadError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setUploading(true);
    setUploadError(null);

    try {
      let response: Response;

      if (mode === "file" && file) {
        const body = new FormData();
        body.append("document", file);
        response = await fetch(`${API_BASE}/api/documents`, {
          method: "POST",
          body,
        });
      } else {
        response = await fetch(`${API_BASE}/api/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as Record<string, unknown>;
        const msg = typeof body["error"] === "string"
          ? body["error"]
          : `Upload failed (HTTP ${response.status}). Please try again.`;
        throw new Error(msg);
      }

      const result = (await response.json()) as UploadResult;
      onSuccess(result);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Page heading */}
      <div className="mb-8 text-center">
        <h1
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: "var(--foreground)" }}
        >
          {label ?? "Understand what you're signing"}
        </h1>
        <p
          className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          Upload any contract and get plain-language explanations, risk-flagged clauses,
          and a lawyer-ready question list.
        </p>
      </div>

      {/* Upload card */}
      <form
        onSubmit={handleSubmit}
        aria-label="Document upload"
        noValidate
      >
        <div
          className="rounded-2xl border p-6"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            boxShadow: "0 2px 4px oklch(0 0 0 / 0.25), 0 8px 24px oklch(0 0 0 / 0.15)",
          }}
        >
          {/* Persona reminder if not yet selected */}
          {missingPersona && (
            <div
              className="mb-5 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm"
              role="note"
              aria-live="polite"
              style={{
                borderColor: "var(--border)",
                background: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              <span aria-hidden="true">👆</span>
              <span>
                Select <strong style={{ color: "var(--foreground)" }}>who you are</strong> in
                the dropdown above before uploading — it determines which clauses are
                surfaced first.
              </span>
            </div>
          )}

          {/* Dropzone */}
          <DocumentDropzone
            onFileChange={handleFileChange}
            onTextChange={handleTextChange}
            mode={mode}
            onModeChange={setMode}
            file={file}
            text={text}
            disabled={uploading}
          />

          {/* Upload error */}
          {uploadError && (
            <Alert
              variant="destructive"
              className="mt-4"
              role="alert"
            >
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* CTA */}
          <Button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "mt-5 w-full gap-2 text-sm font-semibold",
              canSubmit && "hover:opacity-90 active:scale-[0.99]",
            )}
            style={
              canSubmit
                ? {
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }
                : {}
            }
            aria-busy={uploading}
            aria-describedby={
              missingPersona
                ? "cta-hint"
                : !hasDocument
                  ? "cta-hint"
                  : undefined
            }
          >
            {uploading ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                <span>Uploading…</span>
              </>
            ) : (
              <>
                <span>{submitLabel}</span>
                <ArrowRight size={15} aria-hidden="true" />
              </>
            )}
          </Button>

          {/* Accessible hint for disabled CTA */}
          {!canSubmit && !uploading && (
            <p
              id="cta-hint"
              className="mt-2 text-center text-xs"
              style={{ color: "var(--muted-foreground)" }}
              aria-live="polite"
            >
              {missingPersona
                ? "Select a persona in the header to continue"
                : "Add a document to continue"}
            </p>
          )}
        </div>
      </form>

      {/* Feature strip */}
      <ul
        className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs"
        style={{ color: "var(--muted-foreground)" }}
        aria-label="What you get"
      >
        {[
          "Plain-language summaries",
          "Risk-flagged clauses",
          "Persona-aware analysis",
          "Lawyer question list",
          "No document storage",
        ].map((feature) => (
          <li key={feature} className="flex items-center gap-1.5">
            <span
              className="inline-block h-1 w-1 rounded-full"
              style={{ background: "var(--primary)" }}
              aria-hidden="true"
            />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
