/**
 * PersonaSelector
 *
 * Renders a radio group of persona chips. The persona selection is the
 * product's core differentiator — it drives severity prioritisation on the
 * backend. It appears *before* the file dropzone to signal that it is the
 * first meaningful choice, not an afterthought.
 *
 * Accessibility:
 * - role="radiogroup" with aria-labelledby
 * - Each chip is a <label> wrapping a visually-hidden <input type="radio">
 * - Arrow-key navigation handled natively by the radio group
 * - Selected state communicated via aria-checked (implicit via :checked)
 * - WCAG 2.1 AA contrast on both selected and unselected states
 */

import { Home, Briefcase, Laptop, ShoppingCart, Building2 } from "lucide-react";
import { cn } from "../lib/cn";

export type Persona = "tenant" | "employee" | "freelancer" | "consumer" | "small_business_owner";

interface PersonaOption {
  id: Persona;
  label: string;
  descriptor: string;
  icon: React.ReactNode;
}

const PERSONAS: PersonaOption[] = [
  {
    id: "tenant",
    label: "Tenant",
    descriptor: "Lease / Rental",
    icon: <Home size={16} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: "employee",
    label: "Employee",
    descriptor: "Offer / Contract",
    icon: <Briefcase size={16} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: "freelancer",
    label: "Freelancer",
    descriptor: "Service / NDA",
    icon: <Laptop size={16} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: "consumer",
    label: "Consumer",
    descriptor: "ToS / Privacy",
    icon: <ShoppingCart size={16} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: "small_business_owner",
    label: "Business Owner",
    descriptor: "Vendor / Loan",
    icon: <Building2 size={16} strokeWidth={2} aria-hidden="true" />,
  },
];

interface PersonaSelectorProps {
  value: Persona | null;
  onChange: (persona: Persona) => void;
}

export function PersonaSelector({ value, onChange }: PersonaSelectorProps) {
  return (
    <div>
      <p
        id="persona-group-label"
        className="mb-3 text-sm font-medium"
        style={{ color: "var(--muted-foreground)" }}
      >
        Who are you in this agreement?
      </p>
      <div
        role="radiogroup"
        aria-labelledby="persona-group-label"
        aria-required="true"
        className="flex flex-wrap gap-2"
      >
        {PERSONAS.map((p) => {
          const isSelected = value === p.id;
          return (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer select-none items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-150",
                "hover:border-[var(--primary)] hover:text-[var(--foreground)]",
                isSelected
                  ? "border-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)]",
              )}
              style={
                isSelected
                  ? {
                      background: "var(--primary)",
                      borderColor: "var(--primary)",
                      color: "var(--primary-foreground)",
                      boxShadow: "0 0 0 1px var(--primary)",
                    }
                  : {
                      background: "var(--surface)",
                    }
              }
            >
              <input
                type="radio"
                name="persona"
                value={p.id}
                checked={isSelected}
                onChange={() => onChange(p.id)}
                className="sr-only"
              />
              {p.icon}
              <span>{p.label}</span>
              <span
                className="text-xs"
                style={{
                  color: isSelected ? "oklch(0.98 0.005 222 / 0.75)" : "var(--muted-foreground)",
                  opacity: 0.85,
                }}
              >
                — {p.descriptor}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
