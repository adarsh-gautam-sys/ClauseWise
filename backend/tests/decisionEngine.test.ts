/**
 * Unit tests for backend/src/services/decisionEngine.ts
 *
 * All tests are deterministic and require no mocks — the engine is pure TS.
 *
 * Test matrix:
 *   1. lease + Tenant:              deposit / notice clauses surface first.
 *   2. employment_contract + Employee: notice / non-compete clauses first.
 *   3. Unmapped pair (nda + Tenant): falls back to severity order, no crash.
 *   4. "unknown" persona:           always falls back to severity order.
 *   5. Empty input:                 returns empty array without throwing.
 *   6. No clause is ever dropped:   output.length === input.length.
 */

import { describe, it, expect } from "vitest";
import { prioritizeClauses, parsePersona } from "../src/services/decisionEngine.js";
import type { ClauseAnalysis } from "../src/prompts/analyze.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal ClauseAnalysis with sensible defaults for fields under test. */
function makeClause(id: string, overrides: Partial<ClauseAnalysis> = {}): ClauseAnalysis {
  return {
    clause_id: id,
    section_reference: overrides.section_reference ?? `Section — ${id}`,
    plain_language_summary: overrides.plain_language_summary ?? `Summary for ${id}.`,
    tag: overrides.tag ?? "standard",
    severity: overrides.severity ?? "low",
    why_it_matters: overrides.why_it_matters ?? `Matters because of ${id}.`,
    ...overrides,
  };
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe("prioritizeClauses — lease + tenant", () => {
  const depositClause = makeClause("CLAUSE_DEPOSIT", {
    section_reference: "Security Deposit Terms",
    plain_language_summary: "You must pay a security deposit of two months' rent before moving in.",
    severity: "medium",
  });

  const noticeClause = makeClause("CLAUSE_NOTICE", {
    section_reference: "Notice Period",
    plain_language_summary: "Either party must give 30 days notice before ending the tenancy.",
    severity: "low",
  });

  const boilerplateClause = makeClause("CLAUSE_BOILERPLATE", {
    section_reference: "Governing Law",
    plain_language_summary: "This agreement is governed by local laws.",
    severity: "low",
  });

  const highSeverityUnrelated = makeClause("CLAUSE_HIGH", {
    section_reference: "Arbitration Clause",
    plain_language_summary: "All disputes go to binding arbitration.",
    severity: "high",
  });

  it("surfaces security deposit clause before unrelated clauses", () => {
    const clauses = [boilerplateClause, highSeverityUnrelated, depositClause, noticeClause];
    const result = prioritizeClauses(clauses, "lease", "tenant");

    // Deposit should appear before any non-priority clause.
    const depositIdx = result.findIndex((c) => c.clause_id === "CLAUSE_DEPOSIT");
    const boilerplateIdx = result.findIndex((c) => c.clause_id === "CLAUSE_BOILERPLATE");
    expect(depositIdx).toBeLessThan(boilerplateIdx);
  });

  it("surfaces notice period clause before unrelated clauses", () => {
    const clauses = [boilerplateClause, highSeverityUnrelated, depositClause, noticeClause];
    const result = prioritizeClauses(clauses, "lease", "tenant");

    const noticeIdx = result.findIndex((c) => c.clause_id === "CLAUSE_NOTICE");
    const boilerplateIdx = result.findIndex((c) => c.clause_id === "CLAUSE_BOILERPLATE");
    expect(noticeIdx).toBeLessThan(boilerplateIdx);
  });

  it("does not drop any clause", () => {
    const clauses = [boilerplateClause, highSeverityUnrelated, depositClause, noticeClause];
    const result = prioritizeClauses(clauses, "lease", "tenant");
    expect(result).toHaveLength(clauses.length);
  });

  it("deposit ranks before notice (deposit is earlier in the keyword list)", () => {
    const clauses = [noticeClause, depositClause];
    const result = prioritizeClauses(clauses, "lease", "tenant");
    const depositIdx = result.findIndex((c) => c.clause_id === "CLAUSE_DEPOSIT");
    const noticeIdx = result.findIndex((c) => c.clause_id === "CLAUSE_NOTICE");
    expect(depositIdx).toBeLessThan(noticeIdx);
  });
});

describe("prioritizeClauses — employment_contract + employee", () => {
  const noticeClause = makeClause("CLAUSE_NOTICE", {
    section_reference: "Notice Period",
    plain_language_summary: "You must give 3 months notice before resigning from the company.",
    severity: "high",
  });

  const nonCompeteClause = makeClause("CLAUSE_NONCOMPETE", {
    section_reference: "Non-Compete Agreement",
    plain_language_summary: "You agree not to work for a competitor for 12 months after leaving.",
    severity: "high",
  });

  const ptoClause = makeClause("CLAUSE_PTO", {
    section_reference: "Annual Leave",
    plain_language_summary: "You receive 15 days of paid annual leave per year.",
    severity: "low",
  });

  it("surfaces notice period clause at or near the top", () => {
    const clauses = [ptoClause, nonCompeteClause, noticeClause];
    const result = prioritizeClauses(clauses, "employment_contract", "employee");

    const noticeIdx = result.findIndex((c) => c.clause_id === "CLAUSE_NOTICE");
    const ptoIdx = result.findIndex((c) => c.clause_id === "CLAUSE_PTO");
    expect(noticeIdx).toBeLessThan(ptoIdx);
  });

  it("surfaces non-compete clause before unrelated low-severity clauses", () => {
    const clauses = [ptoClause, nonCompeteClause, noticeClause];
    const result = prioritizeClauses(clauses, "employment_contract", "employee");

    const nonCompeteIdx = result.findIndex((c) => c.clause_id === "CLAUSE_NONCOMPETE");
    const ptoIdx = result.findIndex((c) => c.clause_id === "CLAUSE_PTO");
    expect(nonCompeteIdx).toBeLessThan(ptoIdx);
  });

  it("does not drop any clause", () => {
    const clauses = [ptoClause, nonCompeteClause, noticeClause];
    const result = prioritizeClauses(clauses, "employment_contract", "employee");
    expect(result).toHaveLength(clauses.length);
  });
});

describe("prioritizeClauses — unmapped pair (nda + tenant)", () => {
  const highClause = makeClause("CLAUSE_HIGH", {
    section_reference: "Penalty clause",
    plain_language_summary: "Heavy damages apply for breach.",
    severity: "high",
  });

  const mediumClause = makeClause("CLAUSE_MED", {
    section_reference: "Duration",
    plain_language_summary: "Confidentiality lasts for 3 years.",
    severity: "medium",
  });

  const lowClause = makeClause("CLAUSE_LOW", {
    section_reference: "Governing Law",
    plain_language_summary: "This NDA is governed by local law.",
    severity: "low",
  });

  it("falls back to severity order without crashing", () => {
    // nda + tenant is not in the priority table — must not throw.
    expect(() =>
      prioritizeClauses([lowClause, mediumClause, highClause], "nda", "tenant"),
    ).not.toThrow();
  });

  it("orders high before medium before low in fallback", () => {
    const result = prioritizeClauses([lowClause, mediumClause, highClause], "nda", "tenant");
    const highIdx = result.findIndex((c) => c.clause_id === "CLAUSE_HIGH");
    const medIdx = result.findIndex((c) => c.clause_id === "CLAUSE_MED");
    const lowIdx = result.findIndex((c) => c.clause_id === "CLAUSE_LOW");

    expect(highIdx).toBeLessThan(medIdx);
    expect(medIdx).toBeLessThan(lowIdx);
  });

  it("does not drop any clause", () => {
    const result = prioritizeClauses([lowClause, mediumClause, highClause], "nda", "tenant");
    expect(result).toHaveLength(3);
  });
});

describe("prioritizeClauses — unknown persona", () => {
  it("always falls back to severity order", () => {
    const clauses = [
      makeClause("C1", {
        severity: "low",
        plain_language_summary: "Security deposit clause here.",
      }),
      makeClause("C2", {
        severity: "high",
        plain_language_summary: "Generic high-severity clause.",
      }),
    ];
    // Even though C1 would normally match 'tenant' keywords, 'unknown' ignores them.
    const result = prioritizeClauses(clauses, "lease", "unknown");
    const [first, second] = result;
    expect(first?.clause_id).toBe("C2"); // high severity first
    expect(second?.clause_id).toBe("C1");
  });
});

describe("prioritizeClauses — edge cases", () => {
  it("returns empty array for empty input", () => {
    expect(prioritizeClauses([], "lease", "tenant")).toEqual([]);
  });

  it("returns single-element array unchanged", () => {
    const single = makeClause("ONLY");
    const result = prioritizeClauses([single], "nda", "freelancer");
    expect(result).toHaveLength(1);
    const [only] = result;
    expect(only?.clause_id).toBe("ONLY");
  });

  it("output length always equals input length", () => {
    const clauses = Array.from({ length: 10 }, (_, i) =>
      makeClause(`C${i}`, { severity: i % 3 === 0 ? "high" : i % 3 === 1 ? "medium" : "low" }),
    );
    const result = prioritizeClauses(clauses, "employment_contract", "employee");
    expect(result).toHaveLength(clauses.length);
  });
});

describe("parsePersona", () => {
  it("accepts valid persona strings", () => {
    expect(parsePersona("tenant")).toBe("tenant");
    expect(parsePersona("employee")).toBe("employee");
    expect(parsePersona("freelancer")).toBe("freelancer");
    expect(parsePersona("consumer")).toBe("consumer");
    expect(parsePersona("small_business_owner")).toBe("small_business_owner");
    expect(parsePersona("unknown")).toBe("unknown");
  });

  it("returns 'unknown' for invalid strings", () => {
    expect(parsePersona("hacker")).toBe("unknown");
    expect(parsePersona("")).toBe("unknown");
    expect(parsePersona(null)).toBe("unknown");
    expect(parsePersona(42)).toBe("unknown");
    expect(parsePersona(undefined)).toBe("unknown");
  });
});
