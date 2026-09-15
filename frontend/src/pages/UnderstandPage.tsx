/**
 * UnderstandPage
 *
 * Shown on the Understand tab after a document has been uploaded.
 *
 * Flow:
 *   1. On mount: call classify → then analyze (sequential, both required)
 *   2. Show multi-step loading with step labels
 *   3. On success: render document summary + ClauseAccordion + Export button
 *   4. On error: show Alert with Retry
 *
 * ARIA live region announces when analysis completes (PRD §11).
 */

import { useEffect, useState, useId } from "react";
import { Loader2, FileText, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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

  // Auto-start on mount if not already analyzed
  useEffect(() => {
    if (!analysisResult) {
      void runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (step !== "done") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-16">
        {/* ARIA live region */}
        <div
          id={liveId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
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

            {/* Step progress dots */}
            <div className="flex items-center gap-3" aria-hidden="true">
              {(["classifying", "analyzing"] as const).map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <div
                    className="h-2 w-2 rounded-full transition-colors duration-500"
                    style={{
                      background:
                        step === s
                          ? "var(--primary)"
                          : step === "done" || (s === "classifying" && step === "analyzing")
                            ? "var(--severity-low)"
                            : "var(--border)",
                    }}
                  />
                  <span className="text-xs" style={{ color: s === step ? "var(--foreground)" : "var(--muted-foreground)" }}>
                    {s === "classifying" ? "Classify" : "Analyze"}
                  </span>
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {/* ARIA live region — announces completion */}
      <div
        id={liveId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        Analysis complete. {result.clauses.length} clauses found.
      </div>

      {/* ── Document header ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText
              size={16}
              style={{ color: "var(--primary)" }}
              aria-hidden="true"
            />
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--muted-foreground)" }}
            >
              {result.document_type.replace(/_/g, " ")}
            </span>
          </div>
          <h1
            className="mt-1 text-xl font-semibold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            Document Analysis
          </h1>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-1.5 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            <RotateCcw size={12} aria-hidden="true" />
            New document
          </Button>
          <ExportPanel
            documentId={result.documentId}
            persona={persona || "unknown"}
            outOfScopeQs={outOfScopeQs}
            trigger={
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
                aria-label="Export checklist and lawyer questions"
              >
                <Download size={12} aria-hidden="true" />
                Export checklist
              </Button>
            }
          />
        </div>
      </div>

      {/* ── Summary ───────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border px-5 py-4"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <h2
          className="mb-2 text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--muted-foreground)" }}
        >
          Document summary
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--foreground)" }}
        >
          {result.summary}
        </p>
      </div>

      <Separator style={{ background: "var(--border)" }} />

      {/* ── Clause list ───────────────────────────────────────────────── */}
      <section aria-labelledby="clauses-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="clauses-heading"
            className="text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {result.clauses.length} clause
            {result.clauses.length !== 1 ? "s" : ""} found
            {persona && (
              <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>
                {" "}· prioritized for {persona.replace(/_/g, " ")}
              </span>
            )}
          </h2>
        </div>
        <ClauseAccordion clauses={result.clauses} />
      </section>
    </div>
  );
}
