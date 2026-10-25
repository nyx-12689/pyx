import { useState } from "react"
import { Link, useLocation } from "@tanstack/react-router"
import { Activity, BookOpen, Boxes, LayoutDashboard, Pencil, Pin, PinOff, Settings, Wrench } from "lucide-react"

import { PixelHeading } from "@/components/ui/pixel-heading-character"
import { PyxMark } from "@/components/pyx-mark"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { TITLE_BAR_HEIGHT } from "@/components/shell/metrics"
import { PinnedToolsDialog } from "@/components/shell/pinned-tools-dialog"
import { isActive, useApp } from "@/store"
import { cn } from "@/lib/utils"
import { TOOLS, type ToolDef } from "@/tools/registry"

export function AppSidebar() {
  const { pathname } = useLocation()
  const runningCount = useApp((s) => s.jobOrder.filter((id) => isActive(s.jobs[id])).length)
  const missingDeps = useApp((s) => s.deps?.dependencies.filter((d) => !d.path).length ?? 0)
  const pinnedTools = useApp((s) => s.settings.pinnedTools)
  const togglePinnedTool = useApp((s) => s.togglePinnedTool)
  const [editingPins, setEditingPins] = useState(false)
  const pinned = pinnedTools.map((id) => TOOLS.find((t) => t.id === id)).filter((t): t is ToolDef => !!t)
  // The open tool, when it isn't pinned, shows apart from the pins so you can pin it.
  const openTool = TOOLS.find((t) => pathname === `/tools/${t.id}`)
  const unpinnedOpenTool = openTool && !pinnedTools.includes(openTool.id) ? openTool : undefined

  const toolRow = (tool: ToolDef, isPinned: boolean) => (
    <SidebarMenuItem key={tool.id}>
      <SidebarMenuButton
        asChild
        isActive={pathname === `/tools/${tool.id}`}
        tooltip={isPinned ? tool.name : `${tool.name} (not pinned)`}
      >
        <Link to="/tools/$toolId" params={{ toolId: tool.id }}>
          <tool.icon />
          <span>{tool.name}</span>
        </Link>
      </SidebarMenuButton>
      <SidebarMenuAction
        showOnHover={isPinned}
        title={isPinned ? `Unpin ${tool.name}` : `Pin ${tool.name}`}
        // Blur after the click, or focus keeps the action showing once the row changes.
        onClick={(e) => {
          togglePinnedTool(tool.id)
          e.currentTarget.blur()
        }}
      >
        {isPinned ? <PinOff /> : <Pin />}
      </SidebarMenuAction>
    </SidebarMenuItem>
  )

  return (
    // A floating card under the title bar (which holds the traffic lights).
    // Collapsed, it narrows to an icon strip; hovering an icon names it.
    <Sidebar variant="floating" collapsible="icon" className="h-auto!" style={{ top: TITLE_BAR_HEIGHT }}>
      {/*
        Same height in both states, so the icons below never move when it collapses:
        the app icon's tile stays put and the name beside it fades out.
      */}
      <Link to="/" aria-label="Pyx" className="relative block h-11 shrink-0 overflow-hidden">
        <span
          aria-hidden
          className="bg-foreground text-background absolute top-2.5 left-2 flex size-8 items-center justify-center rounded-[9px]"
        >
          <PyxMark small className="size-6" />
        </span>
        <span className="absolute top-4 left-12 whitespace-nowrap transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0">
          <PixelHeading
            as="h1"
            mode="multi"
            showLabel={false}
            className="text-xl leading-none font-semibold tracking-tight"
          >
            Pyx
          </PixelHeading>
        </span>
      </Link>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Dashboard">
                <Link to="/">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/activity"}
                tooltip={runningCount > 0 ? `Activity · ${runningCount} running` : "Activity"}
              >
                <Link to="/activity">
                  <Activity />
                  <span>Activity</span>
                </Link>
              </SidebarMenuButton>
              {runningCount > 0 && <SidebarMenuBadge>{runningCount}</SidebarMenuBadge>}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/formats")} tooltip="Formats">
                <Link to="/formats">
                  <BookOpen />
                  <span>Formats</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          {/* Keeps its space when collapsed (shadcn pulls it up), so the tool icons stay put. */}
          <SidebarGroupLabel className="group-data-[collapsible=icon]:mt-0!">Tools</SidebarGroupLabel>
          <SidebarGroupAction title="Edit pinned tools" onClick={() => setEditingPins(true)}>
            <Pencil />
            <span className="sr-only">Edit pinned tools</span>
          </SidebarGroupAction>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/tools"} tooltip="All tools">
                <Link to="/tools" search={{}}>
                  <Wrench />
                  <span>All tools</span>
                </Link>
              </SidebarMenuButton>
              {/*
                Pinned tools hang under All tools. Expanded: indented along a guide line.
                Collapsed: gathered on a tinted pill under its icon. Rows keep their
                height either way, so nothing moves up or down when it collapses.
              */}
              {pinned.length > 0 && (
                <ul
                  className={cn(
                    "mt-0.5 flex flex-col gap-0.5 transition-[margin,padding,background-color,border-color] duration-200",
                    "border-sidebar-border ml-[15px] border-l pl-[7px]",
                    "group-data-[collapsible=icon]:bg-sidebar-accent/70 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:rounded-[10px] group-data-[collapsible=icon]:border-l-0 group-data-[collapsible=icon]:pl-0",
                  )}
                >
                  {pinned.map((tool) => toolRow(tool, true))}
                </ul>
              )}
              {/*
                The open, unpinned tool: below the pins, behind a dashed line (expanded) or
                in a dashed outline (collapsed), with a label saying it isn't pinned.
              */}
              {unpinnedOpenTool && (
                <div className="mt-2">
                  <p className="text-sidebar-foreground/50 mb-0.5 ml-[23px] h-4 text-[11px] leading-4 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0">
                    Open, not pinned
                  </p>
                  <ul
                    className={cn(
                      "border-sidebar-foreground/30 ml-[15px] border-l border-dashed pl-[7px] transition-[margin,padding,border-radius] duration-200",
                      "group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:rounded-[10px] group-data-[collapsible=icon]:border group-data-[collapsible=icon]:pl-0",
                    )}
                  >
                    {toolRow(unpinnedOpenTool, false)}
                  </ul>
                </div>
              )}
              {pinned.length === 0 && !unpinnedOpenTool && (
                <button
                  type="button"
                  onClick={() => setEditingPins(true)}
                  className="text-sidebar-foreground/60 hover:text-sidebar-foreground mt-1 ml-[15px] block border-l pl-[15px] text-left text-xs leading-relaxed group-data-[collapsible=icon]:hidden"
                >
                  Pin the tools you use most to keep them here.
                </button>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/dependencies"}
              tooltip={missingDeps > 0 ? `Dependencies · ${missingDeps} missing` : "Dependencies"}
            >
              <Link to="/dependencies">
                <Boxes />
                <span>Dependencies</span>
              </Link>
            </SidebarMenuButton>
            {missingDeps > 0 && <SidebarMenuBadge className="text-destructive">{missingDeps} missing</SidebarMenuBadge>}
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/settings"} tooltip="Settings">
              <Link to="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <PinnedToolsDialog open={editingPins} onOpenChange={setEditingPins} />
    </Sidebar>
  )
}
