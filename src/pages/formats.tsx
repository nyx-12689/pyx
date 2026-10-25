import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { ArrowRight, AudioLines, Film, ImageIcon, Repeat } from "lucide-react"

import { ExtChip } from "@/components/formats/ratings"
import { Page, PageHeader, SectionTitle } from "@/components/page"
import { Button } from "@/components/ui/button"
import { GradientButtonGroup } from "@/components/ui/gradient-button-group"
import { GUIDE, type GuideSection, type GuideSectionId } from "@/lib/format-guide"
import { articlesIn, chipFor, type FormatArticle } from "@/lib/format-wiki"
import { toolById } from "@/tools/registry"

export const SECTION_ICONS = { images: ImageIcon, video: Film, audio: AudioLines, gif: Repeat }

/** The Formats wiki's front page: a tab per section, each listing its formats. */
export function FormatsPage() {
  const { section = "images" } = useSearch({ from: "/formats/" })
  const navigate = useNavigate()
  const current = GUIDE.find((s) => s.id === section) ?? GUIDE[0]

  return (
    <Page>
      <PageHeader
        title="Formats"
        description="A guide to every format Pyx works with: what it is, where it came from, and when to use it."
      />
      <GradientButtonGroup<GuideSectionId>
        aria-label="Section"
        value={current.id}
        onChange={(id) => navigate({ to: "/formats", search: { section: id }, replace: true })}
        items={GUIDE.map((s) => {
          const Icon = SECTION_ICONS[s.id]
          return { id: s.id, label: s.label, icon: <Icon /> }
        })}
      />
      <Section key={current.id} section={current} />
    </Page>
  )
}

function Section({ section }: { section: GuideSection }) {
  const articles = articlesIn(section.id)
  const groups =
    section.id === "video"
      ? [
          { title: "Codecs", items: articles.filter((a) => a.group === "codec") },
          { title: "Containers", items: articles.filter((a) => a.group === "container") },
        ]
      : [{ title: "Formats", items: articles }]

  return (
    <div className="space-y-8">
      <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">{section.intro}</p>

      {groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <SectionTitle>{g.title}</SectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {g.items.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <SectionTitle>Quick pick</SectionTitle>
        {/* Cards share the row evenly, however many picks a section has. */}
        <div className="flex flex-wrap gap-3">
          {section.picks.map((p) => (
            <div key={p.use} className="bg-card min-w-44 flex-1 rounded-xl border px-4 py-3">
              <p className="text-muted-foreground text-xs">{p.use}</p>
              <p className="mt-1 text-base font-semibold tracking-tight">{p.pick}</p>
            </div>
          ))}
        </div>
      </section>

      {section.tips && (
        <section className="space-y-3">
          <SectionTitle>Making good GIFs</SectionTitle>
          <ul className="bg-card divide-y rounded-xl border">
            {section.tips.map((tip, i) => (
              <li key={tip} className="flex items-baseline gap-3 px-4 py-3 text-sm">
                <span className="text-muted-foreground w-4 shrink-0 text-xs tabular-nums">{i + 1}</span>
                {tip}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ToolLinks toolIds={section.toolIds} />
    </div>
  )
}

export function ArticleCard({ article }: { article: FormatArticle }) {
  return (
    <Link
      to="/formats/$formatId"
      params={{ formatId: article.id }}
      className="group bg-card hover:border-foreground/20 focus-visible:ring-ring/50 flex flex-col gap-2 rounded-xl border p-4 transition-colors outline-none focus-visible:ring-2"
    >
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold tracking-tight">{article.name}</span>
        {chipFor(article) && <ExtChip>{chipFor(article)!}</ExtChip>}
        <ArrowRight className="text-muted-foreground ml-auto size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{article.tagline}</p>
    </Link>
  )
}

export function ToolLinks({ toolIds, label = "Related tools" }: { toolIds: string[]; label?: string }) {
  return (
    <section className="flex flex-wrap items-center gap-2 border-t pt-6">
      <span className="text-muted-foreground mr-1 text-sm">{label}</span>
      {toolIds.map((id) => {
        const tool = toolById(id)
        if (!tool) return null
        return (
          <Button key={id} variant="outline" size="sm" asChild>
            <Link to="/tools/$toolId" params={{ toolId: id }}>
              <tool.icon />
              {tool.name}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        )
      })}
    </section>
  )
}
