/**
 * AppShell
 *
 * Persistent layout: fixed header, tabbed main content, sticky footer.
 *
 * Header contains:
 * - ClauseWise logo + wordmark (left)
 * - PersonaSelect dropdown (centre-right)
 * - "Not legal advice" badge (right, hidden on smallest screens)
 *
 * Main contains:
 * - Tabs: Understand | Compare | Q&A (shadcn Tabs)
 * - Active tab content rendered by App.tsx
 *
 * Footer: one-line permanent legal disclaimer (AGENTS.md requirement).
 *
 * Accessibility:
 * - Skip-to-main link (visible on focus, for keyboard users)
 * - <header>, <main>, <footer> landmarks
 * - Tabs use Radix UI — full keyboard navigation and ARIA roles built in
 * - Tab panels have id/aria-labelledby via shadcn
 */

import { Scale } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PersonaSelect, type Persona } from "@/components/PersonaSelect";

export type AppTab = "understand" | "compare" | "ask";

interface AppShellProps {
  persona: Persona | "";
  onPersonaChange: (p: Persona) => void;
  activeTab: AppTab;
  onTabChange: (t: AppTab) => void;
  understandContent: React.ReactNode;
  compareContent: React.ReactNode;
  askContent: React.ReactNode;
}

export function AppShell({
  persona,
  onPersonaChange,
  activeTab,
  onTabChange,
  understandContent,
  compareContent,
  askContent,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--background)" }}>
      {/* ── Skip link ─────────────────────────────────────────────────────── */}
      {/* .skip-link CSS in index.css: hidden by default, visible on focus-visible */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Wordmark */}
          <div className="flex flex-shrink-0 items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
              aria-hidden="true"
            >
              <Scale size={16} strokeWidth={2.5} />
            </div>
            <span
              className="text-[1.0625rem] font-semibold tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              ClauseWise
            </span>
          </div>

          {/* Persona selector + badge */}
          <div className="flex items-center gap-3">
            <PersonaSelect value={persona} onChange={onPersonaChange} />
            <span
              className="hidden rounded-full border px-2.5 py-1 text-xs font-medium lg:inline-flex"
              style={{
                borderColor: "var(--border)",
                color: "var(--muted-foreground)",
              }}
              aria-label="Disclaimer: not legal advice"
            >
              Not legal advice
            </span>
          </div>
        </div>
      </header>

      {/* ── Main with Tabs ───────────────────────────────────────────────── */}
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <Tabs
          value={activeTab}
          onValueChange={(v) => onTabChange(v as AppTab)}
          className="flex flex-1 flex-col"
        >
          {/* Tab strip */}
          <div className="border-b" style={{ borderColor: "var(--border)" }}>
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <TabsList
                className="h-auto rounded-none border-0 bg-transparent p-0"
                aria-label="Main navigation"
              >
                {(
                  [
                    { value: "understand", label: "Understand" },
                    { value: "compare", label: "Compare" },
                    { value: "ask", label: "Q&A" },
                  ] as const
                ).map(({ value, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="relative rounded-none border-0 bg-transparent px-4 py-3 text-sm font-medium shadow-none transition-colors data-[state=active]:shadow-none"
                    style={{
                      color: activeTab === value ? "var(--foreground)" : "var(--muted-foreground)",
                      // Active indicator via border-bottom trick
                      borderBottom:
                        activeTab === value ? "2px solid var(--primary)" : "2px solid transparent",
                    }}
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          {/* Tab panels */}
          <TabsContent value="understand" className="mt-0 flex flex-1 flex-col outline-none">
            <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
              {understandContent}
            </div>
          </TabsContent>

          <TabsContent value="compare" className="mt-0 flex flex-1 flex-col outline-none">
            <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
              {compareContent}
            </div>
          </TabsContent>

          <TabsContent value="ask" className="mt-0 flex flex-1 flex-col outline-none">
            <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">{askContent}</div>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        className="border-t px-6 py-4 text-center text-xs leading-relaxed"
        style={{
          borderColor: "var(--border)",
          color: "var(--muted-foreground)",
        }}
      >
        ClauseWise provides AI-assisted document analysis for informational purposes only.{" "}
        <strong className="font-medium" style={{ color: "var(--foreground)" }}>
          It is not a substitute for professional legal advice.
        </strong>{" "}
        Consult a qualified lawyer before acting on any analysis.
      </footer>
    </div>
  );
}
