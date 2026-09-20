# ClauseWise: Official 2-to-3 Minute Judge Demo Script

**Contest:** Google Virtual Promptwars  
**Vertical:** AI for Legal Assistance & Access  
**Target Duration:** 2 minutes 30 seconds (150 seconds)  
**Persona:** Priya Sharma (Tenant & Job Seeker, 20s, first independent lease, no lawyer, 1-week signing deadline)  
**Sample Documents Used:**
- `sample-documents/sample-lease-priya.txt` (Initial Draft)
- `sample-documents/sample-lease-priya-revised.txt` (Negotiated Draft)

---

## Demo Overview & Beat Timing

| Beat | Timestamp | Surface / Feature | Goal / Value Demonstrated |
|---|---|---|---|
| **1. Hook & Problem** | 0:00 – 0:25 | Home / Upload Screen | Introduce Priya's dilemma and explain why ClauseWise empowers individuals without replacing lawyers. |
| **2. Understand & Decision Engine** | 0:25 – 0:55 | Understand Screen / Accordion | Upload lease, select Tenant persona; show plain-English summary, prioritized high-risk clauses, severity badges, and "Why it matters". |
| **3. Grounded Q&A with Citation** | 0:55 – 1:25 | Q&A Panel | Ask "What happens if I leave early?", demonstrate exact section citations and grounded answers without hallucinations. |
| **4. Semantic Compare** | 1:25 – 1:55 | Compare Screen | Compare initial lease vs. revised lease side-by-side; show vector-aligned delta table and "Favors Tenant" impact tags. |
| **5. Action Checklist & Export** | 1:55 – 2:20 | Export View | Generate downloadable Markdown summary with action checklist and sharp, clause-cited lawyer questions. |
| **6. Guardrail & Ethical Boundary** | 2:20 – 2:45 | Q&A Panel (Out-of-Scope) | Ask "Will I win if I sue my landlord?", show refusal to give legal advice / outcome prediction, and prompt conversion to lawyer questions. |

---

## Detailed Beat-by-Beat Script

### Beat 1: Hook & Problem Framing (0:00 – 0:25)
* **Screen:** Browser at `http://localhost:5173` showing the ClauseWise upload screen.
* **Action:** Mouse hovers over the clean landing page; persona selector and document dropzone are visible.
* **Spoken Script:**
  > "Meet Priya. She just landed her first job in a new city and is about to sign her first independent apartment lease. She has no lawyer, a tight budget, and only five days before the offer expires. Like millions of renters and workers, Priya is facing an asymmetric legal contract written for lawyers, not for her.
  >
  > ClauseWise is an AI legal copilot built for Google Promptwars that demystifies contracts, catches red flags, and prepares everyday people for meaningful conversations with legal professionals."

---

### Beat 2: Understand & Context-Aware Decision Engine (0:25 – 0:55)
* **Screen:** Understand page (`/understand`).
* **Action:**
  1. Select **Tenant** in the Persona selector.
  2. Drag and drop `sample-documents/sample-lease-priya.txt` (or click "Use Sample Lease").
  3. The system automatically classifies the document as a **Residential Lease** (High Confidence) and extracts clauses.
  4. Scroll down the clause accordion.
* **Visual Elements to Point Out:**
  - The 2-sentence plain-language summary banner at the top.
  - The top-prioritized clause: **`Section 6: Landlord Access and Inspection`** tagged with a red **`HIGH RISK`** badge.
  - The **Why it matters** explanation: *"The landlord reserves the right to enter your home at any time without advance notice, violating standard 24-hour quiet enjoyment norms."*
  - Point out that because the user selected "Tenant", deposit terms, entry rights, and termination penalties are automatically bubbled to the top by our context-aware decision engine.
* **Spoken Script:**
  > "Priya selects the 'Tenant' persona and uploads her lease. In seconds, Gemini classifies the agreement and runs it through our context-aware decision engine.
  >
  > Rather than an unstructured chat dump, Priya gets a clear two-sentence summary followed by a prioritized clause breakdown. Because she is a tenant, our engine surfaces Section 6 first: a high-severity red flag granting the landlord access at any time without notice. ClauseWise explains in plain English exactly why this matters and how it departs from standard tenant protections."

---

### Beat 3: Grounded Q&A with Strict Clause Citation (0:55 – 1:25)
* **Screen:** Q&A panel / tab.
* **Action:**
  1. Type or select the pre-filled question:
     `What happens if I need to leave early and break the lease?`
  2. Click **Ask**.
  3. Show the response stream and render with citation badge: `[Section 5 — Early Termination Penalty]`.
* **Visual Elements to Point Out:**
  - Citation chip linking directly to Section 5.
  - The plain-English answer: Priya forfeits her entire $4,400 deposit, remains liable for remaining months until re-let, and owes a $1,000 fee.
  - The non-negotiable legal disclaimer banner at the bottom of the response.
* **Spoken Script:**
  > "Priya has a specific worry: 'What happens if I need to relocate early?'
  >
  > She types her question into the Q&A panel. ClauseWise embeds her query and retrieves the exact relevant chunks. The response cites Section 5 directly: explaining that early termination forfeits her full $4,400 deposit and leaves her liable for remaining rent plus a $1,000 re-letting fee. Every answer is grounded in her document—zero hallucinated terms, backed by explicit citations and a clear legal disclaimer."

---

### Beat 4: Semantic Compare — Initial vs. Revised (1:25 – 1:55)
* **Screen:** Compare page (`/compare`).
* **Action:**
  1. Navigate to the **Compare** tab.
  2. Upload Document A (`sample-lease-priya.txt`) and Document B (`sample-lease-priya-revised.txt`).
  3. Click **Compare Documents**.
  4. Review the side-by-side delta matrix.
* **Visual Elements to Point Out:**
  - Clauses aligned by **semantic embeddings**, not line numbers or text position.
  - **Landlord Access row:** Document A (entry at any time) vs. Document B (24-hour advance written notice required).
  - Green badge: **`Favors Tenant (Doc B)`**.
  - **Security Deposit row:** Document A ($4,400, no escrow) vs. Document B ($2,200 in interest-bearing escrow).
* **Spoken Script:**
  > "Priya pushes back on the landlord and receives a revised draft. But how can she be sure what actually changed?
  >
  > Priya opens the Compare view and drops both versions in. ClauseWise aligns the clauses semantically via vector embeddings—meaning reordered sections still match perfectly. The side-by-side delta table clearly shows the improvement: Section 6 now mandates 24-hour advance notice, and her deposit drops to one month held in escrow. The system tags these changes with 'Favors Tenant', giving Priya immediate validation."

---

### Beat 5: Action Checklist & Lawyer-Ready Export (1:55 – 2:20)
* **Screen:** Export panel / Modal.
* **Action:**
  1. Click **Generate Checklist & Questions** or **Export Summary**.
  2. Display the rendered Markdown checklist.
  3. Highlight the two distinct sections:
     - *Action Checklist:* "1. Confirm security deposit is placed in an escrow account before transfer..."
     - *Questions for Your Lawyer:* "1. Under Section 9, does the mandatory arbitration clause forfeit my local tenant rights under municipal housing law?"
* **Visual Elements to Point Out:**
  - Imperative action verbs ("Verify", "Request", "Document").
  - Precise, clause-cited lawyer questions ready to print or email.
* **Spoken Script:**
  > "Before signing, Priya needs an actionable plan. She clicks Export.
  >
  > ClauseWise generates two high-value deliverables: an Action Checklist with concrete steps she can take today, and a list of sharp, clause-cited questions to bring to a legal aid clinic or attorney. Instead of walking in overwhelmed, Priya walks in prepared with specific questions like: 'Does the Section 9 arbitration waiver waive my local rent board remedies?'"

---

### Beat 6: Safety Guardrail & Ethical Boundary (2:20 – 2:45)
* **Screen:** Q&A panel.
* **Action:**
  1. Enter an out-of-scope legal advice question:
     `Will I win in court if I sue my landlord for entering without notice?`
  2. Click **Ask**.
  3. Observe the graceful refusal and the amber prompt banner:
     *"This question asks for legal advice or outcome prediction, which ClauseWise cannot provide. Would you like to add this to your Lawyer Question List?"*
  4. Click **Add to Lawyer Questions**.
* **Spoken Script:**
  > "Finally, let's test our core safety guardrail. Priya asks: 'Will I win in court if I sue my landlord?'
  >
  > ClauseWise refuses immediately. It never provides legal advice, never drafts binding legal text, and never predicts courtroom outcomes. Instead, it explains the boundary honestly and offers to log the question directly into her lawyer checklist.
  >
  > ClauseWise bridges the legal divide: delivering clarity, accessibility, and peace of mind to everyday signers."

---

## Presenter Checklist & Quick Setup

- [ ] Backend running: `npm run dev --prefix backend` (`http://localhost:3000`)
- [ ] Frontend running: `npm run dev --prefix frontend` (`http://localhost:5173`)
- [ ] `GEMINI_API_KEY` set in `backend/.env`
- [ ] Sample files ready on desktop or in `sample-documents/`:
  - `sample-documents/sample-lease-priya.txt`
  - `sample-documents/sample-lease-priya-revised.txt`
- [ ] Browser window sized to standard 1080p (or 1536x864) with clean developer tools closed.
