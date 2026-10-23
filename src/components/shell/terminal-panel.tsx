import { useEffect, useMemo, useRef, useState } from "react"
import { revealItemInDir } from "@tauri-apps/plugin-opener"
import { Eraser, FileText, FolderOpen, Square, SquareTerminal, X } from "lucide-react"
import { useShallow } from "zustand/react/shallow"

import { JobTimer } from "@/components/job-timer"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  TerminalAnimationBlinkingCursor,
  TerminalAnimationCommandBar,
  TerminalAnimationOutput,
  TerminalAnimationRoot,
  TerminalAnimationTrailingPrompt,
  useTerminalAnimation,
} from "@/components/ui/terminal-animation"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/lib/api"
import { jobTitle, type SummaryLine, summaryLines } from "@/lib/jobs"
import { cn } from "@/lib/utils"
import { isActive, type Job, useApp } from "@/store"

/** Jobs kept in the session view; older ones live on the Activity page. */
const MAX_JOBS = 150

const TONE_CLASS: Record<SummaryLine["tone"], string> = {
  muted: "text-neutral-500",
  default: "text-neutral-200",
  success: "text-emerald-400",
  error: "text-red-400",
}

const STATUS_DOT: Record<Job["status"], string> = {
  queued: "bg-neutral-500",
  running: "bg-sky-400 animate-pulse",
  done: "bg-emerald-400",
  error: "bg-red-400",
  cancelled: "bg-neutral-600",
}

/**
 * Jobs whose command has already been typed out. Their blocks render straight
 * away when the terminal reopens, instead of replaying the animation.
 */
const typed = new Set<string>()

/** Collapses ffmpeg's `\r`-rewritten stats lines and strips colour codes. */
function cleanLog(raw: string): string {
  return raw
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split("\n")
    .map((line) => line.split("\r").filter(Boolean).pop() ?? "")
    .join("\n")
    .trim()
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onClick}
          aria-label={label}
          className="text-neutral-400 hover:bg-white/10 hover:text-white"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function FullLogDialog({ job, onClose }: { job: Job | null; onClose: () => void }) {
  const [log, setLog] = useState<{ id: string; text: string } | null>(null)
  const jobId = job?.id
  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    void api.jobLog(jobId).then((text) => !cancelled && setLog({ id: jobId, text: cleanLog(text ?? "") }))
    return () => {
      cancelled = true
    }
  }, [jobId])
  const text = log && log.id === jobId ? log.text || "No output." : null

  return (
    <Dialog open={!!job} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Full log</DialogTitle>
          <DialogDescription>{job && `${job.label} · ${jobTitle(job)}`}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] rounded-lg bg-neutral-950">
          <pre className="p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-neutral-300 select-text">
            {text ?? "Loading…"}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-emerald-400 select-none">$</span>
      {children}
    </div>
  )
}

function Line({ line }: { line: SummaryLine }) {
  return <div className={cn("whitespace-pre-wrap", TONE_CLASS[line.tone])}>{line.text || " "}</div>
}

/** Remembers when the command finished typing, so it isn't replayed later. */
function MarkTyped({ id }: { id: string }) {
  const { isTypingCommand } = useTerminalAnimation()
  useEffect(() => {
    if (!isTypingCommand) typed.add(id)
  }, [isTypingCommand, id])
  return null
}

/** A job's first appearance: the command types itself, then its lines arrive one by one. */
function AnimatedBody({ job }: { job: Job }) {
  const lines = summaryLines(job)
  const tabs = useMemo(
    () => [
      {
        id: job.id,
        label: jobTitle(job),
        command: job.displayCommand ?? "",
        lines: lines.map((line) => ({ text: line.text, color: line.tone, delay: 120 })),
        done: !isActive(job),
      },
    ],
    // summaryLines builds new objects each render; its text is what matters.
    [job.id, job.displayCommand, job.status, lines.map((l) => l.text).join("\n")],
  )

  return (
    <TerminalAnimationRoot tabs={tabs} activeTab={0} className="space-y-0.5">
      <MarkTyped id={job.id} />
      <Prompt>
        <TerminalAnimationCommandBar
          className="break-all text-white select-text"
          cursor={<TerminalAnimationBlinkingCursor className="bg-neutral-400" />}
        />
      </Prompt>
      <TerminalAnimationOutput
        className="space-y-0.5"
        renderLine={(line, _i, visible) =>
          visible ? <Line line={{ text: line.text, tone: line.color as SummaryLine["tone"] }} /> : null
        }
      />
      <TerminalAnimationTrailingPrompt>
        <TerminalAnimationBlinkingCursor className="bg-neutral-500" />
      </TerminalAnimationTrailingPrompt>
    </TerminalAnimationRoot>
  )
}

/** A job that's already been shown once: everything at once, still updating live. */
function StaticBody({ job }: { job: Job }) {
  return (
    <div className="space-y-0.5">
      <Prompt>
        <span className="break-all text-white select-text">{job.displayCommand}</span>
      </Prompt>
      {summaryLines(job).map((line, i) => (
        <Line key={i} line={line} />
      ))}
    </div>
  )
}

function JobBlock({ job, highlighted, onShowLog }: { job: Job; highlighted: boolean; onShowLog: (job: Job) => void }) {
  const cancelJob = useApp((s) => s.cancelJob)
  return (
    <div
      data-job={job.id}
      className={cn(
        "group/job -mx-2 rounded-lg px-2 py-1.5 transition-colors duration-700",
        highlighted ? "bg-white/[0.07]" : "hover:bg-white/[0.03]",
      )}
    >
      <div className="mb-1 flex h-6 items-center gap-2 font-sans">
        <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[job.status])} />
        <span className="min-w-0 truncate text-xs font-medium text-neutral-300">{jobTitle(job)}</span>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/job:opacity-100 focus-within:opacity-100">
            {isActive(job) && (
              <IconAction label="Cancel job" onClick={() => cancelJob(job.id)}>
                <Square />
              </IconAction>
            )}
            {job.output && (
              <IconAction label="Show in Finder" onClick={() => revealItemInDir(job.output!)}>
                <FolderOpen />
              </IconAction>
            )}
            {job.command && (
              <CopyButton
                value={job.command}
                tooltip="Copy full command"
                className="size-6 text-neutral-400 hover:bg-white/10 hover:text-white"
              />
            )}
            <IconAction label="View full log" onClick={() => onShowLog(job)}>
              <FileText />
            </IconAction>
          </div>
          <JobTimer job={job} variant="ghost" className="ml-1 text-neutral-300" />
        </div>
      </div>
      {typed.has(job.id) ? <StaticBody job={job} /> : <AnimatedBody job={job} />}
    </div>
  )
}

/** "── Image format · 12 files · 14:32 ── 10 done, 2 failed" */
function RunHeading({ jobs }: { jobs: Job[] }) {
  const first = jobs[0]
  const time = new Date(first.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  const count = (status: Job["status"]) => jobs.filter((j) => j.status === status).length
  const parts =
    first.kind === "install"
      ? [first.label, time]
      : [first.label, `${jobs.length} file${jobs.length === 1 ? "" : "s"}`, time]
  const outcome = [
    count("running") && `${count("running")} running`,
    count("queued") && `${count("queued")} queued`,
    count("done") && `${count("done")} done`,
    count("error") && `${count("error")} failed`,
    count("cancelled") && `${count("cancelled")} cancelled`,
  ].filter(Boolean)

  return (
    <div className="flex items-center gap-3 pt-2 pb-1 font-sans text-[11px] text-neutral-500">
      <span className="h-px w-4 bg-white/10" />
      <span className="shrink-0 font-medium text-neutral-400">{parts.join(" · ")}</span>
      <span className="h-px flex-1 bg-white/10" />
      <span className={cn("shrink-0 tabular-nums", count("error") > 0 && "text-red-400")}>{outcome.join(", ")}</span>
    </div>
  )
}

/** Jobs grouped by the Run click that started them, oldest run first. */
function groupRuns(jobs: Job[]): Job[][] {
  const runs = new Map<string, Job[]>()
  for (const job of jobs) runs.set(job.runId, [...(runs.get(job.runId) ?? []), job])
  return [...runs.values()]
}

/**
 * Keeps the view pinned to the newest output, unless you've scrolled up to
 * read something older.
 */
function useStickToBottom() {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)

  useEffect(() => {
    const v = viewport.current
    const c = content.current
    if (!v || !c) return
    const pin = () => {
      v.scrollTop = v.scrollHeight
    }
    pin()
    // Only you can unpin it, by scrolling up. Scroll events alone can't tell
    // that apart from output growing under our own scroll, so watch the input.
    const unpin = () => {
      if (v.scrollHeight - v.scrollTop - v.clientHeight > 32) atBottom.current = false
    }
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) atBottom.current = false
    }
    let dragging = false
    const onPointerDown = () => (dragging = true)
    const onPointerUp = () => (dragging = false)
    const onScroll = () => {
      if (v.scrollHeight - v.scrollTop - v.clientHeight < 32) atBottom.current = true
      else if (dragging) unpin()
    }
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "PageUp", "Home"].includes(e.key)) requestAnimationFrame(unpin)
    }
    const observer = new ResizeObserver(() => {
      if (atBottom.current) pin()
    })
    v.addEventListener("scroll", onScroll)
    v.addEventListener("wheel", onWheel, { passive: true })
    v.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("pointerup", onPointerUp)
    v.addEventListener("keydown", onKey)
    observer.observe(c)
    return () => {
      v.removeEventListener("scroll", onScroll)
      v.removeEventListener("wheel", onWheel)
      v.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointerup", onPointerUp)
      v.removeEventListener("keydown", onKey)
      observer.disconnect()
    }
  }, [])

  return { viewport, content, atBottom }
}

export function TerminalPanel() {
  const jobs = useApp(
    useShallow((s) =>
      s.jobOrder
        .filter((id) => !s.terminal.hiddenIds.includes(id))
        .slice(-MAX_JOBS)
        .map((id) => s.jobs[id]),
    ),
  )
  const activeJobId = useApp((s) => s.terminal.activeJobId)
  const setTerminal = useApp((s) => s.setTerminal)
  const clearTerminal = useApp((s) => s.clearTerminal)
  const [logJob, setLogJob] = useState<Job | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const { viewport, content, atBottom } = useStickToBottom()

  const runs = useMemo(() => groupRuns(jobs), [jobs])
  const running = jobs.filter((j) => j.status === "running").length
  const queued = jobs.filter((j) => j.status === "queued").length
  const canClear = jobs.some((j) => !isActive(j))

  // "Show in terminal" from elsewhere: scroll to that job and flash it.
  useEffect(() => {
    if (!activeJobId) return
    const el = viewport.current?.querySelector(`[data-job="${CSS.escape(activeJobId)}"]`)
    if (!el) return
    el.scrollIntoView({ block: "nearest" })
    atBottom.current = false
    setHighlight(activeJobId)
    const t = setTimeout(() => setHighlight(null), 1200)
    return () => clearTimeout(t)
  }, [activeJobId, viewport, atBottom])

  return (
    <div className="dark flex h-full flex-col bg-neutral-950 text-neutral-200">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-white/10 pr-2 pl-3">
        <SquareTerminal className="size-3.5 shrink-0 text-neutral-500" />
        <span className="text-xs font-medium text-neutral-300">Terminal</span>
        {(running > 0 || queued > 0) && (
          <span className="text-xs text-neutral-500 tabular-nums">
            {[running > 0 && `${running} running`, queued > 0 && `${queued} queued`].filter(Boolean).join(" · ")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="xs"
                variant="ghost"
                disabled={!canClear}
                onClick={clearTerminal}
                className="gap-1.5 text-neutral-400 hover:bg-white/10 hover:text-white"
              >
                <Eraser /> Clear
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear finished jobs. Activity keeps them.</TooltipContent>
          </Tooltip>
          <IconAction label="Hide terminal (⌘J)" onClick={() => setTerminal({ open: false })}>
            <X />
          </IconAction>
        </div>
      </div>

      <div ref={viewport} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={content} className="space-y-1 px-4 pt-1 pb-3 font-mono text-[12.5px] leading-relaxed">
          {runs.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-neutral-500">
              Commands appear here when you run a tool.
            </div>
          ) : (
            runs.map((run) => {
              const shown = run.filter((j) => j.status !== "queued")
              const waiting = run.length - shown.length
              return (
                <section key={run[0].runId}>
                  <RunHeading jobs={run} />
                  {shown.map((job) => (
                    <JobBlock key={job.id} job={job} highlighted={highlight === job.id} onShowLog={setLogJob} />
                  ))}
                  {waiting > 0 && (
                    <div className="py-1 text-neutral-500">
                      … {waiting} more waiting for a free slot
                    </div>
                  )}
                </section>
              )
            })
          )}
        </div>
      </div>
      <FullLogDialog job={logJob} onClose={() => setLogJob(null)} />
    </div>
  )
}
