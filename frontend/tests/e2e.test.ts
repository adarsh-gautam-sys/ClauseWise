/**
 * e2e.test.ts — End-to-End User Journey Tests for ClauseWise
 *
 * Tests three critical user flows against the Vite dev server with deterministic API responses:
 *   1. Full Understand journey: Upload/paste -> analysis -> clause view -> export checklist dialog
 *   2. Full Compare journey: Document A analyzed -> switch to Compare -> add Document B -> run compare -> view side-by-side aligned diffs
 *   3. Q&A out-of-scope refusal path: Ask off-topic question -> assert out-of-scope refusal -> add to lawyer questions
 */

import { test, expect } from "@playwright/test";

// Mock data fixtures
const MOCK_DOC_A_ID = "doc-aaa-111";
const MOCK_DOC_B_ID = "doc-bbb-222";

const MOCK_DOC_A_ANALYSIS = {
  documentId: MOCK_DOC_A_ID,
  document_type: "lease",
  persona: "tenant",
  summary:
    "This is a residential lease agreement governing the tenancy terms and deposit conditions.",
  clauses: [
    {
      clause_id: "CLAUSE_1",
      section_reference: "Section 3 — Security Deposit",
      plain_language_summary:
        "Tenant must pay two months rent as security deposit before moving in.",
      tag: "obligation",
      severity: "medium",
      why_it_matters: "Held until move-out for potential damage deductions.",
    },
    {
      clause_id: "CLAUSE_2",
      section_reference: "Section 12 — Landlord Entry",
      plain_language_summary: "Landlord may enter premises at any time without advance notice.",
      tag: "risk",
      severity: "high",
      why_it_matters: "Deprives tenant of privacy and quiet enjoyment.",
    },
  ],
};

const MOCK_DOC_B_ANALYSIS = {
  documentId: MOCK_DOC_B_ID,
  document_type: "lease",
  persona: "tenant",
  summary: "This is a revised residential lease agreement with improved tenant protections.",
  clauses: [
    {
      clause_id: "CLAUSE_1_B",
      section_reference: "Section 3 — Security Deposit",
      plain_language_summary: "Tenant must pay one month rent as security deposit.",
      tag: "obligation",
      severity: "low",
      why_it_matters: "Reduced deposit burden.",
    },
  ],
};

const MOCK_COMPARE_RESULT = {
  doc_a_id: MOCK_DOC_A_ID,
  doc_b_id: MOCK_DOC_B_ID,
  doc_a_type: "lease",
  doc_b_type: "lease",
  aligned_count: 1,
  only_in_a_count: 1,
  only_in_b_count: 0,
  comparisons: [
    {
      match_type: "aligned",
      topic: "Security Deposit",
      doc_a_summary: "Two months rent deposit required.",
      doc_b_summary: "One month rent deposit required.",
      change_description: "Document B reduces the security deposit from two months to one month.",
      favors: "doc_b",
    },
    {
      match_type: "only_in_a",
      topic: "Section 12 — Landlord Entry",
      summary: "Landlord may enter premises at any time without notice.",
    },
  ],
};

const MOCK_EXPORT_RESULT = {
  documentId: MOCK_DOC_A_ID,
  document_type: "lease",
  persona: "tenant",
  checklist: [
    "Review the security deposit refund timeline before signing.",
    "Clarify written notice requirements for landlord entry.",
  ],
  lawyer_questions: ["Is the unannounced entry clause enforceable under local tenancy law?"],
  markdown:
    "# ClauseWise Export — Lease\n\n## Action Checklist\n- [ ] Review the security deposit refund timeline before signing.\n\n## Questions for Your Lawyer\n1. Is the unannounced entry clause enforceable under local tenancy law?",
};

test.describe("ClauseWise End-to-End User Journeys", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept API routes to guarantee fast, deterministic passes with no flakiness
    await page.route("**/api/documents", async (route) => {
      const postData = route.request().postData() || "";
      const isDocB = postData.includes("Revised") || postData.includes("Document B");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          documentId: isDocB ? MOCK_DOC_B_ID : MOCK_DOC_A_ID,
          chunkCount: 3,
          preview: "Residential Lease Agreement...",
        }),
      });
    });

    await page.route(`**/api/documents/${MOCK_DOC_A_ID}/classify`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          documentId: MOCK_DOC_A_ID,
          document_type: "lease",
          confidence: "high",
        }),
      });
    });

    await page.route(`**/api/documents/${MOCK_DOC_A_ID}/analyze`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_DOC_A_ANALYSIS),
      });
    });

    await page.route(`**/api/documents/${MOCK_DOC_B_ID}/classify`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          documentId: MOCK_DOC_B_ID,
          document_type: "lease",
          confidence: "high",
        }),
      });
    });

    await page.route(`**/api/documents/${MOCK_DOC_B_ID}/analyze`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_DOC_B_ANALYSIS),
      });
    });

    await page.route(`**/api/documents/${MOCK_DOC_A_ID}/export`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_EXPORT_RESULT),
      });
    });

    await page.route("**/api/documents/compare", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_COMPARE_RESULT),
      });
    });

    await page.route(`**/api/documents/${MOCK_DOC_A_ID}/ask`, async (route) => {
      const body = JSON.parse(route.request().postData() || "{}") as { question?: string };
      const q = body.question || "";
      const isOutOfScope =
        q.toLowerCase().includes("capital of france") || q.toLowerCase().includes("weather");

      if (isOutOfScope) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            documentId: MOCK_DOC_A_ID,
            answer: "This question could not be answered from the document.",
            cited_sections: [],
            in_scope: false,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            documentId: MOCK_DOC_A_ID,
            answer: "The security deposit is two months' rent, due before moving in.",
            cited_sections: ["Section 3 — Security Deposit"],
            in_scope: true,
          }),
        });
      }
    });
  });

  test("1. Full Understand journey: Upload to Export", async ({ page }) => {
    await page.goto("/");

    // 1. Select persona in header
    const personaTrigger = page.getByRole("combobox", { name: "Select your persona" });
    await personaTrigger.click();
    await page.getByRole("option", { name: "Tenant" }).click();

    // 2. Switch to paste text mode
    const pasteToggle = page.getByRole("button", {
      name: /switch to paste text mode|paste text instead/i,
    });
    await pasteToggle.click();

    // 3. Paste document text
    const textarea = page.getByRole("textbox", { name: "Paste document text" });
    await textarea.fill(
      "Residential Lease Agreement between Landlord and Tenant. Section 3: Security deposit is two months rent. Section 12: Landlord entry.",
    );

    // 4. Submit for analysis
    const submitBtn = page.getByRole("button", { name: /analyze document/i });
    await submitBtn.click();

    // 5. Verify analysis screen renders with document type, summary, and clauses
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lease");
    await expect(page.getByText("residential lease agreement governing")).toBeVisible();
    await expect(page.getByText("Section 3 — Security Deposit")).toBeVisible();
    await expect(page.getByText("Section 12 — Landlord Entry")).toBeVisible();

    // 6. Open Export Dialog
    const exportBtn = page.getByRole("button", { name: /export checklist/i });
    await exportBtn.click();

    // 7. Verify Export Modal contains action checklist and lawyer questions
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Review the security deposit refund timeline")).toBeVisible();
    await expect(dialog.getByText("Is the unannounced entry clause enforceable")).toBeVisible();

    // 8. Verify Copy action button exists
    const copyBtn = dialog.getByRole("button", { name: /copy/i });
    await expect(copyBtn).toBeVisible();
  });

  test("2. Full Compare journey: Document A analyzed -> Add Document B -> View Comparisons", async ({
    page,
  }) => {
    await page.goto("/");

    // Setup Document A
    const personaTrigger = page.getByRole("combobox", { name: "Select your persona" });
    await personaTrigger.click();
    await page.getByRole("option", { name: "Tenant" }).click();

    await page
      .getByRole("button", { name: /switch to paste text mode|paste text instead/i })
      .click();
    await page
      .getByRole("textbox", { name: "Paste document text" })
      .fill("Lease Agreement Document A text.");
    await page.getByRole("button", { name: /analyze document/i }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lease");

    // Navigate to Compare Tab
    const compareTab = page.getByRole("tab", { name: /compare/i });
    await compareTab.click();

    // Document B upload screen appears
    const pasteBBtn = page.getByRole("button", {
      name: /switch to paste text mode|paste text instead/i,
    });
    await pasteBBtn.click();
    await page
      .getByRole("textbox", { name: "Paste document text" })
      .fill("Revised Document B text.");

    const addDocBBtn = page.getByRole("button", { name: /analyze document b/i });
    await addDocBBtn.click();

    // Click Compare Documents
    const compareBtn = page.getByRole("button", {
      name: /compare the two documents|compare documents/i,
    });
    await expect(compareBtn).toBeVisible();
    await compareBtn.click();

    // Verify comparison table results
    await expect(page.getByText("Security Deposit").first()).toBeVisible();
    await expect(page.getByText("Document B reduces the security deposit").first()).toBeVisible();
  });

  test("3. Q&A out-of-scope refusal path: Ask off-topic question -> verify refusal -> add to lawyer questions", async ({
    page,
  }) => {
    await page.goto("/");

    // Setup Document A
    const personaTrigger = page.getByRole("combobox", { name: "Select your persona" });
    await personaTrigger.click();
    await page.getByRole("option", { name: "Tenant" }).click();

    await page
      .getByRole("button", { name: /switch to paste text mode|paste text instead/i })
      .click();
    await page
      .getByRole("textbox", { name: "Paste document text" })
      .fill("Lease Agreement Document A text.");
    await page.getByRole("button", { name: /analyze document/i }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lease");

    // Navigate to Q&A Tab
    const qaTab = page.getByRole("tab", { name: /q&a/i });
    await qaTab.click();

    // Fill in an out-of-scope question
    const questionInput = page.getByRole("textbox", {
      name: /ask a question about your document/i,
    });
    await questionInput.fill("What is the capital of France?");
    await page.getByRole("button", { name: /send question/i }).click();

    // Verify out-of-scope refusal notice appears
    const refusalNotice = page.getByRole("note", { name: /question outside document scope/i });
    await expect(refusalNotice).toBeVisible();
    await expect(refusalNotice).toContainText(
      "This question could not be answered from the document",
    );

    // Click "Add this question to lawyer questions"
    const addQuestionBtn = refusalNotice.getByRole("button", {
      name: /add this question to lawyer questions/i,
    });
    await addQuestionBtn.click();

    // Verify button updates to confirmed state
    await expect(refusalNotice.getByText(/added to lawyer questions/i)).toBeVisible();
  });
});
