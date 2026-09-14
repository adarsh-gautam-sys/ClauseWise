/**
 * App — root routing shell.
 *
 * For now: upload screen only. A documentId in state transitions to the
 * results screen (Part 10). The AppShell wraps every view.
 */

import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { UploadScreen, type UploadResult } from "./components/UploadScreen";
import type { Persona } from "./components/PersonaSelector";

interface AnalysisState {
  result: UploadResult;
  persona: Persona;
}

function App() {
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);

  const handleUploadSuccess = (result: UploadResult, persona: Persona) => {
    setAnalysis({ result, persona });
  };

  return (
    <AppShell>
      {analysis === null ? (
        <UploadScreen onSuccess={handleUploadSuccess} />
      ) : (
        /* Results screen — to be built in Part 10 */
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div
            className="rounded-2xl border p-8"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              maxWidth: "36rem",
              width: "100%",
            }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
              Document uploaded
            </p>
            <p
              className="mt-2 text-2xl font-semibold tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              {analysis.result.documentId.slice(0, 8)}…
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
              {analysis.result.chunkCount} chunks · {analysis.persona} persona
            </p>
            <p
              className="mt-4 rounded-lg border px-4 py-3 text-left text-xs leading-relaxed"
              style={{
                borderColor: "var(--border)",
                color: "var(--muted-foreground)",
                background: "var(--muted)",
              }}
            >
              <strong style={{ color: "var(--foreground)" }}>Preview: </strong>
              {analysis.result.preview}
            </p>
            <button
              type="button"
              onClick={() => setAnalysis(null)}
              className="mt-6 text-sm underline"
              style={{ color: "var(--primary)" }}
            >
              Upload another document
            </button>
          </div>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Results screen coming in Part 10
          </p>
        </div>
      )}
    </AppShell>
  );
}

export default App;
