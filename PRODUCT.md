# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Individuals and small operators who sign legal documents (leases, employment contracts, NDAs, service agreements, terms of service, loan agreements) without access to professional legal review. They lack the budget, time, or proximity to a lawyer and need enough clarity to protect themselves and walk into a real legal conversation prepared.

Five supported persona types drive context-aware prioritization:

| Persona | Typical documents | Core worry |
|---|---|---|
| Tenant | Lease / rental agreement | Deposit, notice period, hidden charges |
| Employee / job seeker | Offer letter, employment contract | Notice period, non-compete, termination terms |
| Freelancer / gig worker | Service contract, NDA | Payment terms, IP ownership, scope creep |
| Consumer / subscriber | Terms of service, privacy policy | Data sharing, auto-renewal, arbitration clauses |
| Small business owner | Vendor agreement, loan agreement | Liability, penalties, default conditions |

Demo persona: Priya, late twenties, first job in a new city, signing her first independent lease and first full-time employment contract this week with no lawyer and a limited budget.

## Product Purpose

ClauseWise helps people understand what they are about to sign. Upload any contract, get it explained in plain language, get risky clauses flagged with severity and reasoning, get a checklist of what to do next, and get a sharp list of questions to bring to an actual lawyer.

It deliberately narrows scope: **Understand** (simplify clause by clause), **Compare** (side-by-side diff of two documents), **Prepare** (action checklist and lawyer-ready question list). It never drafts new binding legal documents, predicts case outcomes, or substitutes for professional legal advice.

## Positioning

Persona-driven severity analysis of existing documents. ClauseWise is not a generic "chat with your PDF" tool. A rules table maps document type × persona to priority clauses; severity scores are computed from one-sidedness, deviation from curated reference patterns, and unusual magnitudes. The rules table ships in the repo as an inspectable file, making the decision logic auditable by a judge or a user, not hidden inside an opaque prompt.

## Operating Context

Users upload a PDF, DOCX, or plain text file (max 5 MB). They select a persona, optionally provide a jurisdiction hint. The system classifies the document type, extracts and tags clauses with structured output, scores severity, and reorders output by persona relevance. Users can ask follow-up questions grounded strictly in the uploaded document with clause-level citations. They export a checklist and lawyer-question list. No persistent storage by default — documents live in server memory only for the request/response cycle.

## Capabilities and Constraints

### Confirmed capabilities
- Single-document upload with plain-language simplification and clause tagging (obligation / right / risk / standard) with severity (low / medium / high)
- Persona selection driving which clauses surface first
- Grounded Q&A with citations and out-of-scope refusal
- Checklist and lawyer-question export
- Document comparison (two-document side-by-side diff, clause alignment by embedding similarity)
- Streaming responses for perceived speed

### Hard constraints
- Never drafts new binding legal documents
- Never stores uploaded documents or user questions to disk, database, or log
- API keys server-side only, never in frontend code, never committed
- Every AI response carries a disclaimer
- Prompt injection defense: uploaded text delimited and treated as inert data
- Gemini API only, called exclusively through a single service module
- Repo under 10 MB, single branch (main), no committed secrets

### Undecided
- Regional language output (Hindi/Marathi) — Could priority
- Dyslexia-friendly font toggle and high-contrast theme — Could priority
- Suspicious-document detection for embedded prompt injection — Could priority

## Evidence on Hand

- Curated reference clause patterns per document type (small JSON/MD files in `reference-clauses/`)
- Small text-only sample documents in `sample-documents/`
- No logo, brand colors, or visual assets exist yet
- No real user testimonials, case studies, or press — future work must not fabricate these

## Product Principles

1. **Clarity over comprehensiveness.** Three jobs done well (understand, compare, prepare) beat ten done shallowly.
2. **Auditable intelligence.** Every AI decision traces to an inspectable rule or cited clause, never a black box.
3. **Privacy by architecture.** No persistent storage by default; the safest data is data you never keep.
4. **Assistance, not replacement.** The product empowers users to ask better questions of a real lawyer, never to skip one.
5. **Access is a feature.** Accessibility is core functionality in a product whose vertical is literally named "Legal Assistance & Access."

## Accessibility & Inclusion

WCAG 2.1 AA target. Keyboard operable with visible focus states, 4.5:1 contrast minimum, labeled inputs with `aria-describedby` error linkage, streaming responses announced via ARIA live region, layout holds at 200% zoom, `prefers-reduced-motion` respected, severity indicators always carry a text label alongside color. Manual screen-reader pass (NVDA or VoiceOver) required on both core journeys before submission.
