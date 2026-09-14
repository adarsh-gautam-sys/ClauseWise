/**
 * UploadSuccess
 *
 * Shown on the Understand tab after a successful document upload.
 * Displays: document preview, chunk count, and a call to action for
 * the next step (classification → analysis — wired in future parts).
 *
 * For now it shows the upload result and a "Start over" link.
 */

import { FileText, Hash, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { UploadResult } from "@/components/UploadScreen";
import type { Persona } from "@/components/PersonaSelect";

const PERSONA_LABELS: Record<Persona, string> = {
  tenant: "Tenant",
  employee: "Employee",
  freelancer: "Freelancer",
  consumer: "Consumer",
  small_business_owner: "Business Owner",
};

interface UploadSuccessProps {
  result: UploadResult;
  persona: Persona;
  onReset: () => void;
}

export function UploadSuccess({ result, persona, onReset }: UploadSuccessProps) {
  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Status card */}
      <div
        className="rounded-2xl border p-6"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          boxShadow: "0 2px 4px oklch(0 0 0 / 0.25), 0 8px 24px oklch(0 0 0 / 0.15)",
        }}
      >
        {/* Header row */}
        <div className="flex items-start gap-4">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
            aria-hidden="true"
          >
            <FileText size={20} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-medium uppercase tracking-widest"
              style={{ color: "var(--muted-foreground)" }}
            >
              Document ready
            </p>
            <p
              className="mt-0.5 text-sm font-medium truncate"
              style={{ color: "var(--foreground)" }}
            >
              {result.documentId.slice(0, 8)}…
            </p>
          </div>
        </div>

        <Separator className="my-4" style={{ background: "var(--border)" }} />

        {/* Stats */}
        <dl
          className="grid grid-cols-2 gap-4"
          aria-label="Document statistics"
        >
          <div>
            <dt
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Hash size={12} aria-hidden="true" />
              Chunks
            </dt>
            <dd
              className="mt-1 text-2xl font-semibold tabular-nums"
              style={{ color: "var(--foreground)" }}
            >
              {result.chunkCount}
            </dd>
          </div>
          <div>
            <dt
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Persona
            </dt>
            <dd
              className="mt-1 text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {PERSONA_LABELS[persona]}
            </dd>
          </div>
        </dl>

        {/* Preview */}
        <div
          className="mt-4 rounded-lg border p-3"
          style={{
            borderColor: "var(--border)",
            background: "var(--muted)",
          }}
        >
          <p
            className="mb-1 text-xs font-medium"
            style={{ color: "var(--muted-foreground)" }}
          >
            Document preview
          </p>
          <p
            className="text-sm leading-relaxed line-clamp-4"
            style={{ color: "var(--foreground)" }}
          >
            {result.preview}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {/* Placeholder: classify + analyze will wire here */}
          <Button
            className="flex-1 gap-2"
            disabled
            aria-label="Analyze document — coming in next build step"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              opacity: 0.5,
            }}
          >
            Analyze Document
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            className="text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            Start over
          </Button>
        </div>

        <p
          className="mt-3 text-center text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          Analysis screens coming in the next build step
        </p>
      </div>
    </div>
  );
}
