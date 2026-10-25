import type { ReactNode } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight, Check, ChevronRight, Minus } from "lucide-react"

import { Cell, ExtChip, MarkCell } from "@/components/formats/ratings"
import { Page } from "@/components/page"
import { Button } from "@/components/ui/button"
import { GUIDE, type Mark } from "@/lib/format-guide"
import { articleById, articlesIn, chipFor, comparisonFor, type FormatArticle } from "@/lib/format-wiki"
import { ArticleCard, SECTION_ICONS } from "@/pages/formats"
import { toolById } from "@/tools/registry"

const PLATFORMS: { key: keyof FormatArticle["support"]; label: string }[] = [
  { key: "mac", label: "macOS" },
  { key: "ios", label: "iPhone & iPad" },
  { key: "windows", label: "Windows" },
  { key: "android", label: "Android" },
  { key: "web", label: "Web browsers" },
]

/**
 * A format's wiki article. Every format uses this same layout: overview, when to use it,
 * how it works, history, who uses it, tips and related formats, with a facts box beside it.
 */
export function FormatArticlePage() {
  const { formatId } = useParams({ from: "/formats/$formatId" })
  const article = articleById(formatId)

  if (!article) {
    return (
      <Page>
        <p className="text-muted-foreground text-sm">
          There's no article for “{formatId}”.{" "}
          <Link to="/formats" className="text-foreground underline">
            Back to Formats
          </Link>
        </p>
      </Page>
    )
  }

  const section = GUIDE.find((s) => s.id === article.section)!
  const SectionIcon = SECTION_ICONS[section.id]
  const tool = article.toolId ? toolById(article.toolId) : undefined
  const siblings = articlesIn(article.section)
  const index = siblings.findIndex((a) => a.id === article.id)
  const prev = siblings[index - 1]
  const next = siblings[index + 1]

  return (
    <Page className="max-w-5xl">
      <nav aria-label="Breadcrumb" className="text-muted-foreground flex items-center gap-1 text-xs">
        <Link to="/formats" className="hover:text-foreground">
          Formats
        </Link>
        <ChevronRight className="size-3" />
        <Link to="/formats" search={{ section: section.id }} className="hover:text-foreground">
          {section.label}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{article.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <SectionIcon className="size-3.5" />
            {article.facts.type}
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">{article.name}</h2>
          <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">{article.tagline}</p>
        </div>
        {tool && (
          <Button asChild>
            <Link to="/tools/$toolId" params={{ toolId: tool.id }}>
              <tool.icon />
              Open {tool.name}
            </Link>
          </Button>
        )}
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <article className="min-w-0 space-y-10">
          <ArticleSection title="Overview">
            <div className="space-y-3 text-[15px] leading-relaxed">
              {article.overview.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </ArticleSection>

          <ArticleSection title="When to use it">
            <div className="grid gap-3 sm:grid-cols-2">
              <Checklist title="Use it for" items={article.useWhen} kind="yes" />
              <Checklist title="Avoid it for" items={article.avoidWhen} kind="no" />
            </div>
          </ArticleSection>

          <ArticleSection title="How it works">
            <ol className="space-y-3">
              {article.howItWorks.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed">
                  <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </ArticleSection>

          <ArticleSection title="History">
            <ol className="relative space-y-4">
              {/* The timeline's spine, running through the dots. */}
              <span aria-hidden className="bg-border absolute top-2 bottom-2 left-[4.25rem] w-px" />
              {article.history.map((h) => (
                <li key={h.year + h.text} className="relative grid grid-cols-[3.5rem_1.5rem_1fr] items-baseline text-sm">
                  <span className="text-muted-foreground text-right text-xs font-medium tabular-nums">{h.year}</span>
                  <span className="flex justify-center">
                    <span className="bg-background border-foreground/40 relative top-0.5 size-2.5 rounded-full border-2" />
                  </span>
                  <span className="leading-relaxed">{h.text}</span>
                </li>
              ))}
            </ol>
          </ArticleSection>

          <ArticleSection title="Who uses it">
            <ul className="space-y-2 text-sm leading-relaxed">
              {article.whoUses.map((w) => (
                <li key={w} className="flex gap-2.5">
                  <span className="bg-foreground/40 mt-2 size-1.5 shrink-0 rounded-full" />
                  {w}
                </li>
              ))}
            </ul>
          </ArticleSection>

          <ArticleSection title="Tips">
            <ul className="bg-muted/40 divide-border/60 divide-y rounded-xl border">
              {article.tips.map((t) => (
                <li key={t} className="px-4 py-3 text-sm leading-relaxed">
                  {t}
                </li>
              ))}
            </ul>
          </ArticleSection>

          <ArticleSection title="Related formats">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {article.related
                .map((id) => articleById(id))
                .filter((a): a is FormatArticle => !!a)
                .map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
            </div>
          </ArticleSection>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Facts article={article} />
          <AtAGlance article={article} />
          <Support support={article.support} />
        </aside>
      </div>

      <nav aria-label={`More ${section.label.toLowerCase()} formats`} className="grid gap-3 border-t pt-6 sm:grid-cols-2">
        {prev ? <Neighbour article={prev} direction="prev" /> : <span />}
        {next && <Neighbour article={next} direction="next" />}
      </nav>
    </Page>
  )
}

function ArticleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {children}
    </section>
  )
}

function Checklist({ title, items, kind }: { title: string; items: string[]; kind: "yes" | "no" }) {
  return (
    <div className="bg-card space-y-3 rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium">{title}</p>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
            {kind === "yes" ? (
              <span className="bg-foreground/90 text-background mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full">
                <Check className="size-2.5" strokeWidth={3.5} />
              </span>
            ) : (
              <span className="text-muted-foreground mt-0.5 flex size-4 shrink-0 items-center justify-center">
                <Minus className="size-3.5" />
              </span>
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The infobox: the same facts, in the same order, for every format. */
function Facts({ article }: { article: FormatArticle }) {
  const f = article.facts
  const rows: [string, ReactNode][] = [
    ["Full name", f.fullName],
    ["Type", f.type],
    ["Created by", f.createdBy],
    ["Released", f.released],
    ["Compression", f.compression],
    ["Licence", f.licence],
    [
      article.group === "codec" ? "Found in" : "Extensions",
      <span className="flex flex-wrap gap-1">
        {f.extensions.map((e) => (
          <ExtChip key={e}>{e}</ExtChip>
        ))}
      </span>,
    ],
  ]
  if (f.mime) rows.push(["MIME type", <span className="font-mono text-xs">{f.mime}</span>])

  return (
    <Box title={article.name} subtitle={chipFor(article)}>
      <dl className="divide-y">
        {rows.map(([label, value]) => (
          <div key={label} className="space-y-0.5 px-3.5 py-2.5">
            <dt className="text-muted-foreground text-[11px] font-medium">{label}</dt>
            <dd className="text-sm leading-snug">{value}</dd>
          </div>
        ))}
      </dl>
    </Box>
  )
}

/** Its ratings and features from the section's comparison table. */
function AtAGlance({ article }: { article: FormatArticle }) {
  const found = comparisonFor(article)
  if (!found) return null
  const { table, row } = found
  return (
    <Box title="At a glance">
      <dl className="divide-y">
        {table.columns.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3 px-3.5 py-2">
            <dt className="text-muted-foreground text-xs">{c.label}</dt>
            <dd className="shrink-0">
              <Cell column={c} value={row.values[c.key]} />
            </dd>
          </div>
        ))}
      </dl>
    </Box>
  )
}

function Support({ support }: { support: FormatArticle["support"] }) {
  return (
    <Box title="Opens on">
      <dl className="divide-y">
        {PLATFORMS.map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-3 px-3.5 py-2">
            <dt className="text-muted-foreground text-xs">{p.label}</dt>
            <dd className="shrink-0">
              <MarkCell value={support[p.key] as Mark} />
            </dd>
          </div>
        ))}
      </dl>
    </Box>
  )
}

function Box({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="bg-muted/40 flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
        <span className="text-sm font-semibold tracking-tight">{title}</span>
        {subtitle && <ExtChip>{subtitle}</ExtChip>}
      </div>
      {children}
    </div>
  )
}

function Neighbour({ article, direction }: { article: FormatArticle; direction: "prev" | "next" }) {
  const Arrow = direction === "prev" ? ArrowLeft : ArrowRight
  return (
    <Link
      to="/formats/$formatId"
      params={{ formatId: article.id }}
      className={
        "group bg-card hover:border-foreground/20 flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors " +
        (direction === "next" ? "sm:col-start-2 sm:flex-row-reverse sm:text-right" : "")
      }
    >
      <Arrow className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{direction === "prev" ? "Previous" : "Next"}</p>
        <p className="truncate font-medium">{article.name}</p>
      </div>
    </Link>
  )
}
