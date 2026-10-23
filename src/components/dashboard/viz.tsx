import type { ReactNode } from "react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

import { cn } from "@/lib/utils"

/** Chart colours, from the --viz-* tokens in index.css. */
export const COLORS = {
  done: "var(--viz-good)",
  error: "var(--viz-critical)",
  cancelled: "var(--viz-muted)",
  image: "var(--viz-1)",
  video: "var(--viz-2)",
  audio: "var(--viz-3)",
  other: "var(--viz-muted)",
  smaller: "var(--viz-1)",
  bigger: "var(--viz-2)",
} as const

export const SERIES_LABELS: Record<string, string> = {
  done: "Succeeded",
  error: "Failed",
  cancelled: "Cancelled",
  image: "Images",
  video: "Video",
  audio: "Audio",
  other: "Other",
}

/** Recessive axis styling shared by every Recharts chart. */
export const AXIS = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
} as const

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("bg-card flex min-w-0 flex-col gap-4 rounded-2xl border p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-medium">{title}</h3>
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-muted-foreground flex flex-1 items-center justify-center py-8 text-center text-sm", className)}>
      {children}
    </div>
  )
}

export function Swatch({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", className)} style={{ background: color }} />
}

export function Legend({ items }: { items: { key: string; label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-1.5">
          {item.dashed ? (
            <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: item.color }} />
          ) : (
            <Swatch color={item.color} />
          )}
          {item.label}
        </span>
      ))}
    </div>
  )
}

/** The card a chart's hover tooltip renders. */
export function TooltipCard({ title, rows }: { title: ReactNode; rows: { key: string; label: string; value: string; color?: string }[] }) {
  return (
    <div className="bg-popover text-popover-foreground min-w-36 rounded-lg border px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground flex items-center gap-1.5">
              {row.color && <Swatch color={row.color} className="size-2" />}
              {row.label}
            </span>
            <span className="font-medium tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A tiny trend line with no axes, for stat tiles and table rows. */
export function Sparkline({ data, className }: { data: { value: number | null }[]; className?: string }) {
  const flat = data.every((d) => d.value === data[0]?.value)
  return (
    <div className={cn("h-8 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 120, height: 32 }} debounce={60}>
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Area
            type="monotone"
            dataKey="value"
            connectNulls
            stroke={flat ? "var(--viz-muted)" : "var(--viz-1)"}
            strokeWidth={1.5}
            fill="var(--viz-1)"
            fillOpacity={flat ? 0 : 0.1}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export const formatSeconds = (ms: number | null) => {
  if (ms === null) return "—"
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(1)}s`
  if (s < 90) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${String(Math.round(s % 60)).padStart(2, "0")}s`
}

export const formatAgo = (t: number, now = Date.now()) => {
  const minutes = Math.round((now - t) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "yesterday" : `${days} days ago`
}
