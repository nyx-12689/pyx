import { basename, formatBytes, formatDuration } from "@/lib/format"
import type { Job } from "@/store"

/** "photo.png" for tool jobs, the formula for installs. */
export function jobTitle(job: Job): string {
  return job.input ? basename(job.input) : job.subject
}

/** "−74%" / "+12%" for a finished job that changed a file's size. */
export function sizeChange(job: Job): { text: string; smaller: boolean } | null {
  if (job.status !== "done" || !job.inputInfo || job.outputSize === null) return null
  const change = job.outputSize / job.inputInfo.size - 1
  return { text: `${change < 0 ? "−" : "+"}${Math.abs(change * 100).toFixed(0)}%`, smaller: change < 0 }
}

export function elapsed(job: Job): string | null {
  return job.elapsedMs === null ? null : `${(job.elapsedMs / 1000).toFixed(1)}s`
}

export function describeInput(job: Job): string | null {
  const info = job.inputInfo
  if (!info) return null
  const parts = [basename(info.path)]
  if (info.width && info.height) parts.push(`${info.width}×${info.height}`)
  if (info.duration) parts.push(formatDuration(info.duration))
  parts.push(formatBytes(info.size))
  return parts.join(" · ")
}

export interface SummaryLine {
  text: string
  tone: "muted" | "default" | "success" | "error"
}

const BAR_WIDTH = 24

const bar = (progress: number) => {
  const filled = Math.round(progress * BAR_WIDTH)
  return `${"█".repeat(filled)}${"░".repeat(BAR_WIDTH - filled)}  ${Math.round(progress * 100)}%`
}

/**
 * The tidy lines the terminal panel shows under a job's command. Lines are only
 * ever appended or updated in place as the job advances, so the terminal can
 * reveal them as they arrive.
 */
export function summaryLines(job: Job): SummaryLine[] {
  const lines: SummaryLine[] = []
  const input = describeInput(job)
  lines.push(
    input
      ? { text: `Input   ${input}`, tone: "muted" }
      : { text: `Homebrew ${job.label.toLowerCase()}`, tone: "muted" },
  )

  switch (job.status) {
    case "queued":
      lines.push({ text: "…       Waiting for a free slot", tone: "muted" })
      break
    case "running":
      lines.push({ text: job.progress === null ? "▸       Working…" : `▸       ${bar(job.progress)}`, tone: "default" })
      break
    case "done": {
      // A full bar stays, so even a job too quick to watch shows it completed.
      lines.push({ text: `▸       ${bar(1)}`, tone: "default" })
      lines.push({ text: `✓       Done in ${elapsed(job) ?? "—"}`, tone: "success" })
      if (job.output) {
        const change = sizeChange(job)
        const size = job.outputSize === null ? "" : ` · ${formatBytes(job.outputSize)}`
        lines.push({ text: `Output  ${basename(job.output)}${size}${change ? ` (${change.text})` : ""}`, tone: "default" })
      }
      break
    }
    case "error": {
      lines.push({ text: `✗       Failed${elapsed(job) ? ` after ${elapsed(job)}` : ""}`, tone: "error" })
      const reason = job.error?.split("\n").filter(Boolean).slice(-2) ?? []
      for (const line of reason) lines.push({ text: `        ${line}`, tone: "error" })
      break
    }
    case "cancelled":
      lines.push({ text: "■       Cancelled", tone: "muted" })
      break
  }
  return lines
}
