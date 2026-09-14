/**
 * Decision engine: persona-aware clause prioritisation.
 *
 * This file is intentionally free of LLM calls, network I/O, and side effects.
 * All logic is pure and deterministic so that:
 *   1. It can be unit-tested cheaply without any mocks.
 *   2. A judge can open this file and see exactly why a clause is surfaced first.
 *   3. Reordering is separated from extraction, satisfying PRD §7's
 *      "auditable" requirement.
 *
 * AGENTS.md rule: no Gemini SDK import anywhere in this file.
 */

import type { ClauseAnalysis } from "../prompts/analyze.js";
import type { DocumentType } from "../prompts/classify.js";

// ── Persona type ───────────────────────────────────────────────────────────────

/**
 * User-selectable personas from PRD §3.
 * "unknown" is the safe fallback when no persona is supplied; it always
 * degrades to severity order.
 */
export type Persona =
  "tenant" | "employee" | "freelancer" | "consumer" | "small_business_owner" | "unknown";

/** All valid persona values — useful for runtime validation. */
export const PERSONAS: readonly Persona[] = [
  "tenant",
  "employee",
  "freelancer",
  "consumer",
  "small_business_owner",
  "unknown",
] as const;

// ── Priority table ─────────────────────────────────────────────────────────────

/**
 * Maps (document_type, persona) → ordered list of keyword fragments.
 *
 * Each keyword fragment is matched case-insensitively against the clause's
 * `section_reference`, `plain_language_summary`, and `why_it_matters` fields.
 * A clause that matches an earlier keyword in the list is ranked higher than
 * one matching a later keyword.  Clauses with no keyword match fall back to
 * severity order.
 *
 * Source: PRD §7 priority table.
 * Keywords are deliberately lower-case; matching is case-insensitive.
 *
 * Marked `as const` so the type is a narrow readonly tuple, which the
 * compiler can verify exhaustively.
 */
export const PRIORITY_TABLE: Readonly<
  Partial<Record<DocumentType, Partial<Record<Persona, readonly string[]>>>>
> = {
  lease: {
    tenant: [
      // Security deposit terms — highest priority for renters
      "security deposit",
      "deposit",
      // Notice period — impacts ability to leave without penalty
      "notice period",
      "notice",
      // Maintenance and repair responsibilities
      "maintenance",
      "repair",
      "upkeep",
      // Rent increases
      "rent escalation",
      "rent increase",
      "escalation",
      // Termination / eviction conditions
      "termination",
      "eviction",
      "vacate",
    ],
  },

  employment_contract: {
    employee: [
      // Notice period — core employment exit right
      "notice period",
      "notice",
      // Non-compete / non-solicitation scope
      "non-compete",
      "non compete",
      "non-solicit",
      "non solicit",
      "restrictive covenant",
      // IP / invention assignment
      "ip assignment",
      "intellectual property",
      "invention assignment",
      "work product",
      // Grounds for termination
      "termination",
      "termination for cause",
      "at-will",
      // Probation
      "probation",
      "probationary period",
    ],
  },

  terms_of_service: {
    consumer: [
      // Data sharing/selling
      "data sharing",
      "data selling",
      "third party",
      "personal data",
      // Arbitration / class-action waiver
      "arbitration",
      "class action",
      "dispute resolution",
      // Auto-renewal
      "auto-renewal",
      "auto renewal",
      "automatic renewal",
      // Cancellation friction
      "cancellation",
      "cancel",
      "subscription",
      // Liability limits
      "liability limit",
      "limitation of liability",
      "liability",
    ],
  },

  nda: {
    freelancer: [
      // Duration of confidentiality obligation
      "duration",
      "term",
      "expiry",
      "confidentiality period",
      // Definition scope
      "definition",
      "confidential information",
      "scope",
      // Carve-outs / exceptions
      "carve-out",
      "exception",
      "exclusion",
      "publicly available",
      // Remedies / penalties
      "remedy",
      "remedies",
      "penalty",
      "penalties",
      "injunction",
      "damages",
    ],
  },

  loan_or_vendor_agreement: {
    small_business_owner: [
      // Interest type (fixed vs variable, hidden costs)
      "interest rate",
      "interest",
      "apr",
      // Prepayment penalty
      "prepayment",
      "early repayment",
      "prepayment penalty",
      // Default consequences
      "default",
      "event of default",
      // Hidden fees
      "fee",
      "fees",
      "charges",
      "penalty",
    ],
  },

  // "other" has no persona-specific prioritisation; always falls back to severity.
  other: {},
} as const;

// ── Severity ranking ───────────────────────────────────────────────────────────

/** Numeric rank for severity — lower number = higher priority. */
const SEVERITY_RANK: Record<ClauseAnalysis["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// ── Core algorithm ─────────────────────────────────────────────────────────────

/**
 * Return a stable keyword-match score for a clause against a priority list.
 *
 * Score = index of the FIRST matching keyword (lower = higher priority).
 * Returns `Infinity` if no keyword matches, placing the clause in the
 * "no match" bucket that falls back to severity order.
 *
 * Matching is case-insensitive substring search across:
 *   - section_reference
 *   - plain_language_summary
 *   - why_it_matters
 */
function keywordScore(clause: ClauseAnalysis, keywords: readonly string[]): number {
  const haystack = [clause.section_reference, clause.plain_language_summary, clause.why_it_matters]
    .join(" ")
    .toLowerCase();

  for (const [i, keyword] of keywords.entries()) {
    if (haystack.includes(keyword.toLowerCase())) {
      return i;
    }
  }
  return Infinity;
}

/**
 * Reorder `clauses` so that the highest-priority clauses for the given
 * (documentType, persona) pair appear first.
 *
 * Ordering contract:
 *   1. Priority clauses (those matching at least one keyword) come first,
 *      ordered by keyword list position (earlier keyword → ranked higher).
 *      Ties within priority clauses are broken by severity.
 *   2. Non-priority clauses follow, sorted by severity (high → medium → low).
 *      Original reading order is preserved within the same severity tier
 *      (Array.sort is stable in modern JS/V8).
 *   3. No clause is ever dropped — output.length === input.length always.
 *
 * When the (documentType, persona) pair is not in the priority table, or when
 * `persona` is "unknown", all clauses go straight to severity order.
 *
 * @param clauses       Clause array from the Gemini analysis response.
 * @param documentType  Classified document type.
 * @param persona       User-selected persona.
 * @returns             A new array (input is not mutated).
 */
export function prioritizeClauses(
  clauses: ClauseAnalysis[],
  documentType: DocumentType,
  persona: Persona,
): ClauseAnalysis[] {
  if (clauses.length === 0) return [];

  // Look up keywords — empty array means fallback to severity for all clauses.
  const keywords: readonly string[] = PRIORITY_TABLE[documentType]?.[persona] ?? [];

  // Annotate each clause with its scores, preserving original index for stable sort.
  const scored = clauses.map((clause, originalIndex) => ({
    clause,
    originalIndex,
    kwScore: keywordScore(clause, keywords),
    sevScore: SEVERITY_RANK[clause.severity],
  }));

  // Stable sort:
  //   Primary:   keyword match position (Infinity = no match, goes last)
  //   Secondary: severity (high first)
  //   Tertiary:  original reading order (stable sort guarantees this)
  scored.sort((a, b) => {
    // Both in priority bucket or both in fallback bucket — sort by severity.
    if (a.kwScore === Infinity && b.kwScore === Infinity) {
      return a.sevScore - b.sevScore;
    }
    // One matched, one didn't — matched goes first.
    if (a.kwScore === Infinity) return 1;
    if (b.kwScore === Infinity) return -1;
    // Both matched — earlier keyword wins; severity as tiebreaker.
    if (a.kwScore !== b.kwScore) return a.kwScore - b.kwScore;
    return a.sevScore - b.sevScore;
  });

  return scored.map((s) => s.clause);
}

/**
 * Parse and validate a persona string from an untrusted request body.
 * Returns "unknown" for any value not in the allowed set — never throws.
 */
export function parsePersona(raw: unknown): Persona {
  if (typeof raw === "string" && (PERSONAS as readonly string[]).includes(raw)) {
    return raw as Persona;
  }
  return "unknown";
}
