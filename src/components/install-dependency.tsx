import { openUrl } from "@tauri-apps/plugin-opener"
import { PackageX, TriangleAlert } from "lucide-react"

import { CopyButton } from "@/components/ui/copy-button"
import { HaloButton } from "@/components/ui/halo-button"
import NeumorphButton from "@/components/ui/neumorph-button"
import type { DependencyName } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useApp } from "@/store"

/** The Homebrew formula behind each program; ffprobe ships inside ffmpeg. */
export const FORMULA: Record<DependencyName, string> = { ffmpeg: "ffmpeg", ffprobe: "ffmpeg", magick: "imagemagick" }
const LABEL: Record<DependencyName, string> = { ffmpeg: "ffmpeg", ffprobe: "ffmpeg", magick: "ImageMagick" }

/** Homebrew's own installer. It asks for your password, so it has to run in Terminal. */
const BREW_INSTALL = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'

/** Whether an install of `formula` is running, and whether the latest one failed. */
export function useInstallStatus(formula: string) {
  return useApp((s) => {
    const latest = [...s.jobOrder]
      .reverse()
      .map((id) => s.jobs[id])
      .find((j) => j.kind === "install" && j.subject === formula)
    return latest?.status ?? null
  })
}

/** "Install ImageMagick" through Homebrew, or a way to get Homebrew first. */
export function InstallDependencyButton({ name, className }: { name: DependencyName; className?: string }) {
  const hasBrew = useApp((s) => (s.deps ? !!s.deps.brewPath : null))
  const installDependency = useApp((s) => s.installDependency)
  const status = useInstallStatus(FORMULA[name])
  const installing = status === "queued" || status === "running"

  if (hasBrew === null) return null
  if (!hasBrew) {
    return (
      <NeumorphButton size="small" className={className} onClick={() => void openUrl("https://brew.sh")}>
        Get Homebrew
      </NeumorphButton>
    )
  }
  return (
    <HaloButton
      className={className}
      isLoading={installing}
      loadingText="Installing…"
      onClick={() => void installDependency(FORMULA[name], false)}
    >
      {status === "error" ? `Retry installing ${LABEL[name]}` : `Install ${LABEL[name]}`}
    </HaloButton>
  )
}

/** Explains what's missing on a tool's page and installs it in place. */
export function MissingDependencyNotice({
  name,
  toolName,
  className,
}: {
  name: DependencyName
  toolName: string
  className?: string
}) {
  const hasBrew = useApp((s) => (s.deps ? !!s.deps.brewPath : null))
  const refreshDeps = useApp((s) => s.refreshDeps)
  const status = useInstallStatus(FORMULA[name])
  if (hasBrew === null) return null

  return (
    <div className={cn("border-destructive/30 bg-destructive/5 space-y-3 rounded-xl border p-3", className)}>
      <div className="flex gap-2.5">
        <PackageX className="text-destructive mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{toolName} needs {LABEL[name]}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {!hasBrew
              ? `${LABEL[name]} installs through Homebrew, which isn't on this Mac yet. Run Homebrew's installer in Terminal, then check again.`
              : status === "error"
                ? "The last install failed. The terminal has Homebrew's output."
                : status === "queued" || status === "running"
                  ? "Installing with Homebrew. ffmpeg can take a few minutes; the terminal button shows progress."
                  : `Install it with Homebrew in one click. ${name === "magick" ? "It takes about a minute." : "It can take a few minutes."}`}
          </p>
        </div>
      </div>
      {!hasBrew && (
        <div className="bg-muted flex items-center gap-1 rounded-lg py-1 pr-1 pl-3">
          <code className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-[11px]" title={BREW_INSTALL}>
            {BREW_INSTALL}
          </code>
          <CopyButton value={BREW_INSTALL} className="size-7" tooltip="Copy Homebrew's install command" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <InstallDependencyButton name={name} />
        {!hasBrew && (
          <NeumorphButton size="small" onClick={() => void refreshDeps()}>
            Check again
          </NeumorphButton>
        )}
      </div>
    </div>
  )
}

/** A compact warning line with install buttons for everything missing, for the Dashboard. */
export function MissingDependenciesBanner({ names }: { names: DependencyName[] }) {
  const formulas = [...new Map(names.map((n) => [FORMULA[n], n])).values()]
  return (
    <div className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm">
      <TriangleAlert className="text-destructive size-4 shrink-0" />
      <span className="text-destructive min-w-0 flex-1">
        {names.join(", ")} {names.length === 1 ? "isn't" : "aren't"} installed, so some tools won't run.
      </span>
      <div className="flex flex-wrap gap-2">
        {formulas.map((n) => (
          <InstallDependencyButton key={n} name={n} />
        ))}
      </div>
    </div>
  )
}
