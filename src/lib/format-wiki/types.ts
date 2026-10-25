import type { GuideSectionId, Mark } from "@/lib/format-guide"

/**
 * One wiki article per format. Every article has the same parts, so every format page
 * reads the same way: what it is, when to use it, how it works, its history, who uses
 * it, where it opens, and tips.
 */
export interface FormatArticle {
  /** Matches the format's row id in the comparison tables (format-guide.ts). */
  id: string
  section: GuideSectionId
  /** Video formats are either codecs or containers. */
  group?: "codec" | "container"
  name: string
  /** One line under the title. */
  tagline: string
  facts: {
    fullName: string
    /** e.g. "Image format", "Video codec". */
    type: string
    createdBy: string
    released: string
    compression: "Lossy" | "Lossless" | "Lossy or lossless" | "Uncompressed" | "Depends on the codec inside"
    licence: string
    extensions: string[]
    mime?: string
  }
  /** Plain-language introduction, a paragraph per entry. */
  overview: string[]
  useWhen: string[]
  avoidWhen: string[]
  /** The main ideas behind it, in order. */
  howItWorks: string[]
  history: { year: string; text: string }[]
  whoUses: string[]
  /** Where it opens without extra software. A string is a "partly" with a short reason. */
  support: { mac: Mark; ios: Mark; windows: Mark; android: Mark; web: Mark }
  tips: string[]
  /** Other article ids worth reading next. */
  related: string[]
  /** The Pyx tool that makes this format, if any. */
  toolId?: string
}
