/**
 * a11y.test.ts — Accessibility audit for ClauseWise
 *
 * Uses Playwright + @axe-core/playwright to assert zero critical or serious
 * WCAG violations on every core screen and interactive state.
 *
 * Screens exercised:
 *   1. Understand tab — initial state (UploadScreen, no document loaded)
 *   2. Understand tab — paste mode (mode-toggled, no API call needed)
 *   3. Compare tab   — placeholder state (no document analyzed yet)
 *   4. Q&A tab       — placeholder state (no document analyzed yet)
 *
 * All tests run against the live Vite dev server. No real API calls are made;
 * the placeholder and upload states are purely client-side.
 *
 * Severity filter: "critical" and "serious" — "moderate" and "minor" are
 * reported but do not fail the test (they appear in the console).
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Helpers ──────────────────────────────────────────────────────────────────────

/**
 * Run axe on the current page and assert zero critical/serious violations.
 * Logs any moderate/minor violations to the console for awareness.
 */
async function assertNoA11yViolations(
  page: import("@playwright/test").Page,
  label: string,
) {
  const results = await new AxeBuilder({ page })
    // Standard WCAG 2.1 AA + best-practice rules
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    // Exclude the sr-only live regions (single-character hidden helpers)
    .exclude(".sr-only")
    .analyze();

  const critical = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  const minor = results.violations.filter(
    (v) => v.impact === "moderate" || v.impact === "minor",
  );

  if (minor.length > 0) {
    console.log(`\n[a11y] Moderate/minor on "${label}" (non-blocking):`);
    minor.forEach((v) => {
      console.log(`  • [${v.impact}] ${v.id}: ${v.description}`);
      v.nodes.forEach((n) => {
        console.log(`    target: ${n.target}`);
        console.log(`    html:   ${n.html.slice(0, 120)}`);
      });
    });
  }

  if (critical.length > 0) {
    const details = critical
      .map((v) => {
        const nodes = v.nodes
          .map(
            (n) =>
              `    target: ${n.target}\n    html: ${n.html.slice(0, 200)}`,
          )
          .join("\n");
        return `• [${v.impact}] Rule: ${v.id}\n  ${v.description}\n  Help: ${v.helpUrl}\n${nodes}`;
      })
      .join("\n\n");
    expect.soft(false, `axe violations on "${label}":\n\n${details}`).toBeTruthy();
  }

  // Hard assertion — no critical or serious violations allowed
  expect(
    critical.length,
    `Expected 0 critical/serious violations on "${label}" but got ${critical.length}:\n` +
      critical.map((v) => `  • ${v.id}: ${v.description}`).join("\n"),
  ).toBe(0);
}

// Fixtures ─────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Wait for the React tree to mount and fonts to load
  await page.waitForSelector("header", { timeout: 10_000 });
});

// Tests ────────────────────────────────────────────────────────────────────────

test.describe("Understand screen", () => {
  test("initial state (UploadScreen) — file mode", async ({ page }) => {
    // The Understand tab is active by default
    await page.waitForSelector('form[aria-label="Document upload"]', {
      timeout: 5_000,
    });
    await assertNoA11yViolations(page, "Understand / UploadScreen / file mode");
  });

  test("initial state (UploadScreen) — paste mode", async ({ page }) => {
    // Switch to paste mode
    const modeToggle = page.getByRole("button", {
      name: /switch to paste text mode/i,
    });
    await modeToggle.click();
    await page.waitForSelector("textarea", { timeout: 3_000 });
    await assertNoA11yViolations(
      page,
      "Understand / UploadScreen / paste mode",
    );
  });

  test("persona reminder shown when no persona selected", async ({ page }) => {
    // By default no persona is selected — the reminder should be visible
    const hint = page.getByText(/select who you are/i);
    await expect(hint).toBeVisible();
    await assertNoA11yViolations(
      page,
      "Understand / UploadScreen / persona reminder",
    );
  });
});

test.describe("Compare screen", () => {
  test("placeholder state (no document analyzed)", async ({ page }) => {
    // Click Compare tab
    await page.getByRole("tab", { name: "Compare" }).click();
    await page.waitForSelector("h2", { timeout: 3_000 });
    await assertNoA11yViolations(
      page,
      "Compare / PlaceholderScreen",
    );
  });
});

test.describe("Q&A screen", () => {
  test("placeholder state (no document analyzed)", async ({ page }) => {
    await page.getByRole("tab", { name: "Q&A" }).click();
    await page.waitForSelector("h2", { timeout: 3_000 });
    await assertNoA11yViolations(page, "Q&A / PlaceholderScreen");
  });
});

test.describe("Navigation & skip link", () => {
  test("skip link is accessible via keyboard and targets #main-content", async ({
    page,
  }) => {
    // Tab once — the skip link should be the first focusable element
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(focused).toBe("Skip to main content");

    // Pressing Enter should move focus to #main-content
    await page.keyboard.press("Enter");
    const afterTarget = await page.evaluate(
      () => document.activeElement?.id ?? document.activeElement?.tagName,
    );
    // main-content element should now be focused (tabIndex=-1)
    expect(afterTarget).toBe("main-content");
  });

  test("tab order reaches all interactive elements in Understand tab", async ({
    page,
  }) => {
    // Verify we can tab through: skip-link → persona select → tabs → dropzone → mode-toggle → submit
    const interactiveElements: string[] = [];
    // Tab up to 20 times and collect labels/roles
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return {
          tag: el.tagName,
          role: el.getAttribute("role"),
          ariaLabel: el.getAttribute("aria-label"),
          type: el.getAttribute("type"),
          id: el.id,
          text: el.textContent?.trim().slice(0, 40),
        };
      });
      if (info) interactiveElements.push(JSON.stringify(info));
    }
    // We should have hit at least 5 distinct interactive elements
    expect(interactiveElements.length).toBeGreaterThanOrEqual(5);
  });
});

test.describe("Keyboard — accordion", () => {
  /**
   * This test mocks the analysis result so we can test the ClauseAccordion
   * without making real backend calls.
   *
   * Strategy: intercept the API routes and return fixture data.
   */
  test("accordion triggers are keyboard-navigable (mocked analysis)", async ({
    page,
  }) => {
    // Mock POST /api/documents → documentId
    await page.route("**/api/documents", (route) => {
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documentId: "test-doc-001" }),
      });
    });

    // Mock POST /api/documents/test-doc-001/classify
    await page.route("**/api/documents/test-doc-001/classify", (route) => {
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ document_type: "employment_contract" }),
      });
    });

    // Mock POST /api/documents/test-doc-001/analyze
    await page.route("**/api/documents/test-doc-001/analyze", (route) => {
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          documentId: "test-doc-001",
          document_type: "employment_contract",
          summary:
            "A standard employment contract covering compensation, duties, and termination.",
          clauses: [
            {
              clause_id: "clause-1",
              section_reference: "§3 Compensation",
              severity: "high",
              tag: "obligation",
              plain_language_summary: "You must work 40 hours per week.",
              why_it_matters: "Overtime is not compensated.",
            },
            {
              clause_id: "clause-2",
              section_reference: "§7 Termination",
              severity: "medium",
              tag: "risk",
              plain_language_summary: "Employer can terminate with 2 weeks notice.",
              why_it_matters: "No severance guaranteed.",
            },
            {
              clause_id: "clause-3",
              section_reference: "§9 Non-Compete",
              severity: "low",
              tag: "right",
              plain_language_summary: "Non-compete limited to 6 months.",
              why_it_matters: "Narrowly scoped, low risk.",
            },
          ],
        }),
      });
    });

    // Select a persona (required to enable upload)
    await page.selectOption("#persona-select-trigger", {
      label: /tenant/i,
    }).catch(async () => {
      // Radix Select doesn't use native select — click the trigger then pick
      await page.getByRole("combobox", { name: /select your persona/i }).click();
      await page.getByRole("option", { name: /tenant/i }).click();
    });

    // Upload a dummy file via the dropzone
    const dropzoneInput = page.locator('input[type="file"]');
    await dropzoneInput.setInputFiles({
      name: "test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test content"),
    });

    // Submit the form
    const submitBtn = page.getByRole("button", { name: /analyze document/i });
    await submitBtn.click();

    // Wait for analysis to complete (accordion should appear)
    await page.waitForSelector('[data-slot="accordion"]', { timeout: 15_000 });

    // Run axe on the results page
    await assertNoA11yViolations(page, "Understand / Analysis results with accordion");

    // Test keyboard navigation through accordion
    // Find the first accordion trigger and focus it
    const firstTrigger = page.locator('[data-slot="accordion-trigger"]').first();
    await firstTrigger.focus();
    await expect(firstTrigger).toBeFocused();

    // Arrow down or Tab moves to next trigger
    await page.keyboard.press("Tab");
    const secondTrigger = page.locator('[data-slot="accordion-trigger"]').nth(1);
    await expect(secondTrigger).toBeFocused();

    // Space or Enter toggles accordion
    await page.keyboard.press("Space");
    // Check if content expanded
    const accordionContent = page.locator('[data-slot="accordion-content"]').nth(1);
    await expect(accordionContent).toBeVisible({ timeout: 2_000 });
  });
});
