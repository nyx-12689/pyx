import { useEffect, useRef } from "react"
import { Outlet, useLocation } from "@tanstack/react-router"
import { Search } from "lucide-react"

import { AppSidebar } from "@/components/shell/app-sidebar"
import { TITLE_BAR_HEIGHT } from "@/components/shell/metrics"
import { CommandPalette, useGlobalShortcuts } from "@/components/shell/command-palette"
import { JobPill } from "@/components/shell/job-pill"
import { TerminalButton, TerminalDock } from "@/components/shell/terminal-dock"
import { useTerminalHeight } from "@/components/shell/terminal-size"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { PolishedToaster } from "@/components/ui/halo-toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useFullscreen } from "@/hooks/use-fullscreen"
import { api } from "@/lib/api"
import { articleById } from "@/lib/format-wiki"
import { useResolvedTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { useApp } from "@/store"
import { toolById } from "@/tools/registry"

function usePageTitle(): string {
  const { pathname } = useLocation()
  if (pathname.startsWith("/tools/")) return toolById(pathname.slice("/tools/".length))?.name ?? "Tool"
  if (pathname.startsWith("/formats/")) return articleById(pathname.slice("/formats/".length))?.name ?? "Formats"
  const titles: Record<string, string> = {
    "/": "Dashboard",
    "/tools": "Tools",
    "/activity": "Activity",
    "/dependencies": "Dependencies",
    "/formats": "Formats",
    "/settings": "Settings",
  }
  return titles[pathname] ?? ""
}

/**
 * Spans the whole window, above the sidebar, so the traffic lights always sit in
 * one continuous bar instead of straddling the sidebar's edge. It has no
 * background or border of its own: it's part of the window, not a separate strip.
 */
function TitleBar({ onSearch }: { onSearch: () => void }) {
  const title = usePageTitle()
  const fullscreen = useFullscreen()

  return (
    <header
      data-tauri-drag-region
      // Everything sits 8px from the window edges, like the floating sidebar below:
      // the lights' tray spans 8–88px, the sidebar button starts 12px after it, Search ends 8px from the right.
      // In full screen the lights move to macOS's slide-down bar, so there's no tray and no gap for them.
      className={cn(
        // Glides rather than jumps when the lights leave or come back with full screen.
        "relative flex shrink-0 items-center gap-2 pr-2 transition-[padding] duration-300 ease-out",
        fullscreen ? "pl-3" : "pl-[100px]",
      )}
      style={{ height: TITLE_BAR_HEIGHT }}
    >
      {/* A recessed tray the native traffic lights sit in (they span 18–78px). */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 left-2 h-[26px] w-20 -translate-y-1/2 rounded-full transition-[opacity,scale] duration-300 ease-out",
          "bg-black/[0.04] shadow-[inset_0_1px_2px_rgba(0,0,0,0.16),inset_0_0_0_0.5px_rgba(0,0,0,0.08),0_1px_0_rgba(255,255,255,0.9)] dark:bg-black/70 dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.9),inset_0_0_0_1px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.1),0_1px_0_rgba(255,255,255,0.16)]",
          // In full screen the lights leave the window, so the tray fades away with them.
          fullscreen && "scale-90 opacity-0",
        )}
      />
      <SidebarTrigger />
      <h1 data-tauri-drag-region className="truncate text-sm font-semibold tracking-tight">
        {title}
      </h1>
      <div data-tauri-drag-region className="flex-1 self-stretch" />
      <JobPill />
      {/* Same height and shape as the lights' tray, so the bar reads as one row. */}
      <Button
        variant="outline"
        size="sm"
        className="text-muted-foreground h-[26px] gap-2 rounded-full px-3"
        onClick={onSearch}
      >
        <Search />
        <span>Search</span>
        <Kbd>⌘K</Kbd>
      </Button>
    </header>
  )
}

export function AppShell() {
  const applyJobEvent = useApp((s) => s.applyJobEvent)
  const refreshDeps = useApp((s) => s.refreshDeps)
  const refreshHistory = useApp((s) => s.refreshHistory)
  const theme = useResolvedTheme()
  const { paletteOpen, setPaletteOpen } = useGlobalShortcuts()
  const { pathname } = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const terminalOpen = useApp((s) => s.terminal.open)
  const terminalHeight = useTerminalHeight()

  // Each page starts at the top, rather than where the last one was scrolled to.
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    void refreshDeps()
    void refreshHistory()
    const unlisten = api.onJobEvent(applyJobEvent)
    return () => {
      void unlisten.then((fn) => fn())
    }
  }, [applyJobEvent, refreshDeps, refreshHistory])

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider className="h-svh min-h-0 flex-col overflow-hidden">
        <TitleBar onSearch={() => setPaletteOpen(true)} />
        <div className="flex min-h-0 flex-1">
          <AppSidebar />
          <SidebarInset className="min-w-0 overflow-hidden">
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto transition-[padding] duration-300"
              // Room to scroll the page's last rows clear of the docked terminal.
              style={{ paddingBottom: terminalOpen ? `calc(${terminalHeight} + 12px)` : 0 }}
            >
              <Outlet />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
      <TerminalDock />
      <TerminalButton />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      {/* Top right, under the title bar: the bottom-right corner belongs to the terminal button. */}
      <PolishedToaster
        position="top-right"
        offset={{ top: TITLE_BAR_HEIGHT + 12, right: 16 }}
        mobileOffset={{ top: TITLE_BAR_HEIGHT + 12, right: 16 }}
        theme={theme}
      />
    </TooltipProvider>
  )
}
