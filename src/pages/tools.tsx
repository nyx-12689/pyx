import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { LayoutGrid } from "lucide-react"

import { Page, PageHeader, SectionTitle } from "@/components/page"
import { PinToolButton } from "@/components/pin-tool-button"
import { HaloBadge } from "@/components/ui/halo-badge"
import { GradientButtonGroup } from "@/components/ui/gradient-button-group"
import { cn } from "@/lib/utils"
import { useApp, useDependencyAvailable } from "@/store"
import { activeCategories, CATEGORIES, type ToolCategory, TOOLS, type ToolDef } from "@/tools/registry"

const KIND_LABEL = { image: "Images", video: "Video", audio: "Audio", unknown: "" }

export function ToolCard({ tool }: { tool: ToolDef }) {
  const available = useDependencyAvailable(tool.requires)
  const missing = available === false
  const pinned = useApp((s) => s.settings.pinnedTools.includes(tool.id))

  return (
    // The pin button sits beside the link, not inside it, so it never opens the tool.
    <div className="group/card relative">
      <Link
        to="/tools/$toolId"
        params={{ toolId: tool.id }}
        className={cn(
          "group bg-card hover:border-foreground/20 flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors",
          missing && "opacity-60",
        )}
      >
        <div className="flex items-start justify-between pr-9">
          <div className="bg-muted text-muted-foreground group-hover:text-foreground flex size-9 items-center justify-center rounded-lg transition-colors">
            <tool.icon className="size-4" />
          </div>
          {missing && <HaloBadge variant="destructive">Needs {tool.requires}</HaloBadge>}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{tool.name}</p>
          <p className="text-muted-foreground line-clamp-2 text-xs">{tool.description}</p>
        </div>
        <div className="mt-auto flex gap-1">
          {tool.accepts.map((kind) => (
            <HaloBadge key={kind} variant="secondary" interactive={false}>
              {KIND_LABEL[kind]}
            </HaloBadge>
          ))}
        </div>
      </Link>
      <PinToolButton
        toolId={tool.id}
        className={cn(
          "absolute top-3 right-3",
          !pinned && "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100",
        )}
      />
    </div>
  )
}

export function ToolsPage() {
  const { category } = useSearch({ from: "/tools" })
  const navigate = useNavigate()
  const categories = category ? CATEGORIES.filter((c) => c.id === category) : activeCategories()

  return (
    <Page>
      <PageHeader
        title={category ? (CATEGORIES.find((c) => c.id === category)?.label ?? "Tools") : "Tools"}
        description="Every tool runs a real ffmpeg or ImageMagick command, shown in the terminal as it runs."
      />
      <GradientButtonGroup<string>
        aria-label="Category"
        size="sm"
        value={category ?? "all"}
        onChange={(id) => navigate({ to: "/tools", search: id === "all" ? {} : { category: id as ToolCategory } })}
        items={[
          { id: "all", label: "All", icon: <LayoutGrid /> },
          ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: <c.icon /> })),
        ]}
      />
      {categories.map((c) => (
        <section key={c.id} className="space-y-3">
          <SectionTitle>{c.label}</SectionTitle>
          {TOOLS.some((t) => t.category === c.id) ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {TOOLS.filter((t) => t.category === c.id).map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
              {c.label} tools are coming in the next version.
            </p>
          )}
        </section>
      ))}
    </Page>
  )
}
