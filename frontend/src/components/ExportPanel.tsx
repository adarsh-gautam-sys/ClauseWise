/**
 * ExportPanel
 *
 * A shadcn Dialog that calls POST /api/documents/:id/export, renders the
 * returned Markdown, and provides a copy-to-clipboard action.
 *
 * Props:
 *   documentId      — required to call the export endpoint
 *   persona         — forwarded to the endpoint for prompt tone
 *   outOfScopeQs    — accumulated from Q&A in_scope=false responses
 *   trigger         — React node to use as the Dialog trigger (e.g. a Button)
 */

import { useState } from "react";
import { Copy, Check, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { exportDocument } from "@/lib/api";
import type { ExportResult } from "@/types";

interface ExportPanelProps {
  documentId: string;
  persona: string;
  outOfScopeQs: string[];
  trigger: React.ReactNode;
}

export function ExportPanel({
  documentId,
  persona,
  outOfScopeQs,
  trigger,
}: ExportPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && result === null) {
      await fetchExport();
    }
  };

  const fetchExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await exportDocument(documentId, persona, outOfScopeQs);
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Export failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available — silently fail
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clausewise-export-${documentId.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent
        className="max-w-2xl"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--foreground)" }}>
            Export Checklist &amp; Lawyer Questions
          </DialogTitle>
          <DialogDescription style={{ color: "var(--muted-foreground)" }}>
            A concrete action checklist and targeted questions to bring to your
            lawyer, generated from the clause analysis.
          </DialogDescription>
        </DialogHeader>

        {/* Loading */}
        {loading && (
          <div
            className="flex flex-col items-center gap-3 py-12"
            role="status"
            aria-live="polite"
            aria-label="Generating export…"
          >
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: "var(--primary)" }}
              aria-hidden="true"
            />
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Generating checklist…
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="space-y-3">
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchExport()}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="flex flex-col gap-4">
            {/* Action bar */}
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleDownload()}
                className="gap-1.5 text-xs"
                style={{ color: "var(--muted-foreground)" }}
                aria-label="Download as Markdown file"
              >
                <Download size={13} aria-hidden="true" />
                Download .md
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleCopy()}
                className="gap-1.5 text-xs"
                aria-label={copied ? "Copied!" : "Copy Markdown to clipboard"}
              >
                {copied ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            {/* Markdown rendered as styled pre */}
            <ScrollArea className="h-[400px] w-full rounded-lg border" style={{ borderColor: "var(--border)" }}>
              <pre
                className="p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono"
                style={{ color: "var(--foreground)", background: "var(--muted)" }}
                aria-label="Export markdown content"
              >
                {result.markdown}
              </pre>
            </ScrollArea>

            {/* Out-of-scope note */}
            {outOfScopeQs.length > 0 && (
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {outOfScopeQs.length} out-of-scope question
                {outOfScopeQs.length !== 1 ? "s" : ""} from Q&amp;A included in
                lawyer questions.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
