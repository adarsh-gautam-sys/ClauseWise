/**
 * Unit tests for backend/src/lib/renderMarkdown.ts
 *
 * Pure function — no mocks, no network, no file I/O.
 */

import { describe, it, expect } from "vitest";
import { renderExportMarkdown, type ExportRenderInput } from "./renderMarkdown.js";

/** Minimal valid input. */
function makeInput(overrides: Partial<ExportRenderInput> = {}): ExportRenderInput {
  return {
    documentType: "lease",
    persona: "tenant",
    summary: "This is a residential lease agreement for one year.",
    checklist: ["Read the security deposit clause carefully.", "Confirm the notice period."],
    lawyerQuestions: ["Under clause 4, can the landlord increase rent mid-term?"],
    date: "2025-09-14",
    ...overrides,
  };
}

describe("renderExportMarkdown", () => {
  it("includes the document type in the heading", () => {
    const md = renderExportMarkdown(makeInput({ documentType: "lease" }));
    expect(md).toContain("# ClauseWise Export — Lease");
  });

  it("converts snake_case document types to readable labels", () => {
    const md = renderExportMarkdown(makeInput({ documentType: "employment_contract" }));
    expect(md).toContain("Employment Contract");
  });

  it("renders 'loan_or_vendor_agreement' with slash separator", () => {
    const md = renderExportMarkdown(makeInput({ documentType: "loan_or_vendor_agreement" }));
    expect(md).toContain("Loan / Vendor Agreement");
  });

  it("includes persona label", () => {
    const md = renderExportMarkdown(makeInput({ persona: "tenant" }));
    expect(md).toContain("**Persona:** Tenant");
  });

  it("converts 'unknown' persona to 'General Reader'", () => {
    const md = renderExportMarkdown(makeInput({ persona: "unknown" }));
    expect(md).toContain("General Reader");
  });

  it("converts multi-word persona to title case", () => {
    const md = renderExportMarkdown(makeInput({ persona: "small_business_owner" }));
    expect(md).toContain("Small Business Owner");
  });

  it("includes the date", () => {
    const md = renderExportMarkdown(makeInput({ date: "2025-09-14" }));
    expect(md).toContain("2025-09-14");
  });

  it("includes the document summary", () => {
    const summary = "This lease covers a one-bedroom apartment.";
    const md = renderExportMarkdown(makeInput({ summary }));
    expect(md).toContain(summary);
  });

  it("renders checklist items with GFM checkbox syntax", () => {
    const md = renderExportMarkdown(
      makeInput({ checklist: ["Read clause 4.", "Negotiate the deposit."] }),
    );
    expect(md).toContain("- [ ] Read clause 4.");
    expect(md).toContain("- [ ] Negotiate the deposit.");
  });

  it("renders lawyer questions as a numbered list", () => {
    const md = renderExportMarkdown(
      makeInput({ lawyerQuestions: ["Is clause 3 enforceable?", "What does clause 8 mean?"] }),
    );
    expect(md).toContain("1. Is clause 3 enforceable?");
    expect(md).toContain("2. What does clause 8 mean?");
  });

  it("includes section headings for checklist and lawyer questions", () => {
    const md = renderExportMarkdown(makeInput());
    expect(md).toContain("## Action Checklist");
    expect(md).toContain("## Questions for Your Lawyer");
  });

  it("includes the disclaimer footer", () => {
    const md = renderExportMarkdown(makeInput());
    expect(md).toContain("does not constitute legal advice");
    expect(md).toContain("---");
  });

  it("handles empty checklist gracefully", () => {
    const md = renderExportMarkdown(makeInput({ checklist: [] }));
    expect(md).toContain("No checklist items generated");
    expect(md).not.toContain("- [ ]");
  });

  it("handles empty lawyer questions gracefully", () => {
    const md = renderExportMarkdown(makeInput({ lawyerQuestions: [] }));
    expect(md).toContain("No lawyer questions generated");
  });

  it("trims whitespace from checklist items and questions", () => {
    const md = renderExportMarkdown(
      makeInput({
        checklist: ["  Read the lease.  "],
        lawyerQuestions: ["  Is this fair?  "],
      }),
    );
    expect(md).toContain("- [ ] Read the lease.");
    expect(md).toContain("1. Is this fair?");
  });

  it("returns a non-empty string", () => {
    expect(renderExportMarkdown(makeInput()).length).toBeGreaterThan(50);
  });
});
