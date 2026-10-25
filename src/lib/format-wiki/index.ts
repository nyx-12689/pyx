import { GUIDE } from "@/lib/format-guide"

import { AUDIO_ARTICLES } from "./audio"
import { GIF_ARTICLES } from "./gif"
import { IMAGE_ARTICLES } from "./images"
import type { FormatArticle } from "./types"
import { VIDEO_ARTICLES } from "./video"

export type { FormatArticle } from "./types"

export const ARTICLES: FormatArticle[] = [...IMAGE_ARTICLES, ...VIDEO_ARTICLES, ...AUDIO_ARTICLES, ...GIF_ARTICLES]

export const articleById = (id: string) => ARTICLES.find((a) => a.id === id)

/** Articles in a section, in reading order (video: codecs, then containers). */
export const articlesIn = (section: FormatArticle["section"]) => ARTICLES.filter((a) => a.section === section)

/** The article's row in its section's comparison tables, with its ratings and marks. */
export function comparisonFor(article: FormatArticle) {
  const section = GUIDE.find((s) => s.id === article.section)
  for (const table of section?.tables ?? []) {
    const row = table.rows.find((r) => r.id === article.id)
    if (row) return { table, row }
  }
  return undefined
}

/**
 * The short label shown beside a format's name: its extension, or for codecs, its other
 * name (none when that's the same as the name, like VP9).
 */
export function chipFor(article: FormatArticle): string | undefined {
  if (article.group !== "codec") return article.facts.extensions[0]
  const other = comparisonFor(article)?.row.ext
  return other && other !== article.name ? other : undefined
}
