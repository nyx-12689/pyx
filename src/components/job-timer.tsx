import { Timer, TimerDisplay, TimerIcon, TimerRoot } from "@/components/ui/timer"
import type { Job } from "@/store"

type TimerVariant = "default" | "outline" | "ghost" | "destructive"

/** "04.27" — matches the Timer's own SS.MS display. */
function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const hundredths = Math.floor((ms % 1000) / 10)
  return `${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`
}

/** A job's run time: ticking while it runs, frozen at the final time once it ends. */
export function JobTimer({
  job,
  variant = "outline",
  className,
}: {
  job: Job
  variant?: TimerVariant
  className?: string
}) {
  if (job.status === "running") {
    return (
      <Timer
        loading
        startedAt={job.startedAt ?? undefined}
        format="SS.MS"
        size="sm"
        variant={variant}
        className={className}
      />
    )
  }
  if (job.elapsedMs === null) return null
  return (
    <TimerRoot size="sm" variant={job.status === "error" ? "destructive" : variant} className={className}>
      <TimerIcon size="sm" />
      <TimerDisplay size="sm" time={formatElapsed(job.elapsedMs)} />
    </TimerRoot>
  )
}
