/**
 * QAPage
 *
 * Q&A tab. Requires the document to be analyzed first (gated in App.tsx).
 * Renders ChatPanel, passing through the scroll-to-clause callback and
 * the out-of-scope question accumulator.
 */

import { MessageSquare } from "lucide-react";
import { ChatPanel } from "@/components/ChatPanel";
import type { AnalysisResult } from "@/types";

interface QAPageProps {
  analysisResult: AnalysisResult;
  onScrollToClause: (clauseId: string) => void;
  onAddOutOfScope: (question: string) => void;
  outOfScopeAdded: Set<string>;
}

export function QAPage({
  analysisResult,
  onScrollToClause,
  onAddOutOfScope,
  outOfScopeAdded,
}: QAPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          aria-hidden="true"
        >
          <MessageSquare size={15} strokeWidth={2} />
        </div>
        <div>
          <h1
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            Ask about your document
          </h1>
          <p
            className="mt-0.5 text-xs leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            Questions are answered from{" "}
            <strong style={{ color: "var(--foreground)" }}>
              {analysisResult.document_type.replace(/_/g, " ")}
            </strong>{" "}
            only. Cited clause references link back to the Understand tab. Out-of-scope questions
            can be added to your lawyer export.
          </p>
        </div>
      </div>

      {/* ── Chat panel ───────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-4"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <ChatPanel
          documentId={analysisResult.documentId}
          clauses={analysisResult.clauses}
          onScrollToClause={onScrollToClause}
          onAddOutOfScope={onAddOutOfScope}
          outOfScopeAdded={outOfScopeAdded}
        />
      </div>

      {/* ── Disclaimer ───────────────────────────────────────────────── */}
      <p
        className="text-center text-[11px] leading-relaxed"
        style={{ color: "var(--muted-foreground)" }}
      >
        Answers are grounded in your document text only. ClauseWise never predicts legal outcomes or
        gives a definitive legal opinion. Always consult a qualified lawyer before acting on any
        analysis.
      </p>
    </div>
  );
}
