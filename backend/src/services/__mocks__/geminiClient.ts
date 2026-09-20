/**
 * Fixed, schema-valid mock for Gemini client.
 *
 * Used by tests and CI to guarantee zero real network calls, zero API token usage,
 * and deterministic, fast test execution.
 */

import type { z } from "zod";

/**
 * Generate deterministic 768-dimensional float embedding vector.
 * Employs a simple sine/cosine hash of the string so similar or identical strings
 * have predictable, normalized dot products and cosine similarity.
 */
export async function embedText(text: string): Promise<number[]> {
  const dim = 768;
  const vector = new Array<number>(dim);
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    const val = Math.sin(hash + i);
    vector[i] = val;
    sumSq += val * val;
  }

  const norm = Math.sqrt(sumSq) || 1;
  return vector.map((v) => v / norm);
}

/**
 * Deterministic batch embedding mock.
 */
export async function embedTexts(texts: string[], _concurrency = 4): Promise<number[][]> {
  return Promise.all(texts.map((t) => embedText(t)));
}

/**
 * Generate schema-valid JSON string matching the expected prompt structure.
 */
export async function generateStructured(prompt: string, _schema: z.ZodType): Promise<string> {
  // 1. Classification
  if (prompt.includes("CLASSIFICATION TASK:")) {
    const docMatch = prompt.match(/<DOCUMENT>([\s\S]*?)<\/DOCUMENT>/);
    const docContent = (docMatch?.[1] ?? prompt).toLowerCase();

    let docType = "lease";
    if (/\b(lease|rental|tenant|landlord)\b/i.test(docContent)) {
      docType = "lease";
    } else if (/\b(non-disclosure|confidentiality|\bnda\b)\b/i.test(docContent)) {
      docType = "nda";
    } else if (/\b(employment|offer letter|employee|contractor)\b/i.test(docContent)) {
      docType = "employment_contract";
    } else if (/\b(terms of service|terms and conditions|tos)\b/i.test(docContent)) {
      docType = "terms_of_service";
    } else if (/\b(loan|borrower|lender|vendor agreement)\b/i.test(docContent)) {
      docType = "loan_or_vendor_agreement";
    }

    return JSON.stringify({
      document_type: docType,
      confidence: "high",
    });
  }

  // 2. Q&A (Ask)
  if (prompt.includes("<QUESTION>") && prompt.includes("<DOCUMENT_EXCERPTS>")) {
    const qMatch = prompt.match(/<QUESTION>([\s\S]*?)<\/QUESTION>/);
    const questionText = (qMatch?.[1] ?? prompt).toLowerCase();

    const isOutOfScope =
      questionText.includes("out-of-scope") ||
      questionText.includes("capital of france") ||
      questionText.includes("weather") ||
      questionText.includes("space travel") ||
      questionText.includes("airbnb");

    if (isOutOfScope) {
      return JSON.stringify({
        answer: "This question could not be answered from the provided document content.",
        cited_sections: [],
        in_scope: false,
      });
    }

    return JSON.stringify({
      answer:
        "Under the agreement, the security deposit is two months' rent, payable prior to move-in.\n\n⚠ This is a plain-language explanation only, not legal advice. Consult a qualified lawyer before acting on this information.",
      cited_sections: ["[CHUNK 1]"],
      in_scope: true,
    });
  }

  // 3. Comparison
  if (prompt.includes("DOCUMENTS BEING COMPARED:") || prompt.includes("CLAUSE PAIRS TO COMPARE:")) {
    const pairMatches = prompt.match(/\[PAIR\s+\d+\]/g);
    const count = pairMatches ? pairMatches.length : 1;

    const comparisons = [];
    for (let idx = 1; idx <= count; idx++) {
      comparisons.push({
        topic: idx === 1 ? "Security Deposit" : `Clause Alignment ${idx}`,
        doc_a_summary: "Document A requires two months' rent as deposit.",
        doc_b_summary: "Document B requires one month's rent as deposit.",
        change_description: "Document B reduces upfront financial obligation.",
        favors: "doc_b" as const,
      });
    }

    return JSON.stringify({
      comparisons,
    });
  }

  // 4. Export (Checklist & Questions)
  if (
    prompt.includes("<DOCUMENT_SUMMARY>") &&
    (prompt.includes("<CLAUSES>") || prompt.includes("action checklist"))
  ) {
    return JSON.stringify({
      checklist: [
        "Review the security deposit refund timeline before signing.",
        "Confirm utility payment responsibilities in writing.",
        "Check state laws regarding landlord notice before entry.",
      ],
      lawyer_questions: [
        "Is the unannounced entry clause enforceable under local tenancy law?",
        "Can we cap late fee penalties to statutory minimums?",
      ],
    });
  }

  // 5. Clause Analysis (Default for ANALYSIS TASK:)
  return JSON.stringify({
    summary:
      "This is a residential lease agreement governing the tenancy terms, deposit conditions, and termination rights.",
    clauses: [
      {
        clause_id: "CLAUSE_1",
        section_reference: "Section 3 — Security Deposit",
        plain_language_summary:
          "The tenant must pay a security deposit of two months' rent before move-in.",
        tag: "obligation",
        severity: "medium",
        why_it_matters: "This money is held until move-out and may be deducted for damages.",
      },
      {
        clause_id: "CLAUSE_2",
        section_reference: "Section 4 — Notice Period",
        plain_language_summary:
          "Either party must give 30 days written notice to end the agreement.",
        tag: "right",
        severity: "low",
        why_it_matters: "Provides a defined window for moving out or renewing.",
      },
      {
        clause_id: "CLAUSE_3",
        section_reference: "Section 5 — Landlord Access",
        plain_language_summary:
          "The landlord may enter the premises at any time without advance notice.",
        tag: "risk",
        severity: "high",
        why_it_matters: "Deprives tenant of statutory privacy rights and quiet enjoyment.",
      },
    ],
  });
}
