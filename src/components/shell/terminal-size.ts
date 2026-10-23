import { useApp } from "@/store"

// Kept apart from terminal-dock.tsx: a file that exports components and a hook
// together can't be hot-reloaded, which left the app on stale terminal code.

/** Default panel height, until you drag its top edge to change it. */
export const DEFAULT_TERMINAL_HEIGHT = 300
export const MIN_TERMINAL_HEIGHT = 160

/**
 * The terminal's height as CSS: your saved height, or the default, never more
 * than three quarters of the window. The page uses it too, to leave room below.
 */
export function useTerminalHeight() {
  const saved = useApp((s) => s.settings.terminalHeight)
  return `min(${saved ?? DEFAULT_TERMINAL_HEIGHT}px, ${saved ? 75 : 45}vh)`
}
