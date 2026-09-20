/**
 * Shared TypeScript types for ClauseWise frontend.
 *
 * These mirror the backend response shapes exactly — if the backend schema
 * changes, update here and let TypeScript propagate the errors.
 */

// ── Document upload ───────────────────────────────────────────────────────────

export interface UploadResult {
  documentId: string;
  chunkCount: number;
  preview: string;
}

// ── Classification ────────────────────────────────────────────────────────────

export interface ClassifyResult {
  documentId: string;
  document_type: string;
  confidence: "high" | "medium" | "low";
}

// ── Clause ────────────────────────────────────────────────────────────────────

export type ClauseTag = "obligation" | "right" | "risk" | "standard";
export type SeverityLevel = "high" | "medium" | "low";

export interface Clause {
  clause_id: string;
  section_reference: string;
  plain_language_summary: string;
  tag: ClauseTag;
  severity: SeverityLevel;
  why_it_matters: string;
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  documentId: string;
  document_type: string;
  persona: string;
  summary: string;
  clauses: Clause[];
}

// ── Q&A ───────────────────────────────────────────────────────────────────────

export interface AskResult {
  documentId: string;
  answer: string;
  cited_sections: string[];
  in_scope: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  question?: string; // for user messages and error retry
  answer?: string; // for assistant messages
  cited_sections?: string[];
  in_scope?: boolean;
  addedToLawyer?: boolean; // tracked locally
  /** Error messages — retryQuestion is re-sent when user clicks Retry */
  errorText?: string;
  retryQuestion?: string;
}

// ── Compare ───────────────────────────────────────────────────────────────────

export type FavorsValue = "doc_a" | "doc_b" | "neutral";

export interface AlignedComparison {
  match_type: "aligned";
  topic: string;
  doc_a_summary: string;
  doc_b_summary: string;
  change_description: string;
  favors: FavorsValue;
}

export interface OnlyInComparison {
  match_type: "only_in_a" | "only_in_b";
  topic: string;
  summary: string;
}

export type ComparisonEntry = AlignedComparison | OnlyInComparison;

export interface CompareResult {
  doc_a_id: string;
  doc_b_id: string;
  doc_a_type: string;
  doc_b_type: string;
  aligned_count: number;
  only_in_a_count: number;
  only_in_b_count: number;
  comparisons: ComparisonEntry[];
}

// ── Export ────────────────────────────────────────────────────────────────────

export interface ExportResult {
  documentId: string;
  document_type: string;
  persona: string;
  checklist: string[];
  lawyer_questions: string[];
  markdown: string;
}
