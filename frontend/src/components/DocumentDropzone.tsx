/**
 * DocumentDropzone
 *
 * Accepts PDF, DOCX, and TXT uploads via drag-and-drop or file-browser.
 * A "Paste text instead" toggle swaps to a shadcn Textarea.
 *
 * Accessibility:
 * - Dropzone has role="button" with keyboard activation (Enter / Space)
 * - ARIA live region announces file accepted and validation errors
 * - Paste textarea has explicit aria-label + character counter via aria-live
 * - Error messages linked via aria-describedby
 * - shadcn Button and Textarea handle their own focus/ARIA behavior
 */

import { useRef, useState, useId, useCallback } from "react";
import { Upload, FileText, X, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const ACCEPTED_EXTENSIONS = ".pdf,.docx,.txt";
const MAX_BYTES = 5 * 1024 * 1024;        // 5 MB — mirrors backend limit
const MAX_PASTE_CHARS = 50_000;            // ~25 pages of dense text

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentDropzoneProps {
  onFileChange: (file: File | null) => void;
  onTextChange: (text: string) => void;
  mode: "file" | "paste";
  onModeChange: (mode: "file" | "paste") => void;
  file: File | null;
  text: string;
  disabled?: boolean;
}

export function DocumentDropzone({
  onFileChange,
  onTextChange,
  mode,
  onModeChange,
  file,
  text,
  disabled = false,
}: DocumentDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveId = useId();
  const errorId = useId();
  const textareaId = useId();

  const validateAndAccept = useCallback(
    (incoming: File) => {
      setValidationError(null);
      if (!ACCEPTED_TYPES.has(incoming.type)) {
        setValidationError("Only PDF, DOCX, and TXT files are supported.");
        onFileChange(null);
        return;
      }
      if (incoming.size > MAX_BYTES) {
        setValidationError(
          `File is too large (${formatBytes(incoming.size)}). Maximum is 5 MB.`,
        );
        onFileChange(null);
        return;
      }
      onFileChange(incoming);
    },
    [onFileChange],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndAccept(dropped);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) validateAndAccept(picked);
    e.target.value = "";
  };
  const clearFile = () => {
    setValidationError(null);
    onFileChange(null);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled && mode === "file" && !file) {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const pasteCharsLeft = MAX_PASTE_CHARS - text.length;
  const pasteNearLimit = pasteCharsLeft < 2_000;

  return (
    <div>
      {/* ── Mode label + toggle ────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {mode === "file" ? "Upload your document" : "Paste document text"}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onModeChange(mode === "file" ? "paste" : "file");
            setValidationError(null);
          }}
          disabled={disabled}
          className="min-h-[44px] sm:min-h-0 h-auto px-3 py-2 sm:px-2 sm:py-1 text-xs inline-flex items-center"
          style={{ color: "var(--primary)" }}
          aria-label={
            mode === "file"
              ? "Switch to paste text mode"
              : "Switch to file upload mode"
          }
        >
          {mode === "file" ? (
            <>
              <span>Paste text instead</span>
              <ArrowRight size={13} className="ml-1.5" aria-hidden="true" />
            </>
          ) : (
            <>
              <ArrowLeft size={13} className="mr-1.5" aria-hidden="true" />
              <span>Upload a file instead</span>
            </>
          )}
        </Button>
      </div>

      {/* ARIA live region for screen-reader announcements */}
      <div
        id={liveId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {file ? `File accepted: ${file.name}, ${formatBytes(file.size)}` : ""}
        {validationError ? `Error: ${validationError}` : ""}
      </div>

      {mode === "file" ? (
        <>
          {/* Visually hidden file input — OUTSIDE the role="button" div to avoid
              axe nested-interactive violation. Triggered programmatically via ref. */}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleInputChange}
            disabled={disabled}
          />

          {/* ── Dropzone ─────────────────────────────────────────────── */}
          <div
            {...(file
              ? {
                  // File is loaded: the div is a non-interactive container.
                  // The only action is the inner "Remove" Button.
                  // role="group" gives screen readers a labelled region without
                  // nesting an interactive element inside another interactive element.
                  role: "group" as const,
                  "aria-label": `Uploaded file: ${file.name}`,
                }
              : {
                  // No file: the div is the drag-and-drop / click trigger.
                  role: "button" as const,
                  tabIndex: disabled ? -1 : 0,
                  "aria-label": "Upload document — click or drag and drop",
                  "aria-describedby": validationError ? errorId : undefined,
                  "aria-disabled": disabled,
                  onClick: () => !disabled && !file && inputRef.current?.click(),
                  onKeyDown: handleKeyDown,
                })}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 transition-all duration-200",
              !file && !disabled && "cursor-pointer",
              disabled && "opacity-50",
            )}
            style={{
              background: isDragging
                ? "oklch(0.60 0.18 240 / 0.08)"
                : "var(--card)",
              borderStyle: isDragging || file ? "solid" : "dashed",
              borderColor: isDragging
                ? "var(--primary)"
                : validationError
                  ? "var(--destructive)"
                  : "var(--border)",
            }}
          >
            {file ? (
              /* ── File accepted state ────────────────────────────── */
              <div className="flex w-full items-start gap-3 p-5">
                <div
                  className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                  aria-hidden="true"
                >
                  <FileText size={16} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    {file.name}
                  </p>
                  <p
                    className="mt-0.5 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {formatBytes(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 sm:h-8 sm:w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  aria-label={`Remove ${file.name}`}
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <X size={15} aria-hidden="true" />
                </Button>
              </div>
            ) : (
              /* ── Idle / drag-over state ─────────────────────────── */
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200"
                  style={{
                    background: isDragging ? "var(--primary)" : "var(--muted)",
                    color: isDragging
                      ? "var(--primary-foreground)"
                      : "var(--muted-foreground)",
                  }}
                  aria-hidden="true"
                >
                  <Upload size={20} strokeWidth={1.75} />
                </div>
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    {isDragging ? "Drop it here" : "Drop your document here"}
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    or click to browse · PDF, DOCX, TXT · max 5 MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Validation error */}
          {validationError && (
            <p
              id={errorId}
              role="alert"
              className="mt-2 text-xs"
              style={{ color: "var(--destructive)" }}
            >
              {validationError}
            </p>
          )}
        </>
      ) : (
        /* ── Paste mode ──────────────────────────────────────────────── */
        <div>
          <Textarea
            id={textareaId}
            value={text}
            onChange={(e) =>
              onTextChange(e.target.value.slice(0, MAX_PASTE_CHARS))
            }
            disabled={disabled}
            placeholder="Paste the full text of your document here…"
            rows={10}
            aria-label="Paste document text"
            aria-describedby={`${textareaId}-count`}
            className="resize-y text-base sm:text-sm leading-relaxed"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
              minHeight: "160px",
            }}
          />
          <div className="mt-1.5 flex justify-end">
            <p
              id={`${textareaId}-count`}
              role="status"
              aria-live="polite"
              className="text-xs tabular-nums"
              style={{
                color: pasteNearLimit
                  ? "var(--severity-medium)"
                  : "var(--muted-foreground)",
              }}
            >
              {text.length.toLocaleString()} / {MAX_PASTE_CHARS.toLocaleString()} chars
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
