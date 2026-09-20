/**
 * ComparePage
 *
 * Flow:
 *   1. Requires Document A to already be analyzed (gated in App.tsx)
 *   2. Shows an UploadScreen for Document B
 *   3. After B uploads: auto-runs classify + analyze on B
 *   4. "Compare Documents" button calls POST /api/documents/compare
 *   5. Renders CompareTable with results
 *
 * State lives here (doc B upload + analysis + compare result).
 * Document A state comes from App.tsx via props.
 */

import { useState, useId, useRef, useEffect } from "react";
import { ArrowLeftRight, Loader2, RotateCcw, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { UploadScreen } from "@/components/UploadScreen";
import { CompareTable } from "@/components/CompareTable";
import { classifyDocument, analyzeDocument, compareDocuments } from "@/lib/api";
import type { AnalysisResult, CompareResult, UploadResult } from "@/types";
import type { Persona } from "@/components/PersonaSelect";

interface ComparePageProps {
  /** Document A — already analyzed by UnderstandPage */
  docAResult: AnalysisResult;
  persona: Persona | "";
}

type Phase =
  | "upload_b"
  | "analyzing_b"
  | "ready"
  | "comparing"
  | "done"
  | "error";

export function ComparePage({ docAResult, persona }: ComparePageProps) {
  const [phase, setPhase] = useState<Phase>("upload_b");
  const [docBUpload, setDocBUpload] = useState<UploadResult | null>(null);
  const [docBAnalysis, setDocBAnalysis] = useState<AnalysisResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const liveId = useId();

  // Clean up any in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleCancelAnalysis = () => {
    abortRef.current?.abort();
    resetB();
  };

  const handleDocBUploaded = async (result: UploadResult) => {
    setDocBUpload(result);
    setError(null);
    setPhase("analyzing_b");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    try {
      await classifyDocument(result.documentId, signal);
      if (signal.aborted) return;
      const analysis = await analyzeDocument(result.documentId, persona || "unknown", signal);
      if (signal.aborted) return;
      setDocBAnalysis(analysis);
      setPhase("ready");
    } catch (err) {
      if (signal.aborted) return;
      setError(
        err instanceof Error
          ? err.message
          : "Could not analyze Document B. Please try again.",
      );
      setPhase("error");
    }
  };

  const handleCompare = async () => {
    if (!docBUpload) return;
    setPhase("comparing");
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    try {
      const result = await compareDocuments(
        docAResult.documentId,
        docBUpload.documentId,
        signal,
      );
      if (signal.aborted) return;
      setCompareResult(result);
      setPhase("done");
    } catch (err) {
      if (signal.aborted) return;
      setError(
        err instanceof Error
          ? err.message
          : "Comparison failed. Please try again.",
      );
      setPhase("error");
    }
  };

  const resetB = () => {
    abortRef.current?.abort();
    setDocBUpload(null);
    setDocBAnalysis(null);
    setCompareResult(null);
    setError(null);
    setPhase("upload_b");
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {/* ARIA live region */}
      <div
        id={liveId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {phase === "analyzing_b" && "Analyzing Document B…"}
        {phase === "comparing"   && "Comparing documents…"}
        {phase === "done"        && `Comparison complete. ${compareResult?.aligned_count ?? 0} clauses aligned.`}
      </div>

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div>
        <h1
          className="text-xl font-semibold tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          Compare Documents
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Upload a second document to compare it clause-by-clause against your
          analyzed document.
        </p>
      </div>

      {/* ── Document labels ───────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <DocLabel
          label="Document A"
          type={docAResult.document_type}
          ready
        />
        <DocLabel
          label="Document B"
          type={docBAnalysis?.document_type}
          ready={!!docBAnalysis}
        />
      </div>

      <Separator style={{ background: "var(--border)" }} />

      {/* ── Upload B ──────────────────────────────────────────────────── */}
      {phase === "upload_b" && (
        <UploadScreen
          persona={persona}
          onSuccess={(r) => { void handleDocBUploaded(r); }}
          label="Upload Document B"
          submitLabel="Analyze Document B"
        />
      )}

      {/* ── Analyzing B ───────────────────────────────────────────────── */}
      {phase === "analyzing_b" && (
        <LoadingState
          label="Analyzing Document B…"
          onCancel={handleCancelAnalysis}
        />
      )}

      {/* ── Ready to compare ──────────────────────────────────────────── */}
      {phase === "ready" && docBAnalysis && (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-sm" style={{ color: "var(--foreground)" }}>
            Both documents are ready.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => { void handleCompare(); }}
              className="gap-2"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              aria-label="Compare the two documents"
            >
              <ArrowLeftRight size={14} aria-hidden="true" />
              Compare Documents
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetB}
              className="min-h-[44px] sm:min-h-0 h-auto px-3 py-2 sm:px-2.5 sm:py-1.5 text-xs inline-flex items-center"
              style={{ color: "var(--muted-foreground)" }}
            >
              Change Document B
            </Button>
          </div>
        </div>
      )}

      {/* ── Comparing ─────────────────────────────────────────────────── */}
      {phase === "comparing" && (
        <LoadingState label="Aligning clauses across documents…" />
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {phase === "error" && (
        <div className="space-y-3">
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={resetB}>
            <RotateCcw size={13} aria-hidden="true" className="mr-1.5" />
            Start over
          </Button>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────── */}
      {phase === "done" && compareResult && (
        <section aria-labelledby="compare-results-heading">
          <div className="mb-6 flex items-center justify-between">
            <h2
              id="compare-results-heading"
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {compareResult.aligned_count} aligned ·{" "}
              {compareResult.only_in_a_count} only in A ·{" "}
              {compareResult.only_in_b_count} only in B
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetB}
              className="gap-1.5 text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              <RotateCcw size={12} aria-hidden="true" />
              New comparison
            </Button>
          </div>
          <CompareTable
            entries={compareResult.comparisons}
            docALabel={`Doc A (${compareResult.doc_a_type})`}
            docBLabel={`Doc B (${compareResult.doc_b_type})`}
          />
        </section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DocLabel({
  label,
  type,
  ready,
}: {
  label: string;
  type?: string;
  ready: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-4 py-3"
      style={{
        background: "var(--card)",
        borderColor: ready ? "var(--primary)" : "var(--border)",
      }}
    >
      <FileText
        size={16}
        aria-hidden="true"
        style={{ color: ready ? "var(--primary)" : "var(--muted-foreground)" }}
      />
      <div>
        <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
          {label}
        </p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {ready && type ? type.replace(/_/g, " ") : "Not yet uploaded"}
        </p>
      </div>
    </div>
  );
}

function LoadingState({ label, onCancel }: { label: string; onCancel?: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-12"
      role="status"
      aria-label={label}
    >
      <Loader2
        size={28}
        className="animate-spin"
        style={{ color: "var(--primary)" }}
        aria-hidden="true"
      />
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </p>
      {onCancel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="min-h-[44px] sm:min-h-0 h-auto px-3 py-2 sm:px-2 sm:py-1 gap-1.5 text-xs font-normal inline-flex items-center"
          style={{ color: "var(--muted-foreground)" }}
        >
          <X size={13} aria-hidden="true" />
          Cancel
        </Button>
      )}
    </div>
  );
}
