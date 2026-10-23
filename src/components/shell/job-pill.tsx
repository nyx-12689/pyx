import { AnimatePresence, motion } from "motion/react"
import { useShallow } from "zustand/react/shallow"

import { HaloBadge } from "@/components/ui/halo-badge"
import { isActive, useApp } from "@/store"

/**
 * Title-bar status for running jobs, in the spirit of a Dynamic Island: it
 * appears while work is in flight and opens the terminal on click.
 */
export function JobPill() {
  // useShallow: the selector builds a new array, which would otherwise re-render forever.
  const active = useApp(useShallow((s) => s.jobOrder.map((id) => s.jobs[id]).filter(isActive)))
  const showJobInTerminal = useApp((s) => s.showJobInTerminal)

  const withProgress = active.filter((j) => j.progress !== null)
  const overall = withProgress.length ? withProgress.reduce((sum, j) => sum + (j.progress ?? 0), 0) / withProgress.length : null
  const newest = active[active.length - 1]

  return (
    <AnimatePresence>
      {newest && (
        <motion.button
          key="pill"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.45 }}
          onClick={() => showJobInTerminal(newest.id)}
          aria-label="Show running jobs in the terminal"
        >
          {/* layout off: the percentage changes often. */}
          <HaloBadge live variant="secondary" tabularNums layout={false}>
            {active.length} running{overall !== null && ` · ${Math.round(overall * 100)}%`}
          </HaloBadge>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
