import { createHashHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router"

import { AppShell } from "@/components/shell/app-shell"
import { ActivityPage } from "@/pages/activity"
import { DashboardPage } from "@/pages/dashboard"
import { DependenciesPage } from "@/pages/dependencies"
import { FormatArticlePage } from "@/pages/format-article"
import { FormatsPage } from "@/pages/formats"
import type { GuideSectionId } from "@/lib/format-guide"
import { SettingsPage } from "@/pages/settings"
import { ToolWorkspacePage } from "@/pages/tool-workspace"
import { ToolsPage } from "@/pages/tools"
import type { ToolCategory } from "@/tools/registry"

const rootRoute = createRootRoute({ component: AppShell })

const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: DashboardPage })

const toolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tools",
  component: ToolsPage,
  validateSearch: (search: Record<string, unknown>): { category?: ToolCategory } => ({
    category: typeof search.category === "string" ? (search.category as ToolCategory) : undefined,
  }),
})

const toolRoute = createRoute({ getParentRoute: () => rootRoute, path: "/tools/$toolId", component: ToolWorkspacePage })

export type ActivityStatus = "running" | "done" | "error"

export interface ActivitySearch {
  status?: ActivityStatus
  /** Tool id. */
  tool?: string
  /** Text to match in the file name or error. */
  q?: string
}

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity",
  component: ActivityPage,
  validateSearch: (search: Record<string, unknown>): ActivitySearch => ({
    status: ["running", "done", "error"].includes(search.status as string) ? (search.status as ActivityStatus) : undefined,
    tool: typeof search.tool === "string" ? search.tool : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
})

const dependenciesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dependencies",
  component: DependenciesPage,
})

// The Formats wiki: /formats lists a section's formats, /formats/<id> is one format's article.
const formatsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/formats" })

const formatsIndexRoute = createRoute({
  getParentRoute: () => formatsRoute,
  path: "/",
  component: FormatsPage,
  validateSearch: (search: Record<string, unknown>): { section?: GuideSectionId } => ({
    section: ["images", "video", "audio", "gif"].includes(search.section as string)
      ? (search.section as GuideSectionId)
      : undefined,
  }),
})

const formatArticleRoute = createRoute({
  getParentRoute: () => formatsRoute,
  path: "$formatId",
  component: FormatArticlePage,
})

const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage })

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  toolsRoute,
  toolRoute,
  activityRoute,
  dependenciesRoute,
  formatsRoute.addChildren([formatsIndexRoute, formatArticleRoute]),
  settingsRoute,
])

// Hash history: the app is served from a single file, so path URLs wouldn't survive a reload.
export const router = createRouter({ routeTree, history: createHashHistory() })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
