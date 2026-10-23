import { useEffect, useState } from "react"
import { getCurrentWebview } from "@tauri-apps/api/webview"

/** Listens for files dragged onto the window while mounted; returns whether a drag is hovering. */
export function useWindowDrop(onDrop: (paths: string[]) => void) {
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === "enter" || payload.type === "over") setHovering(true)
      else if (payload.type === "leave") setHovering(false)
      else if (payload.type === "drop") {
        setHovering(false)
        onDrop(payload.paths)
      }
    })
    return () => {
      void unlisten.then((fn) => fn())
    }
  }, [onDrop])

  return hovering
}
