import { cn } from "@/lib/utils"

// Geometry from docs/brand/marks.py (256 grid). The small cut has heavier strokes and a
// simpler star, for anything drawn under ~32px.
const MARK = {
  regular: {
    body: "M66 36H152A46 46 0 0 1 198 82V108A46 46 0 0 1 152 154H98V214A6 6 0 0 1 92 220H72A6 6 0 0 1 66 214V42A6 6 0 0 1 72 36ZM98 68H152A14 14 0 0 1 166 82V108A14 14 0 0 1 152 122H98Z",
    star: "M132 77Q136.5 90.5 150 95Q136.5 99.5 132 113Q127.5 99.5 114 95Q127.5 90.5 132 77Z",
  },
  small: {
    body: "M54 26H150A54 54 0 0 1 204 80V110A54 54 0 0 1 150 164H96V222A8 8 0 0 1 88 230H62A8 8 0 0 1 54 222V34A8 8 0 0 1 62 26Z M96 66H148A16 16 0 0 1 164 82V108A16 16 0 0 1 148 124H96Z",
    star: "M130 75L150 95L130 115L110 95Z",
  },
}

/** The Pyx mark: a P whose bowl holds a star. The P takes the text colour, the star the accent. */
export function PyxMark({ small = false, className }: { small?: boolean; className?: string }) {
  const { body, star } = small ? MARK.small : MARK.regular
  return (
    <svg viewBox="0 0 256 256" aria-hidden className={cn("shrink-0", className)}>
      <path fill="currentColor" fillRule="evenodd" d={body} />
      <path fill="var(--viz-1)" d={star} />
    </svg>
  )
}
