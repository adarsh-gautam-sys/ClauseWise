/**
 * PlaceholderScreen
 *
 * Shown for Compare and Q&A tabs when no document has been analyzed yet.
 * Communicates a gate ("do this first") not an error or "coming soon."
 *
 * Uses an arrow icon + clear action direction so users understand
 * the tab is functional but requires completing the Understand step.
 */

import { ArrowLeft, Lock } from "lucide-react";

interface PlaceholderScreenProps {
  title: string;
  description: string;
}

export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <div
        className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border px-8 py-10"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
        }}
      >
        {/* Lock icon — signals "gated", not broken */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: "var(--muted)" }}
          aria-hidden="true"
        >
          <Lock size={18} style={{ color: "var(--muted-foreground)" }} />
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            {title}
          </h2>
          <p
            className="mt-1.5 text-sm leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            {description}
          </p>
        </div>

        {/* Direction hint */}
        <p
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: "var(--primary)" }}
        >
          <ArrowLeft size={12} aria-hidden="true" />
          Start on the Understand tab
        </p>
      </div>
    </div>
  );
}
