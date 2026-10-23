import { useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"
import { Cell, Pie, PieChart, Tooltip } from "recharts"

import { COLORS, Empty, Panel, SERIES_LABELS, Sparkline, Swatch, TooltipCard, formatSeconds } from "@/components/dashboard/viz"
import { ChartContainer } from "@/components/ui/chart"
import { type Bucket, mediaMix, toolStats } from "@/lib/analytics"
import { formatBytes } from "@/lib/format"
import type { HistoryRecord } from "@/lib/types"

export function ToolTable({ records, buckets }: { records: HistoryRecord[]; buckets: Bucket[] }) {
  const rows = useMemo(() => toolStats(records, buckets), [records, buckets])
  return (
    <Panel title="Tool performance" description="Typical is the median time; slow is the 90th percentile.">
      {rows.length === 0 ? (
        <Empty>No jobs in this period.</Empty>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="px-5 pb-2 font-normal">Tool</th>
                <th className="px-3 pb-2 text-right font-normal">Runs</th>
                <th className="px-3 pb-2 text-right font-normal">Success</th>
                <th className="px-3 pb-2 text-right font-normal">Typical</th>
                <th className="px-3 pb-2 text-right font-normal">Slow</th>
                <th className="px-3 pb-2 text-right font-normal">Speed</th>
                <th className="px-3 pb-2 text-right font-normal">Saved</th>
                <th className="w-28 px-3 pb-2 font-normal">Runs over time</th>
                <th className="w-8 pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40 group">
                  <td className="px-5 py-2.5 font-medium">{t.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.runs.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {t.successRate === null ? "—" : `${Math.round(t.successRate)}%`}
                    {t.failed > 0 && <span className="text-muted-foreground ml-1 text-xs">({t.failed} failed)</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatSeconds(t.medianMs)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatSeconds(t.p90Ms)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.speed === null ? "—" : `${t.speed.toFixed(1)}×`}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatBytes(t.savedBytes)}</td>
                  <td className="px-3 py-1">
                    <Sparkline data={t.spark} className="h-7" />
                  </td>
                  <td className="pr-3">
                    <Link
                      to="/activity"
                      search={{ tool: t.id }}
                      aria-label={`Show ${t.name} jobs in Activity`}
                      className="text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-md"
                    >
                      <ChevronRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

export function MediaMix({ records }: { records: HistoryRecord[] }) {
  const mix = useMemo(() => mediaMix(records), [records])
  const total = mix.reduce((n, m) => n + m.count, 0)

  return (
    <Panel title="Media mix" description="What you put in, by type">
      {total === 0 ? (
        <Empty>No jobs in this period.</Empty>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <ChartContainer config={{}} className="aspect-square h-28 shrink-0">
              <PieChart>
                <Pie
                  data={mix}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="100%"
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {mix.map((m) => (
                    <Cell key={m.key} fill={COLORS[m.key as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    const m = payload?.[0]?.payload as (typeof mix)[number] | undefined
                    if (!active || !m) return null
                    return (
                      <TooltipCard
                        title={SERIES_LABELS[m.key]}
                        rows={[{ key: "n", label: "Jobs", value: `${m.count} · ${Math.round(m.share * 100)}%` }]}
                      />
                    )
                  }}
                />
              </PieChart>
            </ChartContainer>
            <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
              {mix.map((m) => (
                <li key={m.key} className="flex items-center gap-2">
                  <Swatch color={COLORS[m.key as keyof typeof COLORS]} />
                  <span className="flex-1">{SERIES_LABELS[m.key]}</span>
                  <span className="text-muted-foreground tabular-nums">{Math.round(m.share * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Panel>
  )
}
