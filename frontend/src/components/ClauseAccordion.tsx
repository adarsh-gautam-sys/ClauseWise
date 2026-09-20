/**
 * ClauseAccordion
 *
 * Renders the prioritized clause list as a shadcn Accordion.
 * Each item shows:
 *   - Header (always visible): section_reference + SeverityBadge + tag chip
 *   - Body (expanded): plain_language_summary + why_it_matters
 *
 * Each clause root element gets id={clause.clause_id} so the Q&A panel's
 * cited-section links can scrollIntoView() to it.
 *
 * Accessibility:
 *   - shadcn Accordion uses Radix UI — keyboard nav, ARIA expanded,
 *     ARIA controls all handled internally.
 *   - Tag chip has aria-label explaining the tag meaning.
 *   - SeverityBadge always pairs color with text label.
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SeverityBadge } from "@/components/SeverityBadge";
import { cn } from "@/lib/utils";
import type { Clause, ClauseTag } from "@/types";

// ── Tag metadata ──────────────────────────────────────────────────────────────

const TAG_META: Record<ClauseTag, { label: string; description: string; style: string }> = {
  obligation: {
    label: "Obligation",
    description: "Something you must do",
    style: "border-[var(--border)] text-[var(--muted-foreground)]",
  },
  right: {
    label: "Right",
    description: "Something you are entitled to",
    style: "border-[var(--severity-low)] text-[var(--severity-low)]",
  },
  risk: {
    label: "Risk",
    description: "A clause that could harm your interests",
    style: "border-[var(--severity-high)] text-[var(--severity-high)]",
  },
  standard: {
    label: "Standard",
    description: "A typical boilerplate clause",
    style: "border-[var(--border)] text-[var(--muted-foreground)]",
  },
};

// ── Tag chip ──────────────────────────────────────────────────────────────────

function TagChip({ tag }: { tag: ClauseTag }) {
  const meta = TAG_META[tag];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium",
        meta.style,
      )}
      aria-label={`Tag: ${meta.label} — ${meta.description}`}
    >
      {meta.label}
    </span>
  );
}

// ── Clause card ───────────────────────────────────────────────────────────────

interface ClauseCardProps {
  clause: Clause;
  defaultOpen?: boolean;
}

function ClauseCard({ clause, defaultOpen = false }: ClauseCardProps) {
  return (
    <AccordionItem
      value={clause.clause_id}
      // id is the anchor for Q&A cited-section scroll links
      id={clause.clause_id}
      className="rounded-xl border transition-colors"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
      }}
      data-default-open={defaultOpen}
    >
      <AccordionTrigger className="px-4 py-3.5 rounded-lg transition-colors hover:bg-[var(--muted)] [&>svg]:flex-shrink-0">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left">
          {/* Section reference */}
          <span
            className="min-w-0 flex-1 truncate text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            {clause.section_reference}
          </span>
          {/* Badges — flex-shrink-0 prevents wrap on narrow screens */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <TagChip tag={clause.tag} />
            <SeverityBadge level={clause.severity} />
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4 pt-0">
        {/* Plain-language summary */}
        <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
          {clause.plain_language_summary}
        </p>

        {/* Why it matters — inset shadow instead of banned border-l-2 */}
        <div
          className="mt-3 rounded-lg px-3 py-2.5"
          style={{
            background: "var(--muted)",
            boxShadow:
              clause.severity === "high"
                ? "inset 3px 0 0 var(--severity-high)"
                : clause.severity === "medium"
                  ? "inset 3px 0 0 var(--severity-medium)"
                  : "inset 3px 0 0 var(--severity-low)",
          }}
        >
          <p
            className="mb-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)" }}
          >
            Why it matters
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
            {clause.why_it_matters}
          </p>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ── Accordion list ────────────────────────────────────────────────────────────

interface ClauseAccordionProps {
  clauses: Clause[];
}

export function ClauseAccordion({ clauses }: ClauseAccordionProps) {
  if (clauses.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
        No clauses were found in this document.
      </p>
    );
  }

  // Open the first (highest priority) clause by default.
  const defaultValue = clauses[0]?.clause_id;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultValue}
      className="flex flex-col gap-2"
    >
      {clauses.map((clause, i) => (
        <ClauseCard key={clause.clause_id} clause={clause} defaultOpen={i === 0} />
      ))}
    </Accordion>
  );
}
