import { Pin } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useApp } from "@/store"

/** Pins a tool to the sidebar (or unpins it). Safe to put inside a link: it doesn't follow it. */
export function PinToolButton({ toolId, className }: { toolId: string; className?: string }) {
  const pinned = useApp((s) => s.settings.pinnedTools.includes(toolId))
  const togglePinnedTool = useApp((s) => s.togglePinnedTool)
  const label = pinned ? "Unpin from sidebar" : "Pin to sidebar"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={pinned}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            togglePinnedTool(toolId)
          }}
          className={cn(pinned ? "text-foreground" : "text-muted-foreground", className)}
        >
          {pinned ? <Pin className="fill-current" /> : <Pin />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
