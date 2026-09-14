/**
 * DocumentDropzone
 *
 * Accepts PDF, DOCX, and TXT uploads via drag-and-drop or file-browser click.
 * A "Paste text instead" toggle swaps to a textarea without a page transition.
 *
 * Accessibility:
 * - Dropzone is role="button" with keyboard activation (Enter / Space)
 * - File input is visually hidden but programmatically associated
 * - ARIA live region announces accepted file and errors
 * - Paste textarea has explicit aria-label and character counter via aria-live
 * - Error messages linked via aria-describedby to their triggering element
 *
 * Design constraints (brief):
 * - Dropzone border goes from dashed to solid accent on hover/drag-over
 * - "Paste text instead" is a plain text toggle link — no modal
 * - File-accepted state shows filename + size, replaces prompt copy
 * - Nothing writes to disk — file handed to parent via onFileChange
 */

import { useRef, useState, useId, useCallback } from "react";
import { Upload, FileText, X, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const ACCEPTED_EXTENSIONS = ".pdf,.docx,.txt";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — mirrors backend limit
const MAX_PASTE_CHARS = 50_000; // ~25 pages of dense text

/** Human-readable file size */
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
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveRegionId = useId();
  const errorId = useId();
  const textareaId = useId();

  const validateAndAccept = useCallback(
    (incoming: File) => {
      setError(null);
      if (!ACCEPTED_TYPES.includes(incoming.type)) {
        setError("Only PDF, DOCX, and TXT files are supported.");
        onFileChange(null);
        return;
      }
      if (incoming.size > MAX_BYTES) {
        setError(`File is too large (${formatBytes(incoming.size)}). Maximum is 5 MB.`);
        onFileChange(null);
        return;
      }
      onFileChange(incoming);
    },
    [onFileChange],
  );

  /* ── Drag handlers ──────────────────────────────────────────────────────── */
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

  /* ── Input change handler ────────────────────────────────────────────────── */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) validateAndAccept(picked);
    // Reset the input value so the same file can be re-selected after clearing
    e.target.value = "";
  };

  /* ── Clear file ──────────────────────────────────────────────────────────── */
  const clearFile = () => {
    setError(null);
    onFileChange(null);
  };

  /* ── Keyboard activation for dropzone button ─────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled && mode === "file") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const pasteCharsLeft = MAX_PASTE_CHARS - text.length;
  const pasteNearLimit = pasteCharsLeft < 2000;

  return (
    <div>
      {/* ── Mode toggle ───────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {mode === "file" ? "Upload your document" : "Paste document text"}
        </p>
        <button
          type="button"
          onClick={() => {
            onModeChange(mode === "file" ? "paste" : "file");
            setError(null);
          }}
          disabled={disabled}
          className="flex items-center gap-1 text-xs transition-colors disabled:opacity-50"
          style={{ color: "var(--primary)" }}
          aria-label={mode === "file" ? "Switch to paste text mode" : "Switch to file upload mode"}
        >
          {mode === "file" ? (
            <>
              Paste text instead
              <ChevronRight size={12} aria-hidden="true" />
            </>
          ) : (
            <>
              Upload a file instead
              <ChevronDown size={12} aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {/* ── ARIA live region for file acceptance announcements ────────────── */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {file ? `File accepted: ${file.name}, ${formatBytes(file.size)}` : ""}
        {error ? `Error: ${error}` : ""}
      </div>

      {mode === "file" ? (
        <>
          {/* ── Dropzone ─────────────────────────────────────────────────── */}
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label="Upload document — click or drag and drop"
            aria-describedby={error ? errorId : undefined}
            aria-disabled={disabled}
            onClick={() => !disabled && !file && inputRef.current?.click()}
            onKeyDown={handleKeyDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 transition-all duration-200",
              !file && !isDragging && !disabled && "cursor-pointer",
              disabled && "opacity-50",
            )}
            style={{
              background: isDragging ? "oklch(0.60 0.18 240 / 0.08)" : "var(--surface)",
              borderStyle: isDragging || file ? "solid" : "dashed",
              borderColor: isDragging
                ? "var(--primary)"
                : file
                  ? "var(--border)"
                  : error
                    ? "var(--destructive)"
                    : "var(--border)",
            }}
          >
            {file ? (
              /* File accepted state */
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
                  <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="ml-2 flex-shrink-0 rounded-md p-1.5 transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ) : (
              /* Idle / drag state */
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{
                    background: isDragging ? "var(--primary)" : "var(--muted)",
                    color: isDragging ? "var(--primary-foreground)" : "var(--muted-foreground)",
                    transition: "background 0.2s, color 0.2s",
                  }}
                  aria-hidden="true"
                >
                  <Upload size={20} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {isDragging ? "Drop it here" : "Drop your document here"}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                    or click to browse · PDF, DOCX, TXT · max 5 MB
                  </p>
                </div>
              </div>
            )}

            {/* Visually hidden file input */}
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
          </div>

          {/* ── Inline error ──────────────────────────────────────────────── */}
          {error && (
            <p
              id={errorId}
              role="alert"
              className="mt-2 text-xs"
              style={{ color: "var(--destructive)" }}
            >
              {error}
            </p>
          )}
        </>
      ) : (
        /* ── Paste mode ───────────────────────────────────────────────────── */
        <div>
          <label htmlFor={textareaId} className="sr-only">
            Paste document text
          </label>
          <textarea
            id={textareaId}
            value={text}
            onChange={(e) => onTextChange(e.target.value.slice(0, MAX_PASTE_CHARS))}
            disabled={disabled}
            placeholder="Paste the full text of your document here…"
            rows={10}
            aria-label="Paste document text"
            aria-describedby={`${textareaId}-count`}
            className="w-full resize-y rounded-xl border px-4 py-3 text-sm leading-relaxed outline-none transition-colors disabled:opacity-50"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
              minHeight: "160px",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          <div className="mt-1.5 flex justify-end">
            <p
              id={`${textareaId}-count`}
              role="status"
              aria-live="polite"
              className="text-xs tabular-nums"
              style={{
                color: pasteNearLimit ? "var(--severity-medium)" : "var(--muted-foreground)",
              }}
            >
              {text.length.toLocaleString()} / {MAX_PASTE_CHARS.toLocaleString()} characters
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
