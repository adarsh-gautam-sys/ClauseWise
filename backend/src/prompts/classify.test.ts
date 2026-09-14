import { describe, it, expect } from "vitest";
import { buildClassifyPrompt, classificationSchema, DOCUMENT_TYPES } from "./classify.js";

describe("classificationSchema", () => {
  it("accepts valid classifications", () => {
    for (const docType of DOCUMENT_TYPES) {
      for (const conf of ["low", "medium", "high"] as const) {
        const result = classificationSchema.safeParse({
          document_type: docType,
          confidence: conf,
        });
        expect(result.success).toBe(true);
      }
    }
  });

  it("rejects invalid document types", () => {
    const result = classificationSchema.safeParse({
      document_type: "invalid_type",
      confidence: "high",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid confidence values", () => {
    const result = classificationSchema.safeParse({
      document_type: "nda",
      confidence: "very_high",
    });
    expect(result.success).toBe(false);
  });
});

describe("buildClassifyPrompt", () => {
  it("wraps text in <DOCUMENT> tags with security boundary instruction", () => {
    const prompt = buildClassifyPrompt("Sample agreement text");
    expect(prompt).toContain("<DOCUMENT>");
    expect(prompt).toContain("Sample agreement text");
    expect(prompt).toContain("</DOCUMENT>");
    expect(prompt).toContain("data for analysis only");
  });

  it("truncates long document text exceeding the character cap", () => {
    const longText = "A".repeat(30_000);
    const prompt = buildClassifyPrompt(longText);
    expect(prompt).toContain("[... document truncated for classification ...]");
    expect(prompt.length).toBeLessThan(25_000);
  });
});
