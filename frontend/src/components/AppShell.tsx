/**
 * AppShell — fixed header, scrollable main, sticky footer.
 *
 * The header is always 56px tall. Main carries enough padding to never
 * be obscured. Footer is one line of disclaimer text.
 *
 * Accessibility:
 * - <header> / <main> / <footer> landmarks
 * - Skip-to-main link for keyboard users
 * - WCAG 2.1 AA: 4.5:1 minimum contrast on all text
 */

import { Scale } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--background)" }}>
      {/* Skip link — keyboard-only visible */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold"
        style={{
          background: "var(--primary)",
          color: "var(--primary-foreground)",
        }}
      >
        Skip to main content
      </a>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 flex h-14 items-center border-b px-6"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
          {/* Wordmark */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
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

          {/* Not legal advice badge */}
          <span
            className="hidden rounded-full border px-3 py-1 text-xs font-medium sm:inline-flex"
            style={{
              borderColor: "var(--border)",
              color: "var(--muted-foreground)",
            }}
            aria-label="Disclaimer: not legal advice"
          >
            Not legal advice
          </span>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center px-4 py-12 outline-none"
      >
        {children}
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
