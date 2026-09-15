/**
 * App — root component.
 *
 * Global state:
 *   persona          — selected in header, passed to all screens
 *   activeTab        — Understand | Compare | Q&A
 *   uploadResult     — result of POST /api/documents (doc A)
 *   analysisResult   — result of classify + analyze (doc A)
 *   outOfScopeQs     — questions from Q&A that were out-of-scope, passed to export
 *   outOfScopeAdded  — set of question strings already added (prevents duplicates)
 *
 * scrollToClause(id):
 *   Switches to the Understand tab and scrolls to the clause element with
 *   id={clauseId}. Called from Q&A cited-section buttons.
 */

import { useState, useCallback } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell, type AppTab } from "@/components/AppShell";
import { UploadScreen } from "@/components/UploadScreen";
import { UnderstandPage } from "@/pages/UnderstandPage";
import { ComparePage } from "@/pages/ComparePage";
import { QAPage } from "@/pages/QAPage";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";
import type { Persona } from "@/components/PersonaSelect";
import type { UploadResult, AnalysisResult } from "@/types";

function App() {
  const [persona, setPersona]             = useState<Persona | "">("");
  const [activeTab, setActiveTab]         = useState<AppTab>("understand");
  const [uploadResult, setUploadResult]   = useState<UploadResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [outOfScopeQs, setOutOfScopeQs]  = useState<string[]>([]);
  const [outOfScopeAdded, setOutOfScopeAdded] = useState<Set<string>>(new Set());

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleUploadSuccess = (result: UploadResult) => {
    setUploadResult(result);
    setAnalysisResult(null); // reset analysis for new document
  };

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result);
  };

  const handleReset = () => {
    setUploadResult(null);
    setAnalysisResult(null);
    setOutOfScopeQs([]);
    setOutOfScopeAdded(new Set());
  };

  const handleAddOutOfScope = useCallback((question: string) => {
    setOutOfScopeAdded((prev) => new Set([...prev, question]));
    setOutOfScopeQs((prev) =>
      prev.includes(question) ? prev : [...prev, question],
    );
  }, []);

  /**
   * scrollToClause — called from QAPage when user clicks a cited-section link.
   * Switches to Understand tab, then after the tab renders, scrolls to the
   * clause card by its id.
   */
  const scrollToClause = useCallback((clauseId: string) => {
    setActiveTab("understand");
    // Give the tab panel time to mount/show before scrolling
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(clauseId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Brief focus highlight — add a transient ring
          el.style.outline = "2px solid var(--primary)";
          el.style.outlineOffset = "3px";
          setTimeout(() => {
            el.style.outline = "";
            el.style.outlineOffset = "";
          }, 1800);
        }
      }, 80);
    });
  }, []);

  // ── Tab content ───────────────────────────────────────────────────────────

  const understandContent = uploadResult === null ? (
    <UploadScreen persona={persona} onSuccess={handleUploadSuccess} />
  ) : (
    <UnderstandPage
      uploadResult={uploadResult}
      persona={persona}
      analysisResult={analysisResult}
      onAnalysisComplete={handleAnalysisComplete}
      onReset={handleReset}
      outOfScopeQs={outOfScopeQs}
    />
  );

  const compareContent = analysisResult === null ? (
    <PlaceholderScreen
      title="Analyze a document first"
      description="Upload and analyze a document on the Understand tab, then come back here to compare it with a second document."
    />
  ) : (
    <ComparePage docAResult={analysisResult} persona={persona} />
  );

  const askContent = analysisResult === null ? (
    <PlaceholderScreen
      title="Analyze a document first"
      description="Upload and analyze a document on the Understand tab, then come back here to ask questions about it."
    />
  ) : (
    <QAPage
      analysisResult={analysisResult}
      onScrollToClause={scrollToClause}
      onAddOutOfScope={handleAddOutOfScope}
      outOfScopeAdded={outOfScopeAdded}
    />
  );

  return (
    <TooltipProvider delayDuration={300}>
      <AppShell
        persona={persona}
        onPersonaChange={setPersona}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        understandContent={understandContent}
        compareContent={compareContent}
        askContent={askContent}
      />
    </TooltipProvider>
  );
}

export default App;
