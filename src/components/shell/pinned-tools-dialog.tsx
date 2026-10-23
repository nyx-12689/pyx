import { useEffect, useState } from "react"
import { GripVertical, Pin, PinOff } from "lucide-react"
import { Reorder } from "motion/react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useApp } from "@/store"
import { CATEGORIES, TOOLS, type ToolDef } from "@/tools/registry"

const categoryLabel = (tool: ToolDef) => CATEGORIES.find((c) => c.id === tool.category)?.label

function ToolLabel({ tool }: { tool: ToolDef }) {
  return (
    <>
      <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
        <tool.icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{tool.name}</span>
        <span className="text-muted-foreground block text-xs">{categoryLabel(tool)}</span>
      </span>
    </>
  )
}

/** Edit which tools are pinned to the sidebar, and drag them into order. */
export function PinnedToolsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pinnedTools = useApp((s) => s.settings.pinnedTools)
  const updateSettings = useApp((s) => s.updateSettings)
  const togglePinnedTool = useApp((s) => s.togglePinnedTool)
  // Reordering happens here while dragging, and is saved when the drag ends.
  const [order, setOrder] = useState(pinnedTools)
  useEffect(() => setOrder(pinnedTools), [pinnedTools])

  const pinned = order.map((id) => TOOLS.find((t) => t.id === id)).filter((t): t is ToolDef => !!t)
  const others = TOOLS.filter((t) => !order.includes(t.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pinned tools</DialogTitle>
          <DialogDescription>
            Pinned tools appear in the sidebar under All tools. Drag them to change the order.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Pinned</h3>
          {pinned.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-sm">
              Nothing pinned yet. Pin a tool below.
            </p>
          ) : (
            <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-1">
              {pinned.map((tool) => (
                <Reorder.Item
                  key={tool.id}
                  value={tool.id}
                  onDragEnd={() => updateSettings({ pinnedTools: order })}
                  className="bg-card flex cursor-grab items-center gap-2.5 rounded-lg border px-2 py-1.5 select-none active:cursor-grabbing"
                >
                  <GripVertical className="text-muted-foreground size-4 shrink-0" />
                  <ToolLabel tool={tool} />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Unpin ${tool.name}`}
                    // Not a drag: a click on the button only unpins.
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => togglePinnedTool(tool.id)}
                  >
                    <PinOff />
                  </Button>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
        </section>

        {others.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Other tools</h3>
            <ul className="space-y-1">
              {others.map((tool) => (
                <li key={tool.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 pl-[34px]">
                  <ToolLabel tool={tool} />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Pin ${tool.name}`}
                    onClick={() => togglePinnedTool(tool.id)}
                  >
                    <Pin />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}
