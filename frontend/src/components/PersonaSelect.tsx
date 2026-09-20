/**
 * PersonaSelect
 *
 * Shadcn Select wrapper for choosing the user's persona. Lives in the header
 * so it's always accessible regardless of which tab is active.
 *
 * Accessibility: shadcn Select uses Radix UI internally — it handles keyboard
 * navigation (arrow keys, Enter, Escape), ARIA combobox/listbox semantics,
 * and focus management. No hand-built ARIA needed here.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export type Persona = "tenant" | "employee" | "freelancer" | "consumer" | "small_business_owner";

interface PersonaOption {
  value: Persona;
  label: string;
  descriptor: string;
}

const PERSONAS: PersonaOption[] = [
  { value: "tenant", label: "Tenant", descriptor: "Lease / Rental" },
  { value: "employee", label: "Employee", descriptor: "Offer / Contract" },
  { value: "freelancer", label: "Freelancer", descriptor: "Service / NDA" },
  { value: "consumer", label: "Consumer", descriptor: "ToS / Privacy" },
  { value: "small_business_owner", label: "Business Owner", descriptor: "Vendor / Loan" },
];

interface PersonaSelectProps {
  value: Persona | "";
  onChange: (persona: Persona) => void;
}

export function PersonaSelect({ value, onChange }: PersonaSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor="persona-select-trigger"
        className="hidden whitespace-nowrap text-xs sm:block"
        style={{ color: "var(--muted-foreground)" }}
      >
        I am a
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as Persona)}>
        <SelectTrigger
          id="persona-select-trigger"
          className="min-h-[44px] sm:min-h-0 sm:h-8 w-[160px] text-xs sm:w-[180px]"
          aria-label="Select your persona"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: value ? "var(--foreground)" : "var(--muted-foreground)",
          }}
        >
          <SelectValue placeholder="Select persona…" />
        </SelectTrigger>
        <SelectContent
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          {PERSONAS.map((p) => (
            <SelectItem key={p.value} value={p.value} className="py-2.5 sm:py-1.5 text-xs">
              <span className="font-medium">{p.label}</span>
              <span className="ml-1.5" style={{ color: "var(--muted-foreground)" }}>
                — {p.descriptor}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
