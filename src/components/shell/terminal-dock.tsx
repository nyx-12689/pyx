import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useLocation } from "@tanstack/react-router"
import { SquareTerminal } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useShallow } from "zustand/react/shallow"

import { TerminalPanel } from "@/components/shell/terminal-panel"
import { MIN_TERMINAL_HEIGHT, useTerminalHeight } from "@/components/shell/terminal-size"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { isActive, useApp } from "@/store"

const GAP = 12

/** A grip along the top edge; dragging it sets (and remembers) the height. */
function ResizeHandle({ panel }: { panel: React.RefObject<HTMLDivElement | null> }) {
  const updateSettings = useApp((s) => s.updateSettings)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = panel.current
    if (!el) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    const startY = e.clientY
    const startHeight = el.getBoundingClientRect().height
    const clamp = (h: number) => Math.round(Math.min(window.innerHeight * 0.75, Math.max(MIN_TERMINAL_HEIGHT, h)))
    // While dragging, size the element directly; save once at the end.
    const onMove = (ev: PointerEvent) => {
      el.style.height = `${clamp(startHeight + startY - ev.clientY)}px`
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      setDragging(false)
      updateSettings({ terminalHeight: clamp(startHeight + startY - ev.clientY) })
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize terminal"
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={() => {
        if (panel.current) panel.current.style.height = ""
        updateSettings({ terminalHeight: null })
      }}
      className="group/resize absolute inset-x-0 top-0 z-10 flex h-3 cursor-row-resize touch-none justify-center"
    >
      {/* Always faintly there, so you can see the edge can be dragged. */}
      <span
        className={cn(
          "mt-1 h-1 w-9 rounded-full bg-white/15 transition-colors group-hover/resize:bg-white/40",
          dragging && "bg-white/60",
        )}
      />
    </div>
  )
}
/** The round terminal button in the bottom-right corner. */
const BUTTON_SIZE = 44

/**
 * Where the terminal sits: over the element marked `data-terminal-area` when a
 * page has one (a tool's file list, so its options and Run button stay
 * uncovered), otherwise across the main area.
 */
function useDockBox(open: boolean) {
  const { pathname } = useLocation()
  const [box, setBox] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const inset = document.querySelector<HTMLElement>("[data-slot=sidebar-inset]")
    if (!inset) return
    const observer = new ResizeObserver(() => measure())
    let area: HTMLElement | null = null

    const measure = () => {
      const r = (area ?? inset).getBoundingClientRect()
      // Across the main area, stopping short of the terminal button in the corner.
      const next = area
        ? { left: Math.round(r.left), width: Math.round(r.width) }
        : { left: Math.round(r.left + GAP), width: Math.round(r.width - GAP * 3 - BUTTON_SIZE) }
      setBox((prev) => (prev && prev.left === next.left && prev.width === next.width ? prev : next))
    }
    // The router can swap the page in a render after the URL changes, so watch
    // for the tool's file column appearing or going away instead of looking once.
    const sync = () => {
      const found = document.querySelector<HTMLElement>("[data-terminal-area]")
      if (found !== area) {
        if (area) observer.unobserve(area)
        area = found
        if (area) observer.observe(area)
      }
      measure()
    }
    sync()
    observer.observe(inset)
    // Pages change their DOM constantly (timers, charts); check at most once a frame.
    let frame = 0
    const pages = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), sync()))
    })
    pages.observe(inset, { childList: true, subtree: true })
    window.addEventListener("resize", measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      pages.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [open, pathname])

  return box
}

/** The terminal, docked to the bottom of the window over the page. */
export function TerminalDock() {
  const open = useApp((s) => s.terminal.open)
  const setTerminal = useApp((s) => s.setTerminal)
  const box = useDockBox(open)
  const panel = useRef<HTMLDivElement>(null)
  const height = useTerminalHeight()
  const closesOnOutsideClick = useApp((s) => s.settings.terminalClosesOnOutsideClick)

  // A click anywhere outside hides it, like a popover (unless turned off in
  // Settings). The terminal button toggles it itself, and dialogs or menus
  // opened from inside don't count.
  useEffect(() => {
    if (!open || !closesOnOutsideClick) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (!target || panel.current?.contains(target)) return
      if (target.closest("[data-terminal-button], [role=dialog], [role=menu], [data-radix-popper-content-wrapper], [data-sonner-toaster]")) return
      setTerminal({ open: false })
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open, closesOnOutsideClick, setTerminal])

  // Esc hides it, unless a dialog or menu is open and should take the key.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (document.querySelector("[role=dialog], [role=menu], [role=listbox]")) return
      setTerminal({ open: false })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, setTerminal])

  return (
    <AnimatePresence>
      {open && box && (
        <motion.div
          key="terminal"
          ref={panel}
          role="region"
          aria-label="Terminal"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
          className="fixed z-40 overflow-hidden rounded-xl border border-white/10 shadow-2xl"
          // Glides to its new size when the page under it changes (a tool's narrower column, say).
          style={{ left: box.left, width: box.width, bottom: GAP, height, transition: "left 250ms ease, width 250ms ease" }}
        >
          <ResizeHandle panel={panel} />
          <TerminalPanel />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Progress ring geometry, inside the button's 44px box. */
const RING_R = 20
const RING_C = 2 * Math.PI * RING_R
/** The ring shows for at least this long, so sub-second jobs still register. */
const RING_MIN_MS = 700
/** How long the finished (full) ring stays before fading out. */
const RING_DONE_MS = 1100

type Ring =
  | { kind: "hidden" }
  | { kind: "running"; progress: number | null }
  | { kind: "done"; failed: boolean }

/**
 * What the button's ring shows. Like the file rows' bars, the numbers are real;
 * only the timing is stretched: the ring stays up briefly even for jobs that
 * finish in a blink, and ends on a full ring (red if anything failed).
 */
function useRing(): { ring: Ring; count: number } {
  const active = useApp(useShallow((s) => s.jobOrder.map((id) => s.jobs[id]).filter(isActive)))
  const [done, setDone] = useState<{ failed: boolean } | null>(null)
  const startedAt = useRef<number | null>(null)
  const watched = useRef(new Set<string>())

  const busy = active.length > 0
  useEffect(() => {
    if (busy) {
      startedAt.current ??= Date.now()
      for (const job of active) watched.current.add(job.id)
      setDone(null)
      return
    }
    if (startedAt.current === null) return
    // Everything finished: show the outcome, then let the ring go.
    const jobs = useApp.getState().jobs
    const failed = [...watched.current].some((id) => jobs[id]?.status === "error")
    const wait = Math.max(0, RING_MIN_MS - (Date.now() - startedAt.current))
    startedAt.current = null
    watched.current = new Set()
    setDone({ failed })
    const timer = setTimeout(() => setDone(null), wait + RING_DONE_MS)
    return () => clearTimeout(timer)
  }, [busy, active])

  if (busy) {
    const withProgress = active.filter((j) => j.progress !== null)
    const progress = withProgress.length
      ? withProgress.reduce((n, j) => n + (j.progress ?? 0), 0) / withProgress.length
      : null
    return { ring: { kind: "running", progress }, count: active.length }
  }
  if (done) return { ring: { kind: "done", failed: done.failed }, count: 0 }
  return { ring: { kind: "hidden" }, count: 0 }
}

/**
 * The always-there terminal button, bottom right. While jobs run, a ring
 * around it fills with their overall progress (or spins when the tools report
 * none) and a badge counts them.
 */
export function TerminalButton() {
  const open = useApp((s) => s.terminal.open)
  const setTerminal = useApp((s) => s.setTerminal)
  const { ring, count } = useRing()

  // Plain SVG with CSS transitions: WebKit (the app's engine) is the target.
  const spinning = ring.kind === "running" && ring.progress === null
  // Hidden stays full, so the finished ring fades out whole instead of emptying.
  const fill = ring.kind === "running" ? (ring.progress ?? 0.25) : 1
  // Hidden keeps the last colour too, for the same reason.
  const lastColor = useRef("#38bdf8")
  if (ring.kind === "done") lastColor.current = ring.failed ? "#f87171" : "#34d399"
  if (ring.kind === "running") lastColor.current = "#38bdf8"
  const color = lastColor.current

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          type="button"
          data-terminal-button
          aria-label={open ? "Hide terminal" : "Show terminal"}
          aria-pressed={open}
          onClick={() => setTerminal({ open: !open })}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className={cn(
            "fixed z-50 flex items-center justify-center rounded-full border border-white/10 bg-neutral-950 text-neutral-200 shadow-xl shadow-black/25 transition-colors hover:text-white",
            open && "ring-2 ring-white/20",
          )}
          style={{ right: GAP + 4, bottom: GAP + 4, width: BUTTON_SIZE, height: BUTTON_SIZE }}
        >
          <SquareTerminal className="size-5" />
          <svg
            aria-hidden
            viewBox="0 0 44 44"
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity duration-300",
              ring.kind === "hidden" ? "opacity-0" : "opacity-100",
              spinning ? "animate-spin" : "-rotate-90",
            )}
            style={spinning ? { animationDuration: "1.1s" } : undefined}
          >
            <circle cx="22" cy="22" r={RING_R} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="2.5" />
            <circle
              cx="22"
              cy="22"
              r={RING_R}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - fill)}
              style={{ transition: "stroke-dashoffset 300ms ease-out, stroke 300ms" }}
            />
          </svg>
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white tabular-nums">
              {count}
            </span>
          )}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="left">{count > 0 ? `${count} running` : "Terminal"} · ⌘J</TooltipContent>
    </Tooltip>
  )
}
