/**
 * App — root component.
 *
 * Holds global state: persona, active tab, upload result.
 * Renders AppShell which provides header (with PersonaSelect) and Tabs.
 *
 * Understand tab: UploadScreen → UploadSuccess after successful upload.
 * Compare and Q&A tabs: PlaceholderScreen (wired in future parts).
 */

import { useState } from "react";
import { AppShell, type AppTab } from "@/components/AppShell";
import { UploadScreen, type UploadResult } from "@/components/UploadScreen";
import { UploadSuccess } from "@/components/UploadSuccess";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";
import type { Persona } from "@/components/PersonaSelect";

function App() {
  const [persona, setPersona]     = useState<Persona | "">("");
  const [activeTab, setActiveTab] = useState<AppTab>("understand");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleUploadSuccess = (result: UploadResult) => {
    setUploadResult(result);
  };

  const handleReset = () => {
    setUploadResult(null);
  };

  return (
    <AppShell
      persona={persona}
      onPersonaChange={setPersona}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      understandContent={
        uploadResult === null ? (
          <UploadScreen
            persona={persona}
            onSuccess={handleUploadSuccess}
          />
        ) : (
          <UploadSuccess
            result={uploadResult}
            persona={persona as Persona}
            onReset={handleReset}
          />
        )
      }
      compareContent={
        <PlaceholderScreen
          title="Compare Documents"
          description="Upload two documents to get a side-by-side clause comparison. Available after uploading and analyzing your first document."
        />
      }
      askContent={
        <PlaceholderScreen
          title="Ask a Question"
          description="Ask anything about your document and get a grounded answer with clause citations. Available after analysis is complete."
        />
      }
    />
  );
}

export default App;
