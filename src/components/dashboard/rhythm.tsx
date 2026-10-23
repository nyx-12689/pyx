import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Panel } from "@/components/dashboard/viz"
import { Button } from "@/components/ui/button"
import { monthCalendar } from "@/lib/analytics"
import type { HistoryRecord } from "@/lib/types"
import { cn } from "@/lib/utils"
import { HISTORY_DAYS } from "@/store"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/** 0 for none, else 1–5 by share of the busiest day. */
const level = (count: number, max: number) => (count <= 0 || max === 0 ? 0 : Math.min(5, Math.ceil((count / max) * 5)))
const fill = (l: number) => (l === 0 ? "var(--muted)" : `var(--viz-seq-${l})`)

function Scale() {
  return (
    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
      Fewer
      {[0, 1, 2, 3, 4, 5].map((l) => (
        <span key={l} className="size-2.5 rounded-[3px]" style={{ background: fill(l) }} />
      ))}
      More
    </span>
  )
}

/** Jobs per day for one month, GitHub-style, stepping back and forth a month at a time. */
export function MonthCalendar({ records }: { records: HistoryRecord[] }) {
  const now = new Date()
  // Months back from the current one: 0 is this month.
  const [offset, setOffset] = useState(0)
  const [hover, setHover] = useState<string | null>(null)
  const shown = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  const year = shown.getFullYear()
  const month = shown.getMonth()

  // History only goes back HISTORY_DAYS, so stop at the month that covers its start.
  const oldest = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000)
  const maxOffset = (now.getFullYear() - oldest.getFullYear()) * 12 + now.getMonth() - oldest.getMonth()

  const weeks = useMemo(() => monthCalendar(records, year, month), [records, year, month])
  const days = weeks.flat().filter((d) => d.count !== null)
  const max = Math.max(0, ...days.map((d) => d.count ?? 0))
  const total = days.reduce((n, d) => n + (d.count ?? 0), 0)
  const active = days.filter((d) => (d.count ?? 0) > 0).length
  const title = shown.toLocaleDateString(undefined, { month: "long", year: "numeric" })

  return (
    <Panel
      title={title}
      description={`${total.toLocaleString()} ${total === 1 ? "job" : "jobs"} · active on ${active} of ${days.length} days`}
      actions={
        <div className="flex items-center gap-3">
          <Scale />
          <div className="flex items-center gap-0.5">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Previous month"
              disabled={offset >= maxOffset}
              onClick={() => setOffset((o) => o + 1)}
            >
              <ChevronLeft />
            </Button>
            <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => setOffset(0)}>
              This month
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Next month"
              disabled={offset === 0}
              onClick={() => setOffset((o) => o - 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-1.5" onMouseLeave={() => setHover(null)}>
        <div className="text-muted-foreground grid grid-cols-7 gap-1.5 text-[11px]">
          {WEEKDAYS.map((d) => (
            <span key={d} className="px-1">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={w} className="grid grid-cols-7 gap-1.5">
            {week.map((d) => {
              if (d.date < 0) return <span key={d.date} />
              const day = new Date(d.date).getDate()
              const l = d.count === null ? 0 : level(d.count, max)
              return (
                <span
                  key={d.date}
                  className={cn(
                    "flex h-11 items-start rounded-md p-1.5 text-[11px] tabular-nums",
                    d.count === null && "opacity-40",
                    // The ramp runs light → dark (quiet → busy) in both themes.
                    l === 0 && "text-muted-foreground",
                    l > 0 && (l >= 3 ? "text-white" : "text-neutral-800"),
                  )}
                  style={{ background: fill(l) }}
                  onMouseEnter={() =>
                    setHover(
                      `${new Date(d.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${
                        d.count === null ? "still to come" : `${d.count} ${d.count === 1 ? "job" : "jobs"}`
                      }`,
                    )
                  }
                >
                  {day}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <p className={cn("h-4 text-xs tabular-nums", hover ? "text-foreground" : "text-muted-foreground")}>
        {hover ?? "Hover a day for its count."}
      </p>
    </Panel>
  )
}
