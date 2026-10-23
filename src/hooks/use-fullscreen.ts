import { useEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"

/**
 * Whether the window is in macOS full screen. The traffic lights leave the
 * window then (macOS shows them in the bar that slides down from the top edge),
 * so the title bar stops reserving room for them.
 */
export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    let win: ReturnType<typeof getCurrentWindow>
    try {
      win = getCurrentWindow()
    } catch {
      return // Plain browser during development: never full screen.
    }
    let alive = true
    const check = () => void win.isFullscreen().then((fs) => alive && setFullscreen(fs), () => {})
    check()
    // Entering or leaving full screen resizes the window.
    const unlisten = win.onResized(check)
    return () => {
      alive = false
      void unlisten.then((fn) => fn())
    }
  }, [])

  return fullscreen
}
