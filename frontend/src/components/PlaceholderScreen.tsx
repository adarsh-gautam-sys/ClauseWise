/**
 * PlaceholderScreen
 *
 * Shown for tabs not yet implemented (Compare, Q&A).
 * Makes it clear the tab is coming and how to unlock it.
 */

interface PlaceholderScreenProps {
  title: string;
  description: string;
}

export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <div
        className="mx-auto max-w-sm rounded-2xl border px-8 py-10"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
        }}
      >
        <p
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: "var(--muted-foreground)" }}
        >
          Coming soon
        </p>
        <h2
          className="mt-2 text-xl font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          {title}
        </h2>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
