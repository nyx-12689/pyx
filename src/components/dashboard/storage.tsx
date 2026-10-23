import { useMemo } from "react"
import { revealItemInDir } from "@tauri-apps/plugin-opener"
import { Bar, BarChart, Cell, LabelList, Tooltip, XAxis, YAxis } from "recharts"

import { AXIS, COLORS, Empty, Legend, Panel, TooltipCard, formatAgo } from "@/components/dashboard/viz"
import { AnalyticsLineChart } from "@/components/ui/analytics-chart"
import { ChartContainer } from "@/components/ui/chart"
import { biggestWins, cumulativeSaved, formatStats, type RangeDays, storageTotals, toolName } from "@/lib/analytics"
import { basename, formatBytes } from "@/lib/format"
import type { HistoryRecord } from "@/lib/types"

const percent = (change: number) => `${change < 0 ? "−" : "+"}${Math.abs(change * 100).toFixed(0)}%`

function Totals({ records }: { records: HistoryRecord[] }) {
  const t = useMemo(() => storageTotals(records), [records])
  const outShare = t.inputBytes ? Math.min(1, t.outputBytes / t.inputBytes) : 0
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {t.files.toLocaleString()} files · {formatBytes(t.inputBytes)} in → {formatBytes(t.outputBytes)} out
        </span>
        {t.inputBytes > 0 && <span className="font-medium tabular-nums">{percent(t.outputBytes / t.inputBytes - 1)} overall</span>}
      </div>
      {/* Output as a share of input: the empty part is space you got back. */}
      <div className="bg-muted flex h-2 overflow-hidden rounded-full">
        <div className="rounded-full" style={{ width: `${outShare * 100}%`, background: COLORS.smaller }} />
      </div>
    </div>
  )
}

function FormatChart({ records }: { records: HistoryRecord[] }) {
  // Bars show how big the change was; colour says which way.
  const data = useMemo(() => formatStats(records).slice(0, 8).map((f) => ({ ...f, size: Math.abs(f.change) })), [records])
  if (data.length === 0) return <Empty>No finished files in this period.</Empty>
  return (
    <ChartContainer config={{}} className="aspect-auto w-full" style={{ height: data.length * 32 }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }}>
        <XAxis type="number" hide domain={[0, (max: number) => Math.max(max, 0.25)]} />
        <YAxis type="category" dataKey="format" {...AXIS} width={48} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={({ active, payload }) => {
            const f = payload?.[0]?.payload as (typeof data)[number] | undefined
            if (!active || !f) return null
            return (
              <TooltipCard
                title={`${f.format} · ${f.count} files`}
                rows={[
                  { key: "in", label: "Input", value: formatBytes(f.inputBytes) },
                  { key: "out", label: "Output", value: formatBytes(f.outputBytes) },
                  { key: "change", label: "Change", value: percent(f.change) },
                ]}
              />
            )
          }}
        />
        <Bar dataKey="size" maxBarSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((f) => (
            <Cell key={f.format} fill={f.change < 0 ? COLORS.smaller : COLORS.bigger} />
          ))}
          <LabelList
            dataKey="change"
            position="right"
            formatter={(v: unknown) => percent(Number(v))}
            className="fill-foreground text-[11px] tabular-nums"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function WinsList({ items }: { items: { record: HistoryRecord; delta: number }[] }) {
  if (items.length === 0) return <p className="text-muted-foreground py-2 text-sm">No files got smaller in this period.</p>
  return (
    <ul className="divide-y">
      {items.map(({ record, delta }) => (
        <li key={record.id}>
          <button
            type="button"
            onClick={() => record.output && revealItemInDir(record.output)}
            className="hover:bg-muted/40 -mx-2 flex w-[calc(100%+1rem)] items-center gap-4 rounded-md px-2 py-2 text-left"
            title="Show in Finder"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{basename(record.output ?? record.input ?? "")}</span>
            <span className="text-muted-foreground hidden w-28 shrink-0 truncate text-xs sm:block">{toolName(record.subject)}</span>
            <span className="text-muted-foreground w-24 shrink-0 text-right text-xs">{formatAgo(record.finishedAt)}</span>
            <span className="text-muted-foreground w-40 shrink-0 text-right text-xs tabular-nums">
              {formatBytes(record.inputSize ?? 0)} → {formatBytes(record.outputSize ?? 0)}
            </span>
            <span className="text-muted-foreground w-12 shrink-0 text-right text-xs tabular-nums">
              {percent((record.outputSize ?? 0) / (record.inputSize ?? 1) - 1)}
            </span>
            <span className="w-20 shrink-0 text-right text-xs font-medium tabular-nums">−{formatBytes(Math.abs(delta))}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function StorageSection({ records, allRecords, days }: { records: HistoryRecord[]; allRecords: HistoryRecord[]; days: RangeDays }) {
  const cumulative = useMemo(() => cumulativeSaved(allRecords, days), [allRecords, days])
  const wins = useMemo(() => biggestWins(records), [records])
  const total = cumulative.at(-1)?.value ?? 0

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Size change by output format" description="Total output size compared with input, per format">
        <Totals records={records} />
        <Legend
          items={[
            { key: "smaller", label: "Smaller", color: COLORS.smaller },
            { key: "bigger", label: "Bigger", color: COLORS.bigger },
          ]}
        />
        <FormatChart records={records} />
      </Panel>
      <Panel
        title="Space saved over time"
        description={`Running total${days === 1 ? " over the last 7 days" : ""}: ${formatBytes(total * 1e6)}`}
      >
        {total > 0 ? (
          <AnalyticsLineChart data={cumulative} valueLabel="MB saved" height={260} pinnedIndices={[]} />
        ) : (
          <Empty>Nothing saved yet in this period.</Empty>
        )}
      </Panel>
      <Panel title="Biggest wins" description="The files that shrank the most. Click one to show it in Finder." className="lg:col-span-2">
        <WinsList items={wins} />
      </Panel>
    </div>
  )
}
