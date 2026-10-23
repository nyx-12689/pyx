import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import { HaloProgress } from "@/components/ui/halo-progress"
import { cn } from "@/lib/utils"
import type { Job } from "@/store"

/** A bar shows for at least this long, so sub-second jobs don't flash past unseen. */
const MIN_VISIBLE_MS = 600
/** How long the completed (green, full) bar stays before the result replaces it. */
const FINISH_MS = 900

/**
 * A job's progress bar, sliding open under its row. Percentages are always
 * real (or a moving highlight when the tool reports none); what's stretched is
 * only how long the bar stays: when a job finishes it sweeps to full and
 * lingers briefly.
 *
 * Key it by job id, so a re-run starts fresh.
 */
export function JobProgress({ job, className }: { job: Job; className?: string }) {
  const [finish, setFinish] = useState<number | null>(null)
  const previous = useRef(job.status)
  const shownAt = useRef<number | null>(null)
  const lastProgress = useRef<number | null>(null)

  useEffect(() => {
    if (job.status === "running") {
      shownAt.current ??= Date.now()
      lastProgress.current = job.progress
    }
  }, [job.status, job.progress])

  useEffect(() => {
    const was = previous.current
    previous.current = job.status
    // Only animate a finish we saw happen, not jobs that were already done.
    if (job.status !== "done" || (was !== "running" && was !== "queued")) return
    const visibleFor = shownAt.current === null ? 0 : Date.now() - shownAt.current
    setFinish((lastProgress.current ?? 0) * 100)
    // Next frame: sweep from where it was to full.
    const frame = requestAnimationFrame(() => setFinish(100))
    const timer = setTimeout(() => setFinish(null), Math.max(0, MIN_VISIBLE_MS - visibleFor) + FINISH_MS)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [job.status])

  const running = job.status === "running"
  const finishing = job.status === "done" && finish !== null
  const value = running ? (job.progress === null ? null : Math.round(job.progress * 100)) : finish
  // The number only shows while it's real and current, never ahead of the fill.
  const label = running && job.progress !== null ? `${Math.round(job.progress * 100)}%` : ""

  return (
    <AnimatePresence initial={false}>
      {(running || finishing) && (
        <motion.div
          key="progress"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn("overflow-hidden", className)}
        >
          <div className="flex items-center gap-3 pt-2">
            <HaloProgress
              className="min-w-0 flex-1"
              value={value}
              indicatorClassName={finishing ? "from-emerald-500 to-emerald-500/85" : undefined}
            />
            <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">{label}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
