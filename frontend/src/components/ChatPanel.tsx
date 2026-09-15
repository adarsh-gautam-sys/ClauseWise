/**
 * ChatPanel
 *
 * Q&A chat UI. Calls POST /api/documents/:id/ask.
 *
 * Each AI response:
 *   - Shows the answer text
 *   - Shows cited_sections as clickable badge buttons that call onScrollToClause
 *   - When in_scope=false: shows an out-of-scope banner with "Add to lawyer
 *     questions" action (calls onAddOutOfScope)
 *
 * ARIA live region announces every new AI response so screen reader users
 * are notified without waiting silently (PRD §11).
 */

import { useState, useRef, useEffect, useId } from "react";
import { Send, Loader2, BookOpen, AlertTriangle, PlusCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { askQuestion } from "@/lib/api";
import type { ChatMessage } from "@/types";

const MAX_Q_CHARS = 500;

interface ChatPanelProps {
  documentId: string;
  onScrollToClause: (clauseId: string) => void;
  onAddOutOfScope: (question: string) => void;
  outOfScopeAdded: Set<string>;
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

// ── Assistant bubble ──────────────────────────────────────────────────────────

interface AssistantBubbleProps {
  msg: ChatMessage;
  onScrollToClause: (id: string) => void;
  onAddOutOfScope: (q: string) => void;
  alreadyAdded: boolean;
}

function AssistantBubble({
  msg,
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
          style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)" }}
        >
          {msg.answer}
        </div>

        {/* Cited sections */}
        {msg.in_scope && msg.cited_sections && msg.cited_sections.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span
              className="flex items-center gap-1 text-[11px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <BookOpen size={11} aria-hidden="true" />
              Cited:
            </span>
            {msg.cited_sections.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onScrollToClause(sec)}
                className="rounded border px-2 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80"
                style={{
                  borderColor: "var(--primary)",
                  color: "var(--primary)",
                  background: "transparent",
                }}
                aria-label={`Jump to clause: ${sec}`}
              >
                {sec}
              </button>
            ))}
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
                <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>
                  This question could not be answered from the document. Add it
                  to your lawyer questions list for your export.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAdd}
                  disabled={added}
                  className="mt-1.5 h-auto px-0 py-0.5 text-xs"
                  style={{ color: added ? "var(--severity-low)" : "var(--primary)" }}
                  aria-label={
                    added
                      ? "Added to lawyer questions"
                      : "Add this question to lawyer questions"
                  }
                >
                  {added ? (
                    <><Check size={11} aria-hidden="true" className="mr-1" />Added to lawyer questions</>
                  ) : (
                    <><PlusCircle size={11} aria-hidden="true" className="mr-1" />Add to lawyer questions</>
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

export function ChatPanel({
  documentId,
  onScrollToClause,
  onAddOutOfScope,
  outOfScopeAdded,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const liveId = useId();
  const inputId = useId();

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      question: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSendError(null);
    setLoading(true);

    try {
      const result = await askQuestion(documentId, q);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        question: q,          // keep for "add to lawyer questions"
        answer: result.answer,
        cited_sections: result.cited_sections,
        in_scope: result.in_scope,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setLastAnswer(result.answer); // triggers live region
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
      // Remove the user message on hard failure so they can retry
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
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
              <BookOpen size={28} style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                Ask anything about your document
              </p>
              <p className="max-w-xs text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                Answers are grounded in the document text only and include clause
                citations. Legal disclaimer applies — this is not legal advice.
              </p>
            </div>
          )}

          {messages.map((msg) =>
            msg.role === "user" ? (
              <UserBubble key={msg.id} question={msg.question ?? ""} />
            ) : (
              <AssistantBubble
                key={msg.id}
                msg={msg}
                onScrollToClause={onScrollToClause}
                onAddOutOfScope={onAddOutOfScope}
                alreadyAdded={
                  msg.question ? outOfScopeAdded.has(msg.question) : false
                }
              />
            ),
          )}

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

      {/* ── Send error ────────────────────────────────────────────────────── */}
      {sendError && (
        <Alert variant="destructive" className="mx-1 mt-2" role="alert">
          <AlertDescription className="text-xs">{sendError}</AlertDescription>
        </Alert>
      )}

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
              onChange={(e) => setInput(e.target.value.slice(0, MAX_Q_CHARS))}
              onKeyDown={handleKeyDown}
              placeholder="Ask about a clause, deadline, or term…"
              disabled={loading}
              maxLength={MAX_Q_CHARS}
              aria-describedby={`${inputId}-counter`}
              className="border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
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
            onClick={() => void handleSend()}
            disabled={loading || !input.trim()}
            className="h-8 w-8 flex-shrink-0 rounded-lg"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
            aria-label="Send question"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={14} aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      <p className="mt-2 text-center text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        Answers come from your document only. Not legal advice.
      </p>
    </div>
  );
}
