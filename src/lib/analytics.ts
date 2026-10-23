import type { HistoryRecord, MediaKind } from "@/lib/types"
import { basename } from "@/lib/format"
import { toolById } from "@/tools/registry"

export type RangeDays = 1 | 7 | 30 | 90
export type Metric = "jobs" | "processed" | "saved" | "time"
export type Kpi = "jobs" | "successRate" | "processed" | "saved" | "time" | "speed"

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: "jobs", label: "Jobs", unit: "jobs" },
  { id: "processed", label: "Data processed", unit: "MB" },
  { id: "saved", label: "Space saved", unit: "MB" },
  { id: "time", label: "Time spent", unit: "min" },
]

export interface Share {
  key: string
  label: string
  count: number
  share: number
}

export interface Period {
  from: number
  to: number
}

export interface Bucket extends Period {
  /** Axis label: "14:00", "Oct 3". */
  label: string
  /** Tooltip heading: "Oct 3, 14:00", "Week of Oct 3". */
  title: string
}

const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export const isoDay = (t: number) => {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
const hourLabel = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

const saved = (r: HistoryRecord) => Math.max(0, (r.inputSize ?? 0) - (r.outputSize ?? 0))
const isDone = (r: HistoryRecord) => r.status === "done"
const sum = (records: HistoryRecord[], value: (r: HistoryRecord) => number) =>
  records.reduce((total, r) => total + value(r), 0)
const round1 = (n: number) => Math.round(n * 10) / 10

export const toolName = (id: string) => toolById(id)?.name ?? id

const extension = (path: string | null) => {
  const name = path ? basename(path) : ""
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : null
}

export const outputFormat = (r: HistoryRecord) => (isDone(r) ? extension(r.output) : null)

// ---------------------------------------------------------------------------
// Periods

/** The selected range of whole days, ending at the end of today. */
export function period(days: RangeDays, now = Date.now()): Period {
  const to = startOfDay(now) + DAY
  return { from: to - days * DAY, to }
}

/** The same length of time just before `p`, for "vs previous" comparisons. */
export const previousPeriod = (p: Period): Period => ({ from: p.from - (p.to - p.from), to: p.from })

/** Tool jobs that finished within `p`. */
export const within = (records: HistoryRecord[], p: Period) =>
  records.filter((r) => r.kind === "tool" && r.finishedAt >= p.from && r.finishedAt < p.to)

/** Hours for "Today", weeks for 90 days, days otherwise. */
export function buckets(days: RangeDays, p: Period): Bucket[] {
  const size = days === 1 ? HOUR : days === 90 ? 7 * DAY : DAY
  const count = Math.ceil((p.to - p.from) / size)
  return Array.from({ length: count }, (_, i) => {
    const to = p.to - (count - 1 - i) * size
    const from = Math.max(p.from, to - size)
    if (days === 1) return { from, to, label: hourLabel(from), title: `Today, ${hourLabel(from)}` }
    if (days === 90) return { from, to, label: shortDate(from), title: `Week of ${shortDate(from)}` }
    return { from, to, label: shortDate(from), title: new Date(from).toLocaleDateString(undefined, { dateStyle: "medium" }) }
  })
}

const inBucket = (records: HistoryRecord[], b: Period) => records.filter((r) => r.finishedAt >= b.from && r.finishedAt < b.to)

// ---------------------------------------------------------------------------
// Headline numbers

export function kpi(records: HistoryRecord[], which: Kpi): number | null {
  const done = records.filter(isDone)
  switch (which) {
    case "jobs":
      return records.length
    case "successRate": {
      const finished = done.length + records.filter((r) => r.status === "error").length
      return finished ? (done.length / finished) * 100 : null
    }
    case "processed":
      return sum(done, (r) => r.inputSize ?? 0)
    case "saved":
      return sum(done, saved)
    case "time":
      return sum(records, (r) => r.elapsedMs ?? 0)
    case "speed": {
      const timed = done.filter((r) => r.inputDuration && r.elapsedMs)
      const encodeSeconds = sum(timed, (r) => (r.elapsedMs ?? 0) / 1000)
      return encodeSeconds > 0 ? sum(timed, (r) => r.inputDuration ?? 0) / encodeSeconds : null
    }
  }
}

export interface Change {
  /** Relative change (0.23 = +23%), or points for the success rate. */
  value: number
  /** Whether the change is in the direction you'd want. Null when neither is better. */
  good: boolean | null
  text: string
}

/** How `which` moved since the previous period; null when there's nothing to compare with. */
export function change(which: Kpi, current: number | null, previous: number | null): Change | null {
  if (current === null || previous === null) return null
  if (which === "successRate") {
    const points = current - previous
    if (Math.abs(points) < 0.5) return { value: 0, good: null, text: "No change" }
    return { value: points, good: points > 0, text: `${points > 0 ? "+" : "−"}${Math.abs(points).toFixed(0)} pts` }
  }
  if (previous === 0) return null
  const value = current / previous - 1
  if (Math.abs(value) < 0.005) return { value: 0, good: null, text: "No change" }
  return {
    value,
    good: which === "time" ? null : value > 0,
    text: `${value > 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(0)}%`,
  }
}

/** One KPI per bucket, for the stat tiles' sparklines; null where a rate has nothing to go on. */
export const sparkline = (records: HistoryRecord[], bs: Bucket[], which: Kpi) =>
  bs.map((b) => ({ value: kpi(inBucket(records, b), which) }))

// ---------------------------------------------------------------------------
// Main trend

export const STATUS_KEYS = ["done", "error", "cancelled"] as const
export const KIND_KEYS = ["image", "video", "audio", "other"] as const
export type TrendKey = (typeof STATUS_KEYS)[number] | (typeof KIND_KEYS)[number]

export type TrendPoint = { label: string; title: string; previous: number } & Partial<Record<TrendKey, number>>

function metricValue(records: HistoryRecord[], metric: Metric): number {
  const done = records.filter(isDone)
  switch (metric) {
    case "jobs":
      return records.length
    case "processed":
      return round1(sum(done, (r) => r.inputSize ?? 0) / 1e6)
    case "saved":
      return round1(sum(done, saved) / 1e6)
    case "time":
      return round1(sum(records, (r) => r.elapsedMs ?? 0) / 60_000)
  }
}

const kindKey = (kind: MediaKind | null): (typeof KIND_KEYS)[number] =>
  kind === "image" || kind === "video" || kind === "audio" ? kind : "other"

/**
 * Bars per bucket — split by outcome for "Jobs", by media type otherwise — plus
 * the matching bucket of the previous period, drawn as a line behind them.
 */
export function trend(
  records: HistoryRecord[],
  previous: HistoryRecord[],
  bs: Bucket[],
  shift: number,
  metric: Metric,
): { points: TrendPoint[]; keys: readonly TrendKey[] } {
  const keys = metric === "jobs" ? STATUS_KEYS : KIND_KEYS
  const points = bs.map((b) => {
    const here = inBucket(records, b)
    const point: TrendPoint = {
      label: b.label,
      title: b.title,
      previous: metricValue(inBucket(previous, { from: b.from - shift, to: b.to - shift }), metric),
    }
    for (const key of keys) {
      const part = here.filter((r) => (metric === "jobs" ? r.status === key : kindKey(r.inputKind) === key))
      point[key] = metricValue(part, metric)
    }
    return point
  })
  // Leave out series that are empty for the whole range, so the legend stays honest.
  return { points, keys: keys.filter((k) => points.some((p) => (p[k] ?? 0) > 0)) }
}

// ---------------------------------------------------------------------------
// Breakdowns

/** Counts per key, largest first. */
export function shares(
  records: HistoryRecord[],
  keyOf: (r: HistoryRecord) => string | null,
  labelOf: (key: string) => string = (k) => k,
): Share[] {
  const counts = new Map<string, number>()
  for (const r of records) {
    const key = keyOf(r)
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: labelOf(key), count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count)
}

export const mediaMix = (records: HistoryRecord[]) => shares(records, (r) => kindKey(r.inputKind))

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

export interface ToolStats {
  id: string
  name: string
  runs: number
  failed: number
  successRate: number | null
  medianMs: number | null
  p90Ms: number | null
  /** Media seconds per second of work, for video and audio. */
  speed: number | null
  savedBytes: number
  spark: { value: number | null }[]
}

export function toolStats(records: HistoryRecord[], bs: Bucket[]): ToolStats[] {
  const byTool = new Map<string, HistoryRecord[]>()
  for (const r of records) byTool.set(r.subject, [...(byTool.get(r.subject) ?? []), r])
  return [...byTool.entries()]
    .map(([id, rs]) => {
      const times = rs
        .filter(isDone)
        .map((r) => r.elapsedMs)
        .filter((ms): ms is number => ms !== null)
        .sort((a, b) => a - b)
      return {
        id,
        name: toolName(id),
        runs: rs.length,
        failed: rs.filter((r) => r.status === "error").length,
        successRate: kpi(rs, "successRate"),
        medianMs: quantile(times, 0.5),
        p90Ms: quantile(times, 0.9),
        speed: kpi(rs, "speed"),
        savedBytes: kpi(rs, "saved") ?? 0,
        spark: sparkline(rs, bs, "jobs"),
      }
    })
    .sort((a, b) => b.runs - a.runs)
}

// ---------------------------------------------------------------------------
// Storage

export interface FormatStats {
  format: string
  count: number
  inputBytes: number
  outputBytes: number
  /** Output size relative to input: −0.68 means 68% smaller. */
  change: number
}

const sized = (records: HistoryRecord[]) =>
  records.filter((r) => isDone(r) && r.output && (r.inputSize ?? 0) > 0 && r.outputSize !== null)

export function storageTotals(records: HistoryRecord[]) {
  const rs = sized(records)
  const inputBytes = sum(rs, (r) => r.inputSize ?? 0)
  const outputBytes = sum(rs, (r) => r.outputSize ?? 0)
  return { files: rs.length, inputBytes, outputBytes, savedBytes: sum(rs, saved) }
}

export function formatStats(records: HistoryRecord[]): FormatStats[] {
  const byFormat = new Map<string, HistoryRecord[]>()
  for (const r of sized(records)) {
    const format = extension(r.output)
    if (format) byFormat.set(format, [...(byFormat.get(format) ?? []), r])
  }
  return [...byFormat.entries()]
    .map(([format, rs]) => {
      const inputBytes = sum(rs, (r) => r.inputSize ?? 0)
      const outputBytes = sum(rs, (r) => r.outputSize ?? 0)
      return { format, count: rs.length, inputBytes, outputBytes, change: outputBytes / inputBytes - 1 }
    })
    .sort((a, b) => b.count - a.count)
}

/** The files that shrank the most. */
export const biggestWins = (records: HistoryRecord[], limit = 10) =>
  sized(records)
    .map((r) => ({ record: r, delta: (r.outputSize ?? 0) - (r.inputSize ?? 0) }))
    .filter((x) => x.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, limit)

/** Space saved so far, one point per day; at least a week so "Today" still draws a line. */
export function cumulativeSaved(records: HistoryRecord[], days: RangeDays, now = Date.now()) {
  const p = period(days === 1 ? 7 : days, now)
  const daily = Array.from({ length: Math.round((p.to - p.from) / DAY) }, (_, i) => p.from + i * DAY)
  const done = within(records, p).filter(isDone)
  let total = 0
  return daily.map((from) => {
    total += sum(inBucket(done, { from, to: from + DAY }), saved)
    return { date: isoDay(from), label: "Saved", value: round1(total / 1e6) }
  })
}

// ---------------------------------------------------------------------------
// Failures

/** The line of an error that says what went wrong, without file paths. */
export function errorSummary(error: string | null): string {
  const lines = (error ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^conversion failed!?$/i.test(l))
  const line = lines.pop() ?? "Unknown error"
  return line.replace(/(?:\/[^\s'":,]+)+/g, "…").slice(0, 140)
}

export interface ErrorGroup {
  message: string
  count: number
  lastAt: number
  tools: string[]
}

export function errorGroups(records: HistoryRecord[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>()
  for (const r of records.filter((r) => r.status === "error")) {
    const message = errorSummary(r.error)
    const g = groups.get(message) ?? { message, count: 0, lastAt: 0, tools: [] }
    g.count++
    g.lastAt = Math.max(g.lastAt, r.finishedAt)
    const tool = toolName(r.subject)
    if (!g.tools.includes(tool)) g.tools.push(tool)
    groups.set(message, g)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
}

// ---------------------------------------------------------------------------
// When you work

/** Monday-first weekday, 0–6. */
const weekday = (t: number) => (new Date(t).getDay() + 6) % 7

export interface CalendarDay {
  date: number
  /** Jobs that day; null for padding days outside the month and days still to come. */
  count: number | null
}

/** One month as Monday-first weeks, with jobs per day. `month` is 0–11. */
export function monthCalendar(records: HistoryRecord[], year: number, month: number, now = Date.now()): CalendarDay[][] {
  const first = new Date(year, month, 1).getTime()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const counts = new Map<string, number>()
  for (const r of records) if (r.kind === "tool") counts.set(isoDay(r.finishedAt), (counts.get(isoDay(r.finishedAt)) ?? 0) + 1)
  const today = startOfDay(now)

  const cells: CalendarDay[] = []
  for (let i = 0; i < weekday(first); i++) cells.push({ date: -1 - i, count: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d).getTime()
    cells.push({ date, count: date > today ? null : (counts.get(isoDay(date)) ?? 0) })
  }
  while (cells.length % 7) cells.push({ date: -100 - cells.length, count: null })
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}
