/**
 * SeverityBadge
 *
 * Renders a severity level with BOTH a color dot AND a text label.
 * Color alone is never used to communicate severity — this is a hard
 * accessibility requirement (AGENTS.md, PRODUCT.md, WCAG 1.4.1).
 *
 * Usage:
 *   <SeverityBadge level="high" />
 *   <SeverityBadge level="medium" />
 *   <SeverityBadge level="low" />
 */

import { cn } from "@/lib/utils";

export type SeverityLevel = "high" | "medium" | "low";

interface SeverityBadgeProps {
  level: SeverityLevel;
  className?: string;
}

const CONFIG: Record<
  SeverityLevel,
  { label: string; dotStyle: string; containerStyle: string }
> = {
  high: {
    label: "High",
    dotStyle: "bg-[var(--severity-high)]",
    containerStyle: "bg-[var(--severity-high-bg)] text-[var(--severity-high)]",
  },
  medium: {
    label: "Medium",
    dotStyle: "bg-[var(--severity-medium)]",
    containerStyle:
      "bg-[var(--severity-medium-bg)] text-[var(--severity-medium)]",
  },
  low: {
    label: "Low",
    dotStyle: "bg-[var(--severity-low)]",
    containerStyle: "bg-[var(--severity-low-bg)] text-[var(--severity-low)]",
  },
};

export function SeverityBadge({ level, className }: SeverityBadgeProps) {
  const { label, dotStyle, containerStyle } = CONFIG[level];
  return (
    <span
      role="img"
      aria-label={`Severity: ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        containerStyle,
        className,
      )}
    >
      {/* Color dot — purely decorative; text label carries the meaning */}
      <span
        className={cn("inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full", dotStyle)}
        aria-hidden="true"
      />
      {/* Text label — always present, never omitted */}
      {label}
    </span>
  );
}
