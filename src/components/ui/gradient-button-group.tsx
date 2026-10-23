import { useEffect, useId, useState } from "react"
import { animate, useMotionValue } from "motion/react"
import * as motion from "motion/react-client"

import { useResolvedTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

// Theme-aware color configurations
const themes = {
  dark: {
    bg: "#111113",
    containerBg: "#141416",
    underLayerBg: "#101012",
    borderFrom: "#0a0a0b",
    borderVia: "#1a1a1c",
    borderTo: "#252527",
    wellBg: "#0a0a0b",
    innerRingBg: "#0c0c0d",
    buttonBg: "#111113",
    textActive: "text-white",
    textInactive: "text-[#6b6b6d] hover:text-zinc-400",
    iconColor: "text-white hover:text-zinc-300",
  },
  light: {
    bg: "#f5f5f7",
    containerBg: "#ffffff",
    underLayerBg: "#e8e8ea",
    borderFrom: "#d0d0d5",
    borderVia: "#e5e5e8",
    borderTo: "#f0f0f2",
    wellBg: "#e0e0e3",
    innerRingBg: "#d8d8db",
    buttonBg: "#f0f0f2",
    textActive: "text-zinc-900",
    textInactive: "text-zinc-400 hover:text-zinc-600",
    iconColor: "text-zinc-700 hover:text-zinc-900",
  },
}

export interface GradientButtonGroupItem<T extends string = string> {
  id: T
  icon: React.ReactNode
  label: string
}

function InnerButtonOverlay({
  isOverlayActive,
  isDarkMode,
}: {
  isOverlayActive: boolean
  isDarkMode: boolean
}) {
  const overlayProgress = useMotionValue(isOverlayActive ? 1 : 0)

  useEffect(() => {
    const controls = animate(overlayProgress, isOverlayActive ? 1 : 0, {
      delay: isOverlayActive ? 0.02 : 0,
      duration: isOverlayActive ? 0.18 : 0.14,
      ease: "easeOut",
    })

    return () => controls.stop()
  }, [isOverlayActive, overlayProgress])

  return (
    <motion.span
      initial={false}
      className="absolute inset-0 rounded-[10px]"
      animate={
        isOverlayActive
          ? {
              borderWidth: 1,
              borderColor: isDarkMode
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.08)",
            }
          : {
              borderWidth: 0,
              borderColor: "transparent",
              boxShadow: "none",
            }
      }
      transition={{
        borderColor: {
          duration: 0.16,
          ease: "easeOut",
        },
      }}
      style={{
        borderStyle: "solid",
      }}
    />
  )
}

export interface GradientButtonGroupProps<T extends string> {
  items: GradientButtonGroupItem<T>[]
  value: T
  onChange: (value: T) => void
  /** "md" is the original 76px button; "sm" is 60px. */
  size?: "sm" | "md"
  /** Show each item's label under its icon. */
  showLabels?: boolean
  className?: string
  "aria-label"?: string
}

export function GradientButtonGroup<T extends string>({
  items,
  value,
  onChange,
  size = "md",
  showLabels = true,
  className,
  "aria-label": ariaLabel,
}: GradientButtonGroupProps<T>) {
  const [overlayReadyId, setOverlayReadyId] = useState<string | null>(value)
  // Unique per instance, so two groups on one page don't animate into each other.
  const layoutPrefix = useId()
  const isDarkMode = useResolvedTheme() === "dark"
  const theme = isDarkMode ? themes.dark : themes.light

  return (
    <div className={cn("inline-flex", className)}>
      <div className="relative inline-flex items-center">
        {/* Background tray layer (recessed) */}
        <div
          className="absolute inset-0 z-0 rounded-[28px] transition-colors duration-300"
          style={{
            background: isDarkMode
              ? "linear-gradient(180deg, #141416 0%, #111113 50%, #0e0e10 100%)"
              : "linear-gradient(180deg, #d1d1d6 0%, #cacad0 50%, #c3c3c9 100%)",
            boxShadow: isDarkMode
              ? "inset 0 2px 8px rgba(0,0,0,0.6), inset 0 1px 2px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04)"
              : "inset 0 2px 6px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.55)",
          }}
        />

        {/* Foreground nav layer (raised) */}
        <div className="relative z-10 flex">
          {/* Outer rim/bezel */}
          <div
            className="bg-muted dark:bg-background absolute -inset-[4px] rounded-[28px] border-[1px] transition-colors duration-300"
            style={{ borderColor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)" }}
          />

          {/* Inner container */}
          <div
            role="radiogroup"
            aria-label={ariaLabel}
            className="relative inline-flex items-center gap-2 rounded-[24px] p-1.5 transition-colors duration-300"
            style={{
              background: isDarkMode
                ? "linear-gradient(180deg, #1c1c1f 0%, #17171a 52%, #131316 100%)"
                : "linear-gradient(180deg, #ffffff 0%, #fefeff 52%, #fcfcfe 100%)",
              borderTop: isDarkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,1)",
              boxShadow: isDarkMode ? "none" : "0 1px 2px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,1)",
            }}
          >
            {items.map((item) => {
              const isActive = value === item.id
              const isOverlayActive = isActive && overlayReadyId === item.id

              const wellStyle = isDarkMode
                ? {
                    background: "linear-gradient(180deg, #0a0a0c 0%, #0e0e10 50%, #0c0c0e 100%)",
                    boxShadow:
                      "inset 0 2px 6px rgba(0,0,0,0.9), inset 0 0 4px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05)",
                  }
                : {
                    boxShadow:
                      "inset 0 2px 6px rgba(0,0,0,0.12), inset 0 0 4px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.9)",
                  }

              const innerGapStyle = isDarkMode
                ? { background: "#0a0a0d", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.9), inset 0 0 2px rgba(0,0,0,0.6)" }
                : { boxShadow: "inset 0 1px 3px rgba(0,0,0,0.18), inset 0 0 2px rgba(0,0,0,0.1)" }

              const spring = { type: "spring" as const, stiffness: 400, damping: 30 }

              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => {
                    if (isActive) return
                    setOverlayReadyId(null)
                    onChange(item.id)
                  }}
                  className={cn(
                    "group/nav relative flex items-center justify-center rounded-[18px] transition-all duration-300",
                    size === "md" ? "h-[76px] w-[76px]" : "h-[60px] w-[60px]",
                    isActive ? theme.textActive : theme.textInactive
                  )}
                >
                  {isActive && (
                    <>
                      {/* Inset well/channel - creates the recessed groove */}
                      <motion.span
                        layoutId={`${layoutPrefix}-well`}
                        className="bg-muted absolute inset-0 rounded-[18px] transition-colors duration-300"
                        style={wellStyle}
                        transition={spring}
                      />
                      {/* Gradient ring container */}
                      <motion.span
                        layoutId={`${layoutPrefix}-ring`}
                        className="absolute inset-[3px] overflow-hidden rounded-[15px]"
                        onLayoutAnimationComplete={() => setOverlayReadyId(item.id)}
                        transition={spring}
                      >
                        <span
                          className="animate-gold-spin absolute inset-[-60%] origin-center will-change-transform"
                          style={{
                            background:
                              "conic-gradient(from 220deg, #6FF7CC 0%, #44EBCF 16%, #ADFA1F 33%, #C8FF5A 50%, #89F5A0 66%, #37D8C5 82%, #6FF7CC 100%)",
                          }}
                        />
                      </motion.span>
                      {/* Inner gap - thin dark channel between the ring and the button */}
                      <motion.span
                        layoutId={`${layoutPrefix}-inner`}
                        className="bg-muted absolute inset-[6px] rounded-[12px] transition-colors duration-300"
                        style={innerGapStyle}
                        transition={spring}
                      />
                    </>
                  )}

                  {/* Inner button background */}
                  <motion.span
                    initial={false}
                    className={cn(
                      "relative z-10 flex flex-col items-center justify-center gap-1 rounded-[10px]",
                      isActive ? "h-[calc(100%-18px)] w-[calc(100%-18px)]" : "h-full w-full"
                    )}
                    animate={isActive ? { scale: 1, opacity: 1 } : { scale: 0.985, opacity: 0.96 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30, delay: isActive ? 0.12 : 0 }}
                  >
                    <InnerButtonOverlay isOverlayActive={isOverlayActive} isDarkMode={isDarkMode} />
                    <span className="relative z-10 [&_svg]:size-5">{item.icon}</span>
                    {showLabels && (
                      <span className="relative z-10 max-w-full truncate px-1 text-[10px] leading-none font-medium">
                        {item.label}
                      </span>
                    )}
                  </motion.span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
