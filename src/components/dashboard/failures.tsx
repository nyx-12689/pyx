import { useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { CircleAlert, CircleCheck } from "lucide-react"

import { Empty, Panel, formatAgo } from "@/components/dashboard/viz"
import { HaloBadge } from "@/components/ui/halo-badge"
import { errorGroups } from "@/lib/analytics"
import type { HistoryRecord } from "@/lib/types"

/** Failed jobs grouped by their error, each linking to those jobs in Activity. */
export function Failures({ records, className }: { records: HistoryRecord[]; className?: string }) {
  const groups = useMemo(() => errorGroups(records), [records])
  const failed = groups.reduce((n, g) => n + g.count, 0)

  return (
    <Panel
      title="What went wrong"
      description="Failed jobs grouped by their error. Click one to see those jobs."
      className={className}
      actions={
        failed > 0 && (
          <HaloBadge variant="destructive" tabularNums>
            {failed} failed
          </HaloBadge>
        )
      }
    >
      {groups.length === 0 ? (
        <Empty>
          <span className="flex items-center gap-2">
            <CircleCheck className="size-4 text-emerald-500" /> No failures in this period.
          </span>
        </Empty>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {groups.slice(0, 6).map((g) => (
            <li key={g.message}>
              <Link
                to="/activity"
                search={{ status: "error", q: g.message }}
                className="hover:bg-muted/40 flex items-start gap-3 rounded-lg px-2 py-2"
              >
                <CircleAlert className="text-destructive mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-mono text-xs">{g.message}</span>
                  <span className="text-muted-foreground mt-0.5 block text-[11px]">
                    {g.tools.join(", ")} · last {formatAgo(g.lastAt)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">×{g.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
