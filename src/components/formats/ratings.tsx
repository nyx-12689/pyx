// The pieces that show a format's ratings and features, used in each article's "At a glance" box.

import { Check, Minus } from "lucide-react"

import type { Column, Mark, Rating } from "@/lib/format-guide"
import { cn } from "@/lib/utils"

export const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"]

export function ExtChip({ children }: { children: string }) {
  return <span className="bg-muted text-muted-foreground rounded px-1.5 py-px font-mono text-[11px]">{children}</span>
}

export function Cell({ column, value }: { column: Column; value: Rating | Mark | string | undefined }) {
  if (column.kind === "rating") {
    const rating = value as Rating
    return (
      <span className="inline-flex" title={RATING_WORDS[rating]}>
        <Meter value={rating} />
        <span className="sr-only">{RATING_WORDS[rating]}</span>
      </span>
    )
  }
  if (column.kind === "mark") return <MarkCell value={value as Mark} />
  return <span className="text-foreground/90 text-xs">{String(value ?? "")}</span>
}

/** Five short bars, filled from the left. */
export function Meter({ value }: { value: number }) {
  return (
    <span aria-hidden className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cn("h-2 w-2.5 rounded-[2px]", n <= value ? "bg-foreground/80" : "bg-foreground/10")} />
      ))}
    </span>
  )
}

export function MarkCell({ value }: { value: Mark }) {
  if (value === true) {
    return (
      <span className="bg-foreground/90 text-background inline-flex size-5 items-center justify-center rounded-full">
        <Check className="size-3" strokeWidth={3} />
        <span className="sr-only">Yes</span>
      </span>
    )
  }
  if (value === false) {
    return (
      <span className="text-muted-foreground/60 inline-flex size-5 items-center justify-center">
        <Minus className="size-3.5" />
        <span className="sr-only">No</span>
      </span>
    )
  }
  // A partial answer, said in a word or two.
  return (
    <span className="border-foreground/15 text-foreground/80 inline-block rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap">
      {value}
    </span>
  )
}
