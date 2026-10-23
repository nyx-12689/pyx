import { useMemo } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { revealItemInDir } from "@tauri-apps/plugin-opener"
import { Ban, ChevronDown, CircleAlert, CircleCheck, Clock, FolderOpen, Loader2, Square, SquareTerminal, X } from "lucide-react"
import { useShallow } from "zustand/react/shallow"

import { Page, PageHeader } from "@/components/page"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Expandable, ExpandableContent, ExpandableTrigger } from "@/components/ui/expandable"
import { HaloTabs, HaloTabsIndicator, HaloTabsList, HaloTabsTrigger } from "@/components/ui/halo-tabs"
import NeumorphButton from "@/components/ui/neumorph-button"
import { JobTimer } from "@/components/job-timer"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toolName } from "@/lib/analytics"
import { formatBytes } from "@/lib/format"
import { elapsed, jobTitle, sizeChange } from "@/lib/jobs"
import { cn } from "@/lib/utils"
import type { ActivitySearch } from "@/router"
import { isActive, type Job, recordToJob, useApp } from "@/store"

type Filter = "all" | NonNullable<ActivitySearch["status"]>

/** Activity lists this far back; the Dashboard loads more for its calendar. */
const ACTIVITY_DAYS = 90

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "done", label: "Succeeded" },
  { id: "error", label: "Failed" },
]

function StatusIcon({ job }: { job: Job }) {
  switch (job.status) {
    case "queued":
      return <Clock className="text-muted-foreground size-4" />
    case "running":
      return <Loader2 className="size-4 animate-spin text-sky-500" />
    case "done":
      return <CircleCheck className="size-4 text-emerald-500" />
    case "error":
      return <CircleAlert className="text-destructive size-4" />
    case "cancelled":
      return <Ban className="text-muted-foreground size-4" />
  }
}

function ResultText({ job }: { job: Job }) {
  if (job.status === "running")
    return <span className="tabular-nums">{job.progress === null ? "Working…" : `${Math.round(job.progress * 100)}%`}</span>
  if (job.status === "queued") return <span>Queued</span>
  if (job.status === "cancelled") return <span>Cancelled</span>
  if (job.status === "error")
    return <span className="text-destructive truncate">{job.error?.split("\n").filter(Boolean).pop() ?? "Failed"}</span>
  const change = sizeChange(job)
  return (
    <span className="tabular-nums">
      {job.outputSize !== null ? formatBytes(job.outputSize) : "Done"}
      {change && (
        <span className={cn("ml-1.5", change.smaller ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
          {change.text}
        </span>
      )}
    </span>
  )
}

function RowAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={(e) => {
            // Don't also toggle the row open.
            e.stopPropagation()
            onClick()
          }}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function Detail({ label, value, copy }: { label: string; value: string | null; copy?: string | null }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[96px_1fr_auto] items-start gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono break-all select-text">{value}</span>
      {copy ? <CopyButton value={copy} className="size-6" /> : <span />}
    </div>
  )
}

/** One job; click it for the command, paths and timings. */
export function JobRow({ job }: { job: Job }) {
  const showJobInTerminal = useApp((s) => s.showJobInTerminal)
  const cancelJob = useApp((s) => s.cancelJob)
  const live = useApp((s) => !!s.jobs[job.id])

  return (
    <Expandable expandDirection="vertical" expandBehavior="push" transitionDuration={0.25}>
      {({ isExpanded }) => (
        <div>
          <ExpandableTrigger>
            <div className="hover:bg-muted/40 flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors">
              <StatusIcon job={job} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{jobTitle(job)}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {job.label} · {new Date(job.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <div className="text-muted-foreground flex w-48 min-w-0 justify-end text-xs">
                <ResultText job={job} />
              </div>
              <span className="flex w-24 justify-end">
                <JobTimer job={job} variant="ghost" className="text-muted-foreground" />
              </span>
              <div className="flex w-24 justify-end gap-0.5">
                {isActive(job) && (
                  <RowAction label="Cancel" onClick={() => cancelJob(job.id)}>
                    <Square />
                  </RowAction>
                )}
                {job.output && (
                  <RowAction label="Show in Finder" onClick={() => revealItemInDir(job.output!)}>
                    <FolderOpen />
                  </RowAction>
                )}
                {live && (
                  <RowAction label="Show in terminal" onClick={() => showJobInTerminal(job.id)}>
                    <SquareTerminal />
                  </RowAction>
                )}
              </div>
              <ChevronDown
                className={cn("text-muted-foreground size-4 transition-transform", isExpanded && "rotate-180")}
              />
            </div>
          </ExpandableTrigger>
          <ExpandableContent preset="blur-sm">
            <div className="bg-muted/30 space-y-2 border-t px-4 py-3 pl-11">
              <Detail label="Command" value={job.displayCommand} copy={job.command} />
              <Detail label="Input" value={job.input} copy={job.input} />
              <Detail label="Output" value={job.output} copy={job.output} />
              <Detail
                label="Sizes"
                value={
                  job.inputInfo && job.outputSize !== null
                    ? `${formatBytes(job.inputInfo.size)} → ${formatBytes(job.outputSize)}`
                    : null
                }
              />
              <Detail label="Took" value={elapsed(job)} />
              <Detail label="Error" value={job.error} copy={job.error} />
            </div>
          </ExpandableContent>
        </div>
      )}
    </Expandable>
  )
}

/** Whether a job matches the search text from a Dashboard link, by file name or error. */
function matchesText(job: Job, q: string) {
  const needle = q.toLowerCase()
  return [job.input, job.output, job.error].some((field) => field?.toLowerCase().includes(needle))
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="bg-muted flex max-w-full items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs">
      <span className="truncate">{label}</span>
      <button type="button" onClick={onClear} aria-label={`Remove filter ${label}`} className="hover:bg-background rounded-full p-0.5">
        <X className="size-3" />
      </button>
    </span>
  )
}

export function ActivityPage() {
  const session = useApp(useShallow((s) => s.jobOrder.map((id) => s.jobs[id])))
  const history = useApp((s) => s.history)
  const clearFinishedJobs = useApp((s) => s.clearFinishedJobs)
  const search = useSearch({ from: "/activity" })
  const navigate = useNavigate({ from: "/activity" })
  const filter: Filter = search.status ?? "all"
  const setSearch = (patch: Partial<ActivitySearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })

  // This session's jobs (live) first, then saved ones not already shown.
  const jobs = useMemo(() => {
    const seen = new Set(session.map((j) => j.id))
    const since = Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000
    const saved = (history ?? []).filter((r) => !seen.has(r.id) && r.finishedAt >= since).map(recordToJob)
    const all = [...[...session].reverse(), ...saved].sort((a, b) => b.createdAt - a.createdAt)
    return all.filter(
      (j) =>
        (filter === "all" ? true : filter === "running" ? isActive(j) : j.status === filter) &&
        (!search.tool || j.subject === search.tool) &&
        (!search.q || matchesText(j, search.q)),
    )
  }, [session, history, filter, search.tool, search.q])

  return (
    <Page>
      <PageHeader
        title="Activity"
        description="Every job from the last 90 days, newest first. Click one for its command and files."
        actions={
          <NeumorphButton size="small" onClick={clearFinishedJobs}>
            Clear this session
          </NeumorphButton>
        }
      />
      <HaloTabs value={filter} onValueChange={(v) => setSearch({ status: v === "all" ? undefined : (v as ActivitySearch["status"]) })}>
        <HaloTabsList variant="underline">
          {FILTERS.map((f) => (
            <HaloTabsTrigger key={f.id} value={f.id}>
              {f.label}
            </HaloTabsTrigger>
          ))}
          <HaloTabsIndicator variant="underline" />
        </HaloTabsList>
      </HaloTabs>
      {(search.tool || search.q) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Showing only</span>
          {search.tool && <FilterChip label={toolName(search.tool)} onClear={() => setSearch({ tool: undefined })} />}
          {search.q && <FilterChip label={`“${search.q}”`} onClear={() => setSearch({ q: undefined })} />}
        </div>
      )}
      {jobs.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-12 text-center text-sm">
          {filter === "all" && !search.tool && !search.q ? "No jobs yet." : "Nothing here."}
        </p>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border">
          {jobs.slice(0, 500).map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </Page>
  )
}
