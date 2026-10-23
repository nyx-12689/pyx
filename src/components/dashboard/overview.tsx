import { useMemo, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts"

import { AXIS, COLORS, Empty, Legend, Panel, SERIES_LABELS, Sparkline, TooltipCard } from "@/components/dashboard/viz"
import { ChartContainer } from "@/components/ui/chart"
import { GridBeam } from "@/components/ui/grid-beam"
import { HaloTabs, HaloTabsIndicator, HaloTabsList, HaloTabsTrigger } from "@/components/ui/halo-tabs"
import { RollingNumber } from "@/components/ui/rolling-number"
import {
  type Bucket,
  change,
  type Kpi,
  kpi,
  METRICS,
  type Metric,
  type Period,
  sparkline,
  trend,
} from "@/lib/analytics"
import { formatBytes } from "@/lib/format"
import type { HistoryRecord } from "@/lib/types"
import { useResolvedTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

const KPIS: { id: Kpi; label: string; format: (n: number) => string; hint?: string }[] = [
  { id: "jobs", label: "Jobs run", format: (n) => Math.round(n).toLocaleString() },
  { id: "successRate", label: "Success rate", format: (n) => `${Math.round(n)}%`, hint: "Of jobs that finished" },
  { id: "processed", label: "Data processed", format: formatBytes },
  { id: "saved", label: "Space saved", format: formatBytes },
  { id: "time", label: "Time working", format: (n) => `${(n / 60_000).toFixed(1)} min` },
  { id: "speed", label: "Average speed", format: (n) => `${n.toFixed(1)}×`, hint: "Media length ÷ time taken" },
]

function ChangeText({ which, current, previous, periodLabel }: { which: Kpi; current: number | null; previous: number | null; periodLabel: string }) {
  const c = change(which, current, previous)
  if (!c) return <span className="text-muted-foreground text-[11px]">Nothing to compare with yet</span>
  const Icon = c.value === 0 ? Minus : c.value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
      <span
        className={cn(
          "flex items-center gap-0.5 font-medium tabular-nums",
          c.good === true && "text-emerald-600 dark:text-emerald-400",
          c.good === false && "text-red-600 dark:text-red-400",
          c.good === null && "text-foreground",
        )}
      >
        <Icon className="size-3" />
        {c.text}
      </span>
      vs {periodLabel}
    </span>
  )
}

/** The six headline numbers, each with its change since the previous period and a sparkline. */
export function KpiTiles({
  records,
  previous,
  buckets,
  periodLabel,
  live,
}: {
  records: HistoryRecord[]
  previous: HistoryRecord[]
  buckets: Bucket[]
  periodLabel: string
  live: boolean
}) {
  const theme = useResolvedTheme()
  const tiles = useMemo(
    () =>
      KPIS.map((k) => ({
        ...k,
        current: kpi(records, k.id),
        previous: kpi(previous, k.id),
        spark: sparkline(records, buckets, k.id),
      })),
    [records, previous, buckets],
  )

  return (
    // Beams run while jobs are in flight.
    <GridBeam rows={2} cols={3} active={live} theme={theme} className="bg-card rounded-2xl border">
      <div className="grid grid-cols-3 grid-rows-2">
        {tiles.map((t) => (
          <div key={t.id} className="flex min-w-0 flex-col gap-1 p-5">
            <span className="text-muted-foreground text-xs" title={t.hint}>
              {t.label}
            </span>
            <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
              {t.current === null ? "—" : <RollingNumber value={t.current} format={t.format} />}
            </span>
            <ChangeText which={t.id} current={t.current} previous={t.previous} periodLabel={periodLabel} />
            <Sparkline data={t.spark} className="mt-2" />
          </div>
        ))}
      </div>
    </GridBeam>
  )
}

/** Bars per day (or hour, or week), stacked by outcome or media type, over last period's line. */
export function TrendChart({
  records,
  previous,
  buckets,
  period,
  periodLabel,
}: {
  records: HistoryRecord[]
  previous: HistoryRecord[]
  buckets: Bucket[]
  period: Period
  periodLabel: string
}) {
  const [metric, setMetric] = useState<Metric>("jobs")
  const unit = METRICS.find((m) => m.id === metric)!.unit
  const { points, keys } = useMemo(
    () => trend(records, previous, buckets, period.to - period.from, metric),
    [records, previous, buckets, period, metric],
  )
  const hasData = points.some((p) => keys.some((k) => (p[k] ?? 0) > 0) || p.previous > 0)
  const format = (n: number) =>
    `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${metric === "jobs" && n === 1 ? "job" : unit}`

  return (
    <Panel
      title="Trend"
      description={metric === "jobs" ? "By outcome" : "By input type"}
      actions={
        <HaloTabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <HaloTabsList variant="underline">
            {METRICS.map((m) => (
              <HaloTabsTrigger key={m.id} value={m.id}>
                {m.label}
              </HaloTabsTrigger>
            ))}
            <HaloTabsIndicator variant="underline" />
          </HaloTabsList>
        </HaloTabs>
      }
    >
      {hasData ? (
        <>
          <Legend
            items={[
              ...keys.map((k) => ({ key: k, label: SERIES_LABELS[k], color: COLORS[k] })),
              { key: "previous", label: periodLabel.replace(/^the /, "").replace(/^./, (c) => c.toUpperCase()), color: "var(--muted-foreground)", dashed: true },
            ]}
          />
          <ChartContainer config={{}} className="aspect-auto h-64 w-full">
            <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" {...AXIS} minTickGap={24} />
              <YAxis {...AXIS} width={44} allowDecimals={metric !== "jobs"} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof points)[number] | undefined
                  if (!active || !p) return null
                  return (
                    <TooltipCard
                      title={p.title}
                      rows={[
                        ...keys.map((k) => ({ key: k, label: SERIES_LABELS[k], value: format(p[k] ?? 0), color: COLORS[k] })),
                        { key: "previous", label: "Previous period", value: format(p.previous) },
                      ]}
                    />
                  )
                }}
              />
              {keys.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  stackId="a"
                  fill={COLORS[k]}
                  maxBarSize={24}
                  stroke="var(--card)"
                  strokeWidth={1}
                  radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
              <Line
                dataKey="previous"
                type="monotone"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        </>
      ) : (
        <Empty className="h-64">No jobs in this period.</Empty>
      )}
    </Panel>
  )
}
