# ClauseWise Scalability & Memory Architecture

## Executive Architecture Summary

ClauseWise is an AI legal document copilot built for the Google Virtual Promptwars contest (Vertical: *AI for Legal Assistance & Access*). In legal document processing, confidentiality and privacy are paramount. Users upload sensitive contracts, non-disclosure agreements, and employment agreements. 

To satisfy the contest's strict privacy constraints:
- **Zero Document Retention**: Uploaded document text, extracted clauses, embeddings, and user questions are **never** written to persistent disk or relational databases (GDPR / SOC2 / Attorney-Client privilege compliance).
- **Ephemeral State Lifecycle**: Document state lives strictly within ephemeral in-memory stores with an automatic 30-minute Time-to-Live (TTL).

This document outlines how ClauseWise eliminates operational bottlenecks, resolves memory pressure risks, and achieves horizontal scalability across multiple server instances.

---

## 1. Dual-Constraint LRU Cache: Eliminating Memory Pressure

### The Challenge
A naive in-memory store bounding only the *count* of documents (e.g. `MAX_DOCUMENTS = 100`) creates a vulnerability to memory exhaustion:
- An uploaded contract can span up to 150,000 characters.
- Dense embedding vectors generated for chunks and clauses each require 768 dimensions of 64-bit floating-point numbers (`768 * 8 = 6,144 bytes per vector`).
- A document with 50 chunks retains ~307 KB of vector data alone, plus extracted text and analysis metadata.
- Under heavy concurrent usage with maximum-size documents, a pure count-based cache could exceed the container's 512Mi allocation.

### The Solution: Byte-Budgeted LRU (`MemoryDocumentStore`)
ClauseWise implements a **Dual-Constraint LRU eviction engine** in [`backend/src/lib/documentStore.ts`](backend/src/lib/documentStore.ts) that monitors real-time V8 heap footprint alongside document count:

```typescript
export interface DocumentStore {
  storeDocument(doc: StoredDocument): void;
  getDocument(documentId: string): StoredDocument | undefined;
  deleteDocument(documentId: string): void;
  setClassification(documentId: string, classification: Classification): void;
  setAnalysis(documentId: string, analysis: AnalysisResponse): void;
  setChunkEmbeddings(documentId: string, embeddings: number[][]): void;
  setClauseEmbeddings(documentId: string, embeddings: number[][]): void;
  getMetrics(): { count: number; estimatedBytes: number; maxBytes: number; maxCount: number };
}
```

#### Dual Thresholds:
1. **Count Constraint**: `MAX_DOCUMENTS = 100` (configurable)
2. **Byte Budget**: `MAX_STORE_BYTES = 50 MB` (configurable via `MAX_STORE_BYTES` env var)

#### Dynamic Weight Tracking:
The store calculates the true heap weight of every document dynamically via `estimateDocBytes()`:
- UTF-16 characters: 2 bytes per char for `fullText` and `chunks[i].text`.
- Float64 dense vectors: `vectors.length * 768 * 8 bytes` for both `chunkEmbeddings` and `clauseEmbeddings`.
- JSON metadata for parsed clauses, plain language summaries, and risk severity ratings.

#### Proactive Eviction:
When an incoming upload or lazy embedding generation pushes total store usage past either the document cap or the 50 MB byte budget, the store immediately evicts least-recently-used documents until both thresholds are satisfied. This guarantees **450+ MB of dedicated headroom** for V8 garbage collection, Express networking, and streaming buffers within Cloud Run's 512Mi allocation, completely mitigating memory pressure.

#### Belt-and-Suspenders Expiry:
- **Scheduled Background Sweep**: An unref'd `setInterval` sweep executes every 5 minutes, removing documents older than 30 minutes without blocking the Node event loop.
- **Lazy On-Access Sweep**: `getDocument(id)` checks timestamp freshness in O(1) time, instantly evicting expired records even if the background sweep has not yet run.

---

## 2. Horizontal Scalability Across Multiple Server Instances

### The Challenge
If an in-memory store is pinned to a single Node.js process, horizontally scaling a container service (e.g. from 1 to 3 Cloud Run instances) risks request fragmentation:
- A user uploads a document to `Instance A` (`POST /api/documents`).
- The user's subsequent analysis request (`POST /api/documents/:id/analyze`) might route to `Instance B`, resulting in an unexpected 404 (Document Not Found).

### The Multi-Layer Scalability Solution

ClauseWise resolves this through a two-tiered architectural strategy:

```
                          ┌───────────────────────────┐
                          │   Cloud Run Load Balancer │
                          │  (Session Affinity Cookie)│
                          └─────────────┬─────────────┘
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
        ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
        │ Cloud Run Pod 1 │    │ Cloud Run Pod 2 │    │ Cloud Run Pod 3 │
        │  (MemoryStore)  │    │  (MemoryStore)  │    │  (MemoryStore)  │
        └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                 │                      │                      │
                 └──────────────────────┼──────────────────────┘
                                        ▼
                         [Optional Ephemeral Cache]
                     Google Cloud Memorystore / Valkey / Redis
                        (SETEX key 1800 ... — 30-min TTL)
```

#### Layer 1: Cloud Run Session Affinity (Zero-Infrastructure)
Cloud Run provides native **Session Affinity** (`--session-affinity`). 
- When enabled, Cloud Run issues an encrypted affinity cookie (`__GCP_SESSION_AFFINITY`) to the client upon their initial request.
- Subsequent requests for the same session (`/classify`, `/analyze`, `/ask`, `/export`) are deterministically routed to the exact container instance that ingested the document.
- **Result**: Complete horizontal scalability across 1..N container instances without requiring external database infrastructure. If traffic surges, Cloud Run spins up new instances to handle new user sessions, while existing sessions remain sticky and fast.

#### Layer 2: Pluggable Distributed Ephemeral Store (Enterprise Tier)
ClauseWise decouples storage via the `DocumentStore` interface. For multi-region enterprise clusters where cross-region session stickiness is required, ClauseWise can be configured with a distributed ephemeral store (e.g., Google Cloud Memorystore / Valkey / Redis):
- **Implementation**: Documents are serialized and stored with native TTL (`SETEX doc:<id> 1800 <payload>`).
- **Privacy Preservation**: Data is stored exclusively in ephemeral RAM with auto-deletion after 30 minutes. No persistent disks, snapshots, or database backups are created.
- **Result**: Any container instance in any region can serve any request without state fragmentation.

---

## 3. Streaming Concurrency & Wire Efficiency

### Server-Sent Events (SSE) with Zero-Buffering
- **Latency-Critical Endpoints**: `/analyze` and `/ask` use Server-Sent Events (`text/event-stream`).
- **Intermediate Proxy Bypassing**:
  - `Cache-Control: no-cache, no-transform`: Prevents CDNs, reverse proxies, and Google Frontend from transcoding or buffering SSE tokens.
  - `X-Accel-Buffering: no`: Informs upstream NGINX/reverse proxies to stream chunks immediately.
  - `compression()` Middleware Filter: Express gzip compression is explicitly bypassed for all `text/event-stream` requests, preventing gzip buffer delays.
  - Immediate `flushHeaders()` and `res.flush()` dispatches tokens as they arrive from Gemini's `generateContentStream()`.

---

## 4. Scalability Verification Matrix

| Criterion | Mechanism | Verification / Guarantee |
|---|---|---|
| **Memory Pressure** | Dual-Constraint LRU (`MAX_STORE_BYTES = 50MB`) | V8 heap stays within safe limits; LRU evicts large files before OOM can occur. Verified in unit tests. |
| **Horizontal Scaling** | Cloud Run Session Affinity (`--session-affinity`) | Sticky client sessions route consecutive requests to the container holding the in-memory document. |
| **Distributed Readiness** | Pluggable `DocumentStore` Interface | Zero domain coupling; drop-in ready for Redis / Memorystore without code rewrites. |
| **TTL Enforcement** | 5-min sweep + O(1) lazy read check | Documents guaranteed purged within 30 minutes; zero memory leaks. |
| **Network Efficiency** | SSE + `no-transform` + Compression bypass | Chunks stream in real-time; wire payload size minimized. |
| **Privacy Compliance** | Zero Disk Persistence | Complies with legal vertical regulations (GDPR, confidentiality, attorney privilege). |
