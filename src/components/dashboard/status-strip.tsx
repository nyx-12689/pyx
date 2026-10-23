import { useEffect, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Cpu, History, ListTodo } from "lucide-react"
import { useShallow } from "zustand/react/shallow"

import { formatAgo, formatSeconds } from "@/components/dashboard/viz"
import { HaloBadge } from "@/components/ui/halo-badge"
import { HaloProgress } from "@/components/ui/halo-progress"
import { Timer } from "@/components/ui/timer"
import { toolName } from "@/lib/analytics"
import { jobTitle } from "@/lib/jobs"
import type { HistoryRecord } from "@/lib/types"
import { cn } from "@/lib/utils"
import { isActive, type Job, useApp } from "@/store"

/** Matches MAX_CONCURRENT_JOBS in src-tauri/src/jobs.rs. */
const CONCURRENCY = 3

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

/** Median time per tool across all saved jobs, for queue estimates. */
function useTypicalTimes(history: HistoryRecord[]) {
  return useMemo(() => {
    const byTool = new Map<string, number[]>()
    for (const r of history)
      if (r.status === "done" && r.elapsedMs) byTool.set(r.subject, [...(byTool.get(r.subject) ?? []), r.elapsedMs])
    return new Map(
      [...byTool.entries()].map(([tool, times]) => [tool, times.sort((a, b) => a - b)[Math.floor(times.length / 2)]]),
    )
  }, [history])
}

/** Rough time left: what's left of each running job plus queued work, shared across the slots. */
function estimateRemaining(jobs: Job[], typical: Map<string, number>, now: number): number | null {
  let total = 0
  for (const job of jobs) {
    const usual = typical.get(job.subject)
    if (job.status === "running" && job.startedAt) {
      const spent = now - job.startedAt
      if (job.progress && job.progress > 0.02) total += spent / job.progress - spent
      else if (usual) total += Math.max(0, usual - spent)
      else return null
    } else if (usual) total += usual
    else return null
  }
  return total / Math.min(CONCURRENCY, Math.max(1, jobs.length))
}

function Card({ icon: Icon, title, to, children }: { icon: typeof Cpu; title: string; to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="bg-card hover:border-foreground/20 flex min-w-0 items-start gap-3 rounded-2xl border p-4 transition-colors">
      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="text-muted-foreground block text-xs">{title}</span>
        {children}
      </span>
    </Link>
  )
}

/** Queue, tool health and the last run, at a glance. */
export function StatusStrip({ history }: { history: HistoryRecord[] }) {
  const active = useApp(useShallow((s) => s.jobOrder.map((id) => s.jobs[id]).filter(isActive)))
  const deps = useApp((s) => s.deps)
  const now = useNow(active.length > 0)
  const typical = useTypicalTimes(history)
  const remaining = estimateRemaining(active, typical, now)
  const running = active.filter((j) => j.status === "running").length
  const queued = active.length - running
  const last = history.find((r) => r.kind === "tool")

  const installed = deps?.dependencies.filter((d) => d.path) ?? []
  const missing = deps?.dependencies.filter((d) => !d.path) ?? []
  const hardware = deps?.dependencies
    .find((d) => d.name === "ffmpeg")
    ?.capabilities.some((c) => c.id === "encoder:h264_videotoolbox" && c.available)

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card icon={ListTodo} title="Queue" to="/activity">
        {active.length === 0 ? (
          <span className="block text-sm font-medium">Idle</span>
        ) : (
          <span className="flex items-center gap-2 text-sm font-medium">
            {running} running{queued > 0 && ` · ${queued} queued`}
            <HaloBadge live variant="secondary">
              Live
            </HaloBadge>
          </span>
        )}
        <span className="text-muted-foreground block text-xs tabular-nums">
          {active.length === 0
            ? "Nothing running right now"
            : remaining === null
              ? "Estimating time left…"
              : `About ${formatSeconds(remaining)} left`}
        </span>
      </Card>
      <Card icon={Cpu} title="Tools" to="/dependencies">
        {deps === null ? (
          <span className="block text-sm font-medium">Checking…</span>
        ) : (
          <span className={cn("block text-sm font-medium", missing.length > 0 && "text-destructive")}>
            {missing.length === 0 ? `All ${installed.length} installed` : `${missing.map((d) => d.name).join(", ")} missing`}
          </span>
        )}
        <span className="text-muted-foreground block truncate text-xs">
          {installed.map((d) => `${d.name} ${d.version ?? ""}`.trim()).join(" · ")}
          {hardware && " · Apple hardware encoding"}
        </span>
      </Card>
      <Card icon={History} title="Last run" to="/activity">
        {last ? (
          <>
            <span className="block truncate text-sm font-medium">{toolName(last.subject)}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {last.status === "done" ? "Succeeded" : last.status === "error" ? "Failed" : "Cancelled"} ·{" "}
              {formatAgo(last.finishedAt, now)}
            </span>
          </>
        ) : (
          <span className="block text-sm font-medium">No jobs yet</span>
        )}
      </Card>
    </div>
  )
}

/** A card per running or queued job, with its timer and progress. */
export function RunningNow() {
  const running = useApp(useShallow((s) => s.jobOrder.map((id) => s.jobs[id]).filter(isActive)))
  if (running.length === 0) return null
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {running.map((job) => (
        <div key={job.id} className="bg-card space-y-3 rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{jobTitle(job)}</p>
              <p className="text-muted-foreground text-xs">{job.status === "queued" ? `${job.label} · queued` : job.label}</p>
            </div>
            <Timer loading={job.status === "running"} startedAt={job.startedAt ?? undefined} format="MM:SS" size="sm" variant="outline" />
          </div>
          <HaloProgress value={job.progress === null ? null : Math.round(job.progress * 100)} />
        </div>
      ))}
    </div>
  )
}
