/**
 * UnderstandPage
 *
 * Layout order (reading path):
 *   1. Document identity header — type badge + "Analyzed for: [Persona]" chip + "New document" escape
 *   2. Document summary card
 *   3. Clause list (heading + count + accordion)
 *   4. Export action — at the END of reading, where the user has context
 *
 * The h1 is the actual document type (not generic "Document Analysis").
 * The persona chip is a visible persistent confirmation.
 * Export moves below the clause list — the CTA lives where the task completes.
 *
 * ARIA live region announces when analysis completes (PRD §11).
 */

import { useEffect, useState, useId } from "react";
import { Loader2, FileText, Download, RotateCcw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClauseAccordion } from "@/components/ClauseAccordion";
import { ExportPanel } from "@/components/ExportPanel";
import { classifyDocument, analyzeDocument } from "@/lib/api";
import type { AnalysisResult, UploadResult } from "@/types";
import type { Persona } from "@/components/PersonaSelect";

interface UnderstandPageProps {
  uploadResult: UploadResult;
  persona: Persona | "";
  analysisResult: AnalysisResult | null;
  onAnalysisComplete: (result: AnalysisResult) => void;
  onReset: () => void;
  outOfScopeQs: string[];
}

type Step = "idle" | "classifying" | "analyzing" | "done" | "error";

const STEP_LABELS: Record<Step, string> = {
  idle: "",
  classifying: "Identifying document type…",
  analyzing: "Extracting and prioritizing clauses…",
  done: "Analysis complete",
  error: "",
};

// Human-readable persona label
const PERSONA_LABELS: Record<string, string> = {
  tenant:           "Tenant",
  employee:         "Employee",
  freelancer:       "Freelancer",
  consumer:         "Consumer",
  small_biz:        "Small Business Owner",
  unknown:          "",
};

function formatPersona(p: string): string {
  if (!p || p === "unknown") return "";
  return PERSONA_LABELS[p] ?? p.replace(/_/g, " ");
}

function formatDocType(t: string): string {
  return t
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function UnderstandPage({
  uploadResult,
  persona,
  analysisResult,
  onAnalysisComplete,
  onReset,
  outOfScopeQs,
}: UnderstandPageProps) {
  const [step, setStep] = useState<Step>(analysisResult ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const liveId = useId();

  const runAnalysis = async () => {
    setError(null);
    try {
      setStep("classifying");
      await classifyDocument(uploadResult.documentId);

      setStep("analyzing");
      const result = await analyzeDocument(
        uploadResult.documentId,
        persona || "unknown",
      );
      onAnalysisComplete(result);
      setStep("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Analysis failed. Please try again.",
      );
      setStep("error");
    }
  };

  useEffect(() => {
    if (!analysisResult) {
      void runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loading / error state ──────────────────────────────────────────────────

  if (step !== "done") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-16">
        <div id={liveId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {STEP_LABELS[step]}
        </div>

        {step === "error" ? (
          <div className="w-full space-y-4">
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => void runAnalysis()}
                className="gap-2"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <RotateCcw size={14} aria-hidden="true" />
                Retry analysis
              </Button>
              <Button variant="ghost" onClick={onReset} style={{ color: "var(--muted-foreground)" }}>
                Upload different document
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <Loader2
                size={32}
                className="animate-spin"
                style={{ color: "var(--primary)" }}
                aria-hidden="true"
              />
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {STEP_LABELS[step]}
              </p>
            </div>

            {/* Two-step progress */}
            <div className="flex items-center gap-4" aria-hidden="true">
              {(["classifying", "analyzing"] as const).map((s, idx) => (
                <div key={s} className="flex items-center gap-2">
                  {idx > 0 && (
                    <div
                      className="h-px w-6"
                      style={{
                        background:
                          step === "analyzing"
                            ? "var(--severity-low)"
                            : "var(--border)",
                      }}
                    />
                  )}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 rounded-full transition-colors duration-500"
                      style={{
                        background:
                          step === s
                            ? "var(--primary)"
                            : s === "classifying" && step === "analyzing"
                              ? "var(--severity-low)"
                              : "var(--border)",
                      }}
                    />
                    <span
                      className="text-xs"
                      style={{
                        color:
                          s === step
                            ? "var(--foreground)"
                            : "var(--muted-foreground)",
                      }}
                    >
                      {s === "classifying" ? "Classify" : "Analyze"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="max-w-xs text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
              This may take 10–20 seconds depending on document length.
            </p>
          </>
        )}
      </div>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────

  const result = analysisResult!;
  const docType = formatDocType(result.document_type);
  const personaLabel = formatPersona(persona || "unknown");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* ARIA — completion announcement */}
      <div id={liveId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        Analysis complete. {result.clauses.length} clauses found.
      </div>

      {/* ── 1. Document identity header ───────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: type + persona + h1 */}
        <div className="flex flex-col gap-2">
          {/* Meta row — doc type badge + persona chip */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-widest"
              style={{
                background: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              <FileText size={11} aria-hidden="true" />
              {docType}
            </span>

            {personaLabel && (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                style={{
                  borderColor: "var(--primary)",
                  color: "var(--primary)",
                  background: "var(--primary)" + "1a",
                }}
                aria-label={`Analyzed for: ${personaLabel}`}
              >
                <User size={10} aria-hidden="true" />
                {personaLabel}
              </span>
            )}
          </div>

          {/* h1 — the real document type, not a generic label */}
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            {docType}
          </h1>
        </div>

        {/* Right: escape hatch */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="flex-shrink-0 gap-1.5 self-start text-xs"
          style={{ color: "var(--muted-foreground)" }}
          aria-label="Upload a different document and start over"
        >
          <RotateCcw size={12} aria-hidden="true" />
          New document
        </Button>
      </div>

      {/* ── 2. Document summary card ──────────────────────────────────── */}
      <div
        className="rounded-xl border px-5 py-4"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        aria-labelledby="summary-heading"
      >
        <h2
          id="summary-heading"
          className="mb-2 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--muted-foreground)" }}
        >
          Document summary
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
          {result.summary}
        </p>
      </div>

      {/* ── 3. Clause list ────────────────────────────────────────────── */}
      <section aria-labelledby="clauses-heading">
        <div className="mb-3 flex items-baseline gap-2">
          <h2
            id="clauses-heading"
            className="text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {result.clauses.length} clause{result.clauses.length !== 1 ? "s" : ""}
          </h2>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {personaLabel ? `prioritized for ${personaLabel}` : "extracted from document"}
          </span>
        </div>

        <ClauseAccordion clauses={result.clauses} />
      </section>

      {/* ── 4. Export — at the END of the reading path ────────────────── */}
      <div
        className="flex flex-col items-center gap-3 rounded-xl border py-6"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          Done reviewing clauses?
        </p>
        <p className="max-w-xs text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
          Export a plain-language checklist and a list of sharp questions to bring to your lawyer.
        </p>
        <ExportPanel
          documentId={result.documentId}
          persona={persona || "unknown"}
          outOfScopeQs={outOfScopeQs}
          trigger={
            <Button
              size="default"
              className="gap-2 px-6"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
              aria-label="Export checklist and lawyer questions as markdown"
            >
              <Download size={14} aria-hidden="true" />
              Export checklist &amp; questions
            </Button>
          }
        />
      </div>
    </div>
  );
}
