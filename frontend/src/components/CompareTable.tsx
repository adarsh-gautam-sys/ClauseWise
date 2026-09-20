/**
 * CompareTable
 *
 * Renders the comparison result from POST /api/documents/compare.
 *
 * Three row types:
 * 1. aligned     — both docs have this clause; shows topic, both summaries,
 *                  change description, and which doc it favors.
 * 2. only_in_a   — exists only in Document A.
 * 3. only_in_b   — exists only in Document B.
 *
 * "Favors" indicator:
 *   Uses BOTH an icon and a text label — never color alone.
 *   doc_a  → "← Favors A" (ArrowLeft)
 *   doc_b  → "→ Favors B" (ArrowRight)
 *   neutral → "= Neutral"  (Minus)
 *
 * Accessibility:
 *   - Table with proper <thead>/<tbody>, scope="col" headers.
 *   - Favor icons are aria-hidden; the text carries the meaning.
 *   - Color used additionally (not solely) on favor cells.
 */

import { ArrowLeft, ArrowRight, Minus, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { ComparisonEntry, FavorsValue } from "@/types";

// ── Favors indicator ──────────────────────────────────────────────────────────

const FAVORS_META: Record<
  FavorsValue,
  { label: string; Icon: React.ElementType; color: string }
> = {
  doc_a: { label: "Favors A", Icon: ArrowLeft,  color: "var(--severity-low)" },
  doc_b: { label: "Favors B", Icon: ArrowRight, color: "var(--severity-medium)" },
  neutral: { label: "Neutral",  Icon: Minus,      color: "var(--muted-foreground)" },
};

function FavorsCell({ favors }: { favors: FavorsValue }) {
  const { label, Icon, color } = FAVORS_META[favors];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{ color }}
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────

interface CompareTableProps {
  entries: ComparisonEntry[];
  docALabel: string;
  docBLabel: string;
}

export function CompareTable({ entries, docALabel, docBLabel }: CompareTableProps) {
  const aligned = entries.filter((e) => e.match_type === "aligned") as Extract<ComparisonEntry, { match_type: "aligned" }>[];
  const onlyA   = entries.filter((e) => e.match_type === "only_in_a") as Extract<ComparisonEntry, { match_type: "only_in_a" | "only_in_b" }>[];
  const onlyB   = entries.filter((e) => e.match_type === "only_in_b") as Extract<ComparisonEntry, { match_type: "only_in_a" | "only_in_b" }>[];

  return (
    <div className="flex flex-col gap-8">

      {/* ── Aligned clauses ─────────────────────────────────────────────── */}
      {aligned.length > 0 && (
        <section aria-labelledby="aligned-heading">
          <h2
            id="aligned-heading"
            className="mb-3 text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Clause comparisons ({aligned.length})
          </h2>

          {/* Responsive: on mobile stack; on sm+ use table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <table
              className="w-full border-collapse text-sm"
              aria-label="Clause comparison table"
            >
              <thead>
                <tr style={{ background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                  {["Topic", docALabel, docBLabel, "What changed", "Favors"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-4 py-2.5 text-left text-xs font-semibold"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aligned.map((entry, i) => (
                  <tr
                    key={i}
                    className="border-t transition-colors"
                    style={{
                      borderColor: "var(--border)",
                      background: i % 2 === 0 ? "var(--card)" : "var(--muted)",
                    }}
                  >
                    <td
                      className="px-4 py-3 text-xs font-medium align-top"
                      style={{ color: "var(--foreground)", minWidth: "110px" }}
                    >
                      {entry.topic}
                    </td>
                    <td
                      className="px-4 py-3 text-xs align-top leading-relaxed"
                      style={{ color: "var(--muted-foreground)", minWidth: "160px" }}
                    >
                      {entry.doc_a_summary}
                    </td>
                    <td
                      className="px-4 py-3 text-xs align-top leading-relaxed"
                      style={{ color: "var(--muted-foreground)", minWidth: "160px" }}
                    >
                      {entry.doc_b_summary}
                    </td>
                    <td
                      className="px-4 py-3 text-xs align-top leading-relaxed"
                      style={{ color: "var(--foreground)", minWidth: "160px" }}
                    >
                      {entry.change_description || "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <FavorsCell favors={entry.favors} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card stack */}
          <div className="flex flex-col gap-3 sm:hidden">
            {aligned.map((entry, i) => (
              <div
                key={i}
                className="rounded-xl border p-4 text-sm"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium" style={{ color: "var(--foreground)" }}>
                    {entry.topic}
                  </span>
                  <FavorsCell favors={entry.favors} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <div>
                    <p className="mb-1 font-semibold" style={{ color: "var(--foreground)" }}>{docALabel}</p>
                    <p>{entry.doc_a_summary}</p>
                  </div>
                  <div>
                    <p className="mb-1 font-semibold" style={{ color: "var(--foreground)" }}>{docBLabel}</p>
                    <p>{entry.doc_b_summary}</p>
                  </div>
                </div>
                {entry.change_description && (
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>
                    {entry.change_description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Only in A / B ────────────────────────────────────────────────── */}
      {(onlyA.length > 0 || onlyB.length > 0) && (
        <>
          <Separator style={{ background: "var(--border)" }} />
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Only in A */}
            <section aria-labelledby="only-a-heading">
              <h2
                id="only-a-heading"
                className="mb-3 flex items-center gap-2 text-sm font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                <AlertCircle
                  size={14}
                  aria-hidden="true"
                  style={{ color: "var(--severity-medium)" }}
                />
                Only in {docALabel} ({onlyA.length})
              </h2>
              <ul className="flex flex-col gap-2">
                {onlyA.map((entry, i) => (
                  <li
                    key={i}
                    className="rounded-lg border p-3 text-xs leading-relaxed"
                    style={{ background: "var(--card)", borderColor: "var(--border)" }}
                  >
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>
                      {entry.topic}
                    </p>
                    <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>
                      {entry.summary}
                    </p>
                  </li>
                ))}
                {onlyA.length === 0 && (
                  <li className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    All clauses have a match in {docBLabel}.
                  </li>
                )}
              </ul>
            </section>

            {/* Only in B */}
            <section aria-labelledby="only-b-heading">
              <h2
                id="only-b-heading"
                className="mb-3 flex items-center gap-2 text-sm font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                <AlertCircle
                  size={14}
                  aria-hidden="true"
                  style={{ color: "var(--severity-medium)" }}
                />
                Only in {docBLabel} ({onlyB.length})
              </h2>
              <ul className="flex flex-col gap-2">
                {onlyB.map((entry, i) => (
                  <li
                    key={i}
                    className="rounded-lg border p-3 text-xs leading-relaxed"
                    style={{ background: "var(--card)", borderColor: "var(--border)" }}
                  >
                    <p className="font-medium" style={{ color: "var(--foreground)" }}>
                      {entry.topic}
                    </p>
                    <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>
                      {entry.summary}
                    </p>
                  </li>
                ))}
                {onlyB.length === 0 && (
                  <li className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    All clauses have a match in {docALabel}.
                  </li>
                )}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
