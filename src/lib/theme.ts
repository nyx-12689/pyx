import { useSyncExternalStore } from "react"

import { useApp } from "@/store"

const query = typeof window === "undefined" ? null : window.matchMedia("(prefers-color-scheme: dark)")

const subscribe = (onChange: () => void) => {
  query?.addEventListener("change", onChange)
  return () => query?.removeEventListener("change", onChange)
}

/** "dark" or "light", from the Theme setting (following macOS when it's "system"). */
export function useResolvedTheme(): "dark" | "light" {
  const theme = useApp((s) => s.settings.theme)
  const systemDark = useSyncExternalStore(subscribe, () => query?.matches ?? false)
  if (theme === "system") return systemDark ? "dark" : "light"
  return theme
}
