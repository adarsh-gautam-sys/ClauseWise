/**
 * ChatPanel
 *
 * Hardened Q&A chat UI. Calls POST /api/documents/:id/ask.
 *
 * Hardening changes (impeccable harden pass):
 *
 * 1. ERROR RESILIENCE: Hard errors no longer delete the user's message.
 *    Instead an inline ErrorBubble appears below the user's question with
 *    "Failed — Retry →" that re-sends the same question. User never loses
 *    their phrasing.
 *
 * 2. CITATION RESOLUTION: cited_sections strings from the API are matched
 *    against the known clause list (clauses prop) by section_reference.
 *    Matching is case-insensitive substring. If a match is found, the
 *    button shows the section_reference name and scrolls to clause_id.
 *    Unmatched strings are shown as-is (defensive fallback).
 *
 * 3. ABORT: askQuestion is called with an AbortController signal; unmount
 *    cancels any in-flight request to prevent setState on unmounted component.
 *
 * ARIA live region (role="log") announces every new AI answer.
 */

import {
  useState,
  useRef,
  useEffect,
  useId,
  useCallback,
} from "react";
import {
  Send,
  Loader2,
  BookOpen,
  AlertTriangle,
  PlusCircle,
  Check,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askQuestion } from "@/lib/api";
import type { ChatMessage, Clause } from "@/types";

const MAX_Q_CHARS = 500;

// ── Cited-section resolution ──────────────────────────────────────────────────
// Match a cited_section string against the known clause list by section_reference.
// Returns { label: displayText, clauseId: scrollTarget } or null for no match.

interface ResolvedCitation {
  label: string;
  clauseId: string;
}

function resolveCitation(
  rawSec: string,
  clauses: Clause[],
): ResolvedCitation | null {
  const needle = rawSec.trim().toLowerCase();
  const match = clauses.find(
    (c) =>
      c.section_reference.toLowerCase().includes(needle) ||
      needle.includes(c.section_reference.toLowerCase()) ||
      c.clause_id.toLowerCase() === needle,
  );
  if (match) {
    return { label: match.section_reference, clauseId: match.clause_id };
  }
  return null;
}

// ── User bubble ───────────────────────────────────────────────────────────────

function UserBubble({ question }: { question: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[78%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        {question}
      </div>
    </div>
  );
}

// ── Error bubble ──────────────────────────────────────────────────────────────
// Appears below the user bubble when a request fails.
// Keeps the user's phrasing intact and offers one-click retry.

interface ErrorBubbleProps {
  errorText: string;
  onRetry: () => void;
  isRetrying: boolean;
}

function ErrorBubble({ errorText, onRetry, isRetrying }: ErrorBubbleProps) {
  return (
    <div className="flex justify-start">
      <div
        className="flex max-w-[85%] items-start gap-2 rounded-xl border px-3 py-2.5"
        style={{
          borderColor: "var(--destructive)",
          background: "oklch(from var(--destructive) l c h / 0.08)",
        }}
        role="alert"
      >
        <AlertTriangle
          size={13}
          className="mt-0.5 flex-shrink-0"
          style={{ color: "var(--destructive)" }}
          aria-hidden="true"
        />
        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className="text-xs leading-relaxed"
            style={{ color: "var(--foreground)" }}
          >
            {errorText}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className="min-h-[44px] sm:min-h-0 h-auto px-2.5 py-1.5 sm:px-0 sm:py-0.5 text-xs font-semibold inline-flex items-center"
            style={{ color: "var(--primary)" }}
            aria-label="Retry this question"
          >
            {isRetrying ? (
              <Loader2 size={11} className="mr-1 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw size={11} className="mr-1" aria-hidden="true" />
            )}
            {isRetrying ? "Retrying…" : "Retry"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Assistant bubble ──────────────────────────────────────────────────────────

interface AssistantBubbleProps {
  msg: ChatMessage;
  clauses: Clause[];
  onScrollToClause: (id: string) => void;
  onAddOutOfScope: (q: string) => void;
  alreadyAdded: boolean;
}

function AssistantBubble({
  msg,
  clauses,
  onScrollToClause,
  onAddOutOfScope,
  alreadyAdded,
}: AssistantBubbleProps) {
  const [added, setAdded] = useState(alreadyAdded);

  const handleAdd = () => {
    if (msg.question) {
      onAddOutOfScope(msg.question);
      setAdded(true);
    }
  };

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[85%] flex-col gap-2">
        {/* Answer text */}
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
          style={{
            background: "var(--card)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        >
          {msg.answer}
        </div>

        {/* Cited sections — resolved against known clauses */}
        {msg.in_scope && msg.cited_sections && msg.cited_sections.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span
              className="flex items-center gap-1 text-[11px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <BookOpen size={11} aria-hidden="true" />
              Cited:
            </span>
            {msg.cited_sections.map((rawSec) => {
              const resolved = resolveCitation(rawSec, clauses);
              const displayLabel = resolved ? resolved.label : rawSec;
              const scrollTarget = resolved ? resolved.clauseId : rawSec;

              return (
                <button
                  key={rawSec}
                  type="button"
                  onClick={() => onScrollToClause(scrollTarget)}
                  className="rounded border px-2.5 py-1 sm:py-0.5 text-xs sm:text-[11px] font-medium transition-colors hover:opacity-80 min-h-[36px] sm:min-h-0 inline-flex items-center"
                  style={{
                    borderColor: "var(--primary)",
                    color: "var(--primary)",
                    background: "transparent",
                  }}
                  aria-label={`Jump to clause: ${displayLabel}`}
                  title={rawSec !== displayLabel ? `Raw reference: ${rawSec}` : undefined}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>
        )}

        {/* Out-of-scope banner */}
        {msg.in_scope === false && (
          <div
            className="rounded-xl border px-4 py-3"
            style={{
              borderColor: "var(--severity-medium)",
              background: "var(--severity-medium-bg)",
            }}
            role="note"
            aria-label="Question outside document scope"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={14}
                className="mt-0.5 flex-shrink-0"
                style={{ color: "var(--severity-medium)" }}
                aria-hidden="true"
              />
              <div className="flex-1">
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--foreground)" }}
                >
                  This question could not be answered from the document. Add it
                  to your lawyer questions list for your export.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAdd}
                  disabled={added}
                  className="mt-1.5 min-h-[44px] sm:min-h-0 h-auto px-2 py-1.5 sm:px-0 sm:py-0.5 text-xs inline-flex items-center"
                  style={{ color: added ? "var(--severity-low)" : "var(--primary)" }}
                  aria-label={
                    added
                      ? "Added to lawyer questions"
                      : "Add this question to lawyer questions"
                  }
                >
                  {added ? (
                    <>
                      <Check size={11} aria-hidden="true" className="mr-1" />
                      Added to lawyer questions
                    </>
                  ) : (
                    <>
                      <PlusCircle size={11} aria-hidden="true" className="mr-1" />
                      Add to lawyer questions
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────

export interface ChatPanelProps {
  documentId: string;
  /** Analyzed clauses — used to resolve cited_sections to real names */
  clauses: Clause[];
  onScrollToClause: (clauseId: string) => void;
  onAddOutOfScope: (question: string) => void;
  outOfScopeAdded: Set<string>;
}

export function ChatPanel({
  documentId,
  clauses,
  onScrollToClause,
  onAddOutOfScope,
  outOfScopeAdded,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAnswer, setLastAnswer] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const liveId = useId();
  const inputId = useId();

  // Cancel any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Scroll to bottom whenever messages or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendQuestion = useCallback(
    async (question: string, replaceErrorId?: string) => {
      if (!question || loading) return;

      // Cancel any previous in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (replaceErrorId) {
        // Remove the old error bubble, keep the user message
        setMessages((prev) => prev.filter((m) => m.id !== replaceErrorId));
      } else {
        // New question — append user bubble
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", question },
        ]);
        setInput("");
      }

      setLoading(true);

      try {
        const result = await askQuestion(documentId, question, controller.signal);
        if (controller.signal.aborted) return;

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          question,
          answer: result.answer,
          cited_sections: result.cited_sections,
          in_scope: result.in_scope,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLastAnswer(result.answer);
      } catch (err) {
        if (controller.signal.aborted) return;

        // Append inline error bubble — user message stays intact
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "error",
          retryQuestion: question,
          errorText:
            err instanceof Error
              ? err.message
              : "Something went wrong. Please try again.",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [documentId, loading],
  );

  const handleSend = () => {
    void sendQuestion(input.trim());
  };

  const handleRetry = (errorMsgId: string, retryQuestion: string) => {
    void sendQuestion(retryQuestion, errorMsgId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charsLeft = MAX_Q_CHARS - input.length;
  const nearLimit = charsLeft < 80;

  return (
    <div className="flex h-full flex-col gap-0">
      {/* ── ARIA live region — announces new AI answers ─────────────────── */}
      <div
        id={liveId}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="AI responses"
        className="sr-only"
      >
        {lastAnswer}
      </div>

      {/* ── Message list ─────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 pr-1" style={{ minHeight: "340px" }}>
        <div className="flex flex-col gap-4 p-1 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <BookOpen
                size={28}
                style={{ color: "var(--muted-foreground)" }}
                aria-hidden="true"
              />
              <p
                className="text-sm font-medium"
                style={{ color: "var(--foreground)" }}
              >
                Ask anything about your document
              </p>
              <p
                className="max-w-xs text-xs leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                Answers are grounded in the document text only and include clause
                citations. Not legal advice.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.role === "user") {
              return <UserBubble key={msg.id} question={msg.question ?? ""} />;
            }
            if (msg.role === "error") {
              return (
                <ErrorBubble
                  key={msg.id}
                  errorText={msg.errorText ?? "Request failed."}
                  isRetrying={loading}
                  onRetry={() =>
                    handleRetry(msg.id, msg.retryQuestion ?? "")
                  }
                />
              );
            }
            return (
              <AssistantBubble
                key={msg.id}
                msg={msg}
                clauses={clauses}
                onScrollToClause={onScrollToClause}
                onAddOutOfScope={onAddOutOfScope}
                alreadyAdded={
                  msg.question ? outOfScopeAdded.has(msg.question) : false
                }
              />
            );
          })}

          {/* Loading indicator */}
          {loading && (
            <div
              className="flex items-center gap-2 px-1"
              role="status"
              aria-label="AI is generating an answer"
            >
              <Loader2
                size={14}
                className="animate-spin"
                style={{ color: "var(--primary)" }}
                aria-hidden="true"
              />
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Thinking…
              </span>
            </div>
          )}

          <div ref={bottomRef} aria-hidden="true" />
        </div>
      </ScrollArea>

      {/* ── Input row ────────────────────────────────────────────────────── */}
      <div
        className="mt-3 rounded-xl border p-2"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={inputId} className="sr-only">
              Ask a question about your document
            </label>
            <Input
              id={inputId}
              value={input}
              onChange={(e) =>
                setInput(e.target.value.slice(0, MAX_Q_CHARS))
              }
              onKeyDown={handleKeyDown}
              placeholder="Ask about a clause, deadline, or term…"
              disabled={loading}
              maxLength={MAX_Q_CHARS}
              aria-describedby={nearLimit ? `${inputId}-counter` : undefined}
              className="border-0 bg-transparent text-base sm:text-sm shadow-none focus-visible:ring-0"
              style={{ color: "var(--foreground)" }}
            />
            {nearLimit && (
              <p
                id={`${inputId}-counter`}
                className="px-1 text-right text-[10px] tabular-nums"
                style={{ color: "var(--severity-medium)" }}
                aria-live="polite"
              >
                {charsLeft} chars left
              </p>
            )}
          </div>
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="h-10 w-10 sm:h-8 sm:w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex-shrink-0 rounded-lg"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
            aria-label="Send question"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={15} aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      <p
        className="mt-2 text-center text-[10px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        Answers come from your document only. Not legal advice.
      </p>
    </div>
  );
}
