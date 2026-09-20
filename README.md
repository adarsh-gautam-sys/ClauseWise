# ClauseWise

> An AI-powered legal document copilot designed for everyday signers — explaining contracts in plain language, surfacing critical risks through a context-aware decision engine, comparing drafts semantically, answering grounded questions with clause citations, and preparing users with actionable checklists and lawyer-ready questions.

[![Contest](https://img.shields.io/badge/Contest-Google%20Virtual%20Promptwars-4285F4.svg)](https://ai.google.dev/)
[![Vertical](https://img.shields.io/badge/Vertical-AI%20for%20Legal%20Assistance%20%26%20Access-34A853.svg)](#chosen-vertical)
[![Accessibility](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA%20Compliant-FF6D00.svg)](frontend/ACCESSIBILITY.md)
[![Security](https://img.shields.io/badge/Security-Hardened%20%26%20Redacted-EA4335.svg)](backend/SECURITY.md)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)](LICENSE)

---

## Chosen vertical

**AI for Legal Assistance & Access** (Google Virtual Promptwars)

Legal contracts — residential leases, employment offer letters, independent contractor agreements, terms of service, and loan contracts — are fundamentally asymmetric. They are drafted by institutional attorneys to maximize corporate protection, while ordinary tenants, employees, and small business owners must sign them without affordable or timely access to counsel.

ClauseWise bridges this gap. It does not replace attorneys or generate legally binding instruments; rather, it provides educational clarity, calibrates severity against objective benchmarks, and equips users to advocate for themselves and approach real legal consultations prepared.

---

## Approach and logic

ClauseWise is engineered around an auditable, transparent **Persona-Driven Decision Engine** (`backend/src/services/decisionEngine.ts`) rather than opaque or unconstrained model completions:

### 1. Context-Aware Priority Engine
Different personas face different critical risks in the same contract category. ClauseWise evaluates user context (`persona`, `document_type`, and optional `jurisdiction`) to dynamically reorder and elevate the most consequential clauses:

| Document Type | Supported Persona | Priority Clauses Surfaced First |
|---|---|---|
| **Lease** | Tenant | Security deposit terms, notice period, maintenance liability, landlord access/entry rights, rent escalation, termination penalties |
| **Employment Contract** | Employee / Job Seeker | Notice period, non-compete/non-solicit scope, IP ownership/assignment, termination grounds, probation terms |
| **Terms of Service / Privacy** | Consumer / Subscriber | Data sharing/resale, mandatory arbitration/class-action waiver, auto-renewal, cancellation friction, liability caps |
| **NDA** | Freelancer / Gig Worker | Duration of confidentiality, scope of "Confidential Information", IP carve-outs, injunctive remedies/penalties |
| **Loan / Vendor Agreement** | Small Business Owner | Interest rate & calculation, prepayment penalties, default terms, indemnity obligations, hidden fees |

### 2. Severity Calibration against Ground-Truth Benchmarks
Clause severity (`low`, `medium`, `high`) is never arbitrary. The analyzer calibrates each clause against curated, human-readable reference standards stored in `reference-clauses/<type>.json` across three objective criteria:
1. **One-Sidedness:** Language imposing unilateral obligations without reciprocal protections (e.g. landlord entry without notice, employee-only termination restrictions).
2. **Deviation from Standard Norms:** Departures from standard, fair commercial practices codified in reference clause patterns.
3. **Unusual Magnitude / Outliers:** Excessive numeric conditions (e.g. 90-day tenant notice periods, 18-month nationwide non-competes, 2-month deposit forfeitures).

Every extracted clause is classified into a functional category (`obligation`, `right`, `risk`, `standard`), labeled with a visual and textual severity badge, and paired with a clear **"Why it matters"** layperson explanation.

---

## How the solution works

ClauseWise guides the user through an intuitive, privacy-preserving six-stage workflow:

### Step 1: Upload & Ephemeral Ingestion
Users select their persona (e.g. *Tenant*, *Employee*, *Freelancer*, *Consumer*, *Small Business Owner*) and submit their agreement via file drop (`.txt`, `.pdf`, `.docx` up to 5 MB) or direct text paste. The backend validates MIME types, strips binary artifacts, segments text into overlapping semantic chunks, and caches the document in an in-memory TTL store. **Zero uploaded document text or user questions are ever written to disk, databases, or log files.**

### Step 2: Automated Classification
A structured Gemini API call classifies the document into one of six categories (`lease`, `employment_contract`, `terms_of_service`, `nda`, `loan_or_vendor_agreement`, `other`) with calibrated confidence scoring (`high`, `medium`, `low`). The system presents the classification to the user for instant confirmation.

### Step 3: Clause Extraction, Severity Tagging & Simplification
In a single batched structured call, Gemini Flash generates a two-sentence plain-language summary and extracts all material clauses. Each clause receives an identifier, section reference, plain-English explanation, functional tag, severity level, and "why it matters" summary. The backend decision engine immediately applies persona-weighting to ensure the most vulnerable terms appear at the very top of the review screen.

### Step 4: Grounded Q&A with Vector Citations
The interactive Q&A assistant uses RAG over in-memory `text-embedding-004` document vectors. When a user asks a question, the top-4 relevant chunks are retrieved via cosine similarity and supplied to the model within strict `<DOCUMENT_EXCERPTS>` delimiters. Every valid answer explicitly cites the specific section reference and appends a statutory disclaimer. If a user asks speculative questions or requests legal advice (e.g. *"Will I win in court?"*), the system triggers an out-of-scope refusal guardrail (`in_scope: false`) and offers to route the question to the user's Lawyer Questions list.

### Step 5: Semantic Document Comparison
When reviewing competing proposals or revised drafts, users load both documents into the Compare view. Rather than relying on fragile line diffs, ClauseWise pairs clauses using vector embedding similarity. Gemini evaluates the aligned pairs in a single batched call, generating a side-by-side delta matrix with a plain-English explanation of what changed and an objective assessment of which version favors the user (`favors: "doc_a" | "doc_b" | "neutral"`).

### Step 6: Action Checklist & Lawyer-Ready Export
ClauseWise compiles the analysis into a portable, beautifully formatted Markdown report. The report pairs a prioritized **Action Checklist** (concrete steps with strong action verbs like *Verify*, *Request*, *Negotiate*) with a targeted **Questions for Your Lawyer** list (precise questions citing specific contract sections), empowering the user to make confident decisions or walk into a legal consultation fully prepared.

---

## Assumptions made

In alignment with Section 0 of the Project Requirements Document (PRD):

1. **Assistance, Not Legal Representation:** ClauseWise explicitly positions itself as an educational tool for legal access. It never drafts binding legal agreements, never predicts judicial outcomes, and never establishes an attorney-client relationship.
2. **Equal Emphasis on Five Evaluation Pillars:** Code Quality, Security, Efficiency, Testing, and Accessibility are treated as co-equal priorities:
   - *Code Quality:* Strict TypeScript throughout, ESLint/Prettier clean, zero magic numbers, modular prompts and routes.
   - *Security:* Strict input validation, express rate-limiting, comprehensive log redaction, prompt injection defense, zero secrets in git.
   - *Efficiency:* Batched structured LLM calls, cached embeddings, code-splitting, sub-1 MB repository footprint.
   - *Testing:* 97 automated tests (unit, integration, e2e, a11y) passing 100% offline with zero external API dependencies in CI.
   - *Accessibility:* WCAG 2.1 AA certified via automated axe-core audits and complete keyboard navigation.
3. **Privacy-First Ephemeral Architecture:** No persistent user accounts or database instances are deployed for this MVP. All document representations reside exclusively in memory with automated TTL expiry.
4. **Target Demo Persona:** While all five personas are fully operational in the application, the primary evaluation walkthrough is centered on **Priya Sharma** (a first-time tenant and employee) to demonstrate context-aware prioritization.
5. **AI Provider:** Built natively for the **Google Gemini API** (`gemini-2.5-flash` for structured reasoning and `text-embedding-004` for semantic retrieval and clause alignment), strictly isolated behind `backend/src/services/geminiClient.ts`.

---

## Running locally

Follow these exact steps to run ClauseWise locally on your machine:

### 1. Prerequisites
- **Node.js**: v18.18.0 or v20+ installed ([nodejs.org](https://nodejs.org/))
- **npm**: v9+ (bundled with Node.js)
- **Google Gemini API Key**: Obtain a free API key from [Google AI Studio](https://aistudio.google.com/)

### 2. Clone the Repository
```bash
git clone https://github.com/adarsh-gautam-sys/ClauseWise.git
cd ClauseWise
```

### 3. Install Dependencies
Install dependencies for both the backend and frontend:
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to repository root
cd ..
```

### 4. Configure Environment Variables (Where to Put Your Real `GEMINI_API_KEY`)
The backend requires a Google Gemini API key to communicate with the Gemini models.

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Copy the example environment file:
   - On **Linux / macOS**:
     ```bash
     cp .env.example .env
     ```
   - On **Windows (PowerShell)**:
     ```powershell
     Copy-Item .env.example .env
     ```
3. Open `backend/.env` in your text editor. It contains:
   ```bash
   PORT=3000
   NODE_ENV=development
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. Replace `your_gemini_api_key_here` with your real Gemini API key:
   ```bash
   GEMINI_API_KEY=AIzaSy...your_actual_key_here...
   ```
5. Save the file.
   > **Security Note:** `backend/.env` is strictly excluded in `.gitignore` and will never be committed to source control.

### 5. Start the Development Servers

Open two terminal windows (or tabs) to run the backend and frontend concurrently:

**Terminal 1 (Backend API):**
```bash
cd backend
npm run dev
```
*Backend will start at `http://localhost:3000` (health check: `http://localhost:3000/health`).*

**Terminal 2 (Frontend Web App):**
```bash
cd frontend
npm run dev
```
*Frontend will start at `http://localhost:5173`.*

Open **`http://localhost:5173`** in your browser to launch ClauseWise.

---

## Testing & Quality Verification

ClauseWise includes a comprehensive, multi-layer automated test suite. Automated tests execute completely offline by leveraging a deterministic, schema-valid Gemini mock (`backend/src/services/__mocks__/geminiClient.ts`), ensuring fast and cost-free CI execution:

| Test Layer | Framework | Coverage |
|---|---|---|
| **Unit Tests** | Vitest | Decision engine priority mapping, similarity cosine ranking, Markdown rendering |
| **Integration Tests** | Vitest + Supertest | Endpoints for upload, classification, analysis, Q&A, compare, export, and prompt injection defense |
| **End-to-End (E2E)** | Playwright | Full Understand journey, Compare journey, and Out-of-scope refusal path |
| **Accessibility (a11y)**| Playwright + axe-core | Automated WCAG 2.1 AA audit across Understand and Compare screens (0 critical/serious violations) |

### Running the Entire Suite
From the root directory, run the consolidated test runner:
```bash
npm run test:all
```
*(Runs backend unit/integration tests, frontend E2E tests, and axe-core accessibility audits sequentially.)*

### Running Individual Test Suites
```bash
# Run backend unit and integration tests:
cd backend
npm test

# Run frontend Playwright E2E tests:
cd frontend
npm run test:e2e

# Run Playwright + axe-core accessibility audit:
cd frontend
npm run test:a11y
```

---

## Repository Structure

```
ClauseWise/
├── backend/
│   ├── src/
│   │   ├── lib/                  # In-memory document store, file parser, markdown renderer
│   │   ├── prompts/              # Isolated prompt templates (classify, analyze, ask, compare, export)
│   │   ├── routes/               # Express routes for upload, analyze, ask, compare, export
│   │   ├── services/             # decisionEngine.ts, similarity.ts, geminiClient.ts
│   │   ├── app.ts                # Express application configuration & rate limiting
│   │   └── server.ts             # Server entry point
│   ├── tests/                    # Vitest integration & prompt injection suites
│   ├── SECURITY.md               # Backend security & privacy architecture
│   └── .env.example              # Environment template with placeholder API key
├── frontend/
│   ├── src/
│   │   ├── components/           # AppShell, ClauseAccordion, CompareTable, ChatPanel, ExportPanel
│   │   ├── pages/                # UploadPage, UnderstandPage, ComparePage, QAPage
│   │   ├── lib/                  # API client, utility functions
│   │   └── types.ts              # Shared TypeScript definitions
│   ├── tests/                    # Playwright E2E and axe-core a11y test suites
│   └── ACCESSIBILITY.md          # Comprehensive WCAG 2.1 AA compliance report
├── reference-clauses/            # Curated ground-truth clause benchmarks (.json)
├── sample-documents/             # Lightweight demo & test agreements (.txt)
├── DEMO_SCRIPT.md                # Timed 2-to-3 minute judge walkthrough script
├── ClauseWise_PRD.md             # Complete Product Requirements Document
└── README.md                     # Project documentation
```

---

## Demo Walkthrough for Judges

For a step-by-step presentation script designed for the 2-to-3 minute evaluation window, see **[`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)**.

Sample files for the walkthrough are located in `sample-documents/`:
- `sample-documents/sample-lease-priya.txt` (Initial draft with high-severity landlord access and forfeiture terms)
- `sample-documents/sample-lease-priya-revised.txt` (Revised draft with 24-hour notice and escrow deposit)
- `sample-documents/sample-employment-offer.txt` (Employment agreement with non-compete clauses)
- `sample-documents/prompt-injection-test.txt` (Adversarial test document proving prompt injection resilience)
