import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Activity, BookOpen, Boxes, Download, LayoutDashboard, Settings, SquareTerminal, Wrench } from "lucide-react"
import { useShallow } from "zustand/react/shallow"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { useApp } from "@/store"
import { CATEGORIES, TOOLS } from "@/tools/registry"

/** ⌘K: jump to any page or tool. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const setTerminal = useApp((s) => s.setTerminal)
  const terminalOpen = useApp((s) => s.terminal.open)
  const installDependency = useApp((s) => s.installDependency)
  // Missing formulas, when Homebrew is there to install them.
  const installable = useApp(
    useShallow((s) =>
      s.deps?.brewPath
        ? [...new Set(s.deps.dependencies.filter((d) => !d.path && d.name !== "ffprobe").map((d) => d.formula))]
        : [],
    ),
  )

  const go = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }

  const pages = [
    { label: "Dashboard", icon: LayoutDashboard, to: "/" as const },
    { label: "All tools", icon: Wrench, to: "/tools" as const },
    { label: "Activity", icon: Activity, to: "/activity" as const },
    { label: "Formats guide", icon: BookOpen, to: "/formats" as const },
    { label: "Dependencies", icon: Boxes, to: "/dependencies" as const },
    { label: "Settings", icon: Settings, to: "/settings" as const },
  ]

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette" description="Jump to a tool or page">
      {/* shadcn's CommandDialog doesn't include the cmdk root; the items need it. */}
      <Command>
        <CommandInput placeholder="Search tools and pages…" />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          <CommandGroup heading="Tools">
            {TOOLS.map((tool) => (
              <CommandItem
                key={tool.id}
                value={`${tool.name} ${CATEGORIES.find((c) => c.id === tool.category)?.label} ${tool.description}`}
                onSelect={() => go(() => navigate({ to: "/tools/$toolId", params: { toolId: tool.id } }))}
              >
                <tool.icon />
                <span>{tool.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {CATEGORIES.find((c) => c.id === tool.category)?.label}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Go to">
            {pages.map((page) => (
              <CommandItem key={page.to} onSelect={() => go(() => navigate({ to: page.to }))}>
                <page.icon />
                <span>{page.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => go(() => setTerminal({ open: !terminalOpen }))}>
              <SquareTerminal />
              <span>{terminalOpen ? "Hide" : "Show"} terminal</span>
              <CommandShortcut>⌘J</CommandShortcut>
            </CommandItem>
            {installable.map((formula) => (
              <CommandItem key={formula} onSelect={() => go(() => void installDependency(formula, false))}>
                <Download />
                <span>Install {formula}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

/** Opens the palette with ⌘K and toggles the terminal with ⌘J. */
export function useGlobalShortcuts() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const setTerminal = useApp((s) => s.setTerminal)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === "k") {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      } else if (e.key === "j") {
        e.preventDefault()
        setTerminal({ open: !useApp.getState().terminal.open })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setTerminal])

  return { paletteOpen, setPaletteOpen }
}
