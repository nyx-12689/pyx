import { useState } from "react"
import { openUrl } from "@tauri-apps/plugin-opener"
import { Check, CircleCheck, Download, PackageCheck, RefreshCw, TriangleAlert, Wand2, X } from "lucide-react"
import { useShallow } from "zustand/react/shallow"

import { Page, PageHeader } from "@/components/page"
import { CircuitBoard, CircuitBoardCard } from "@/components/ui/circuit-board"
import { CopyButton } from "@/components/ui/copy-button"
import {
  FamilyDrawerAnimatedContent,
  FamilyDrawerAnimatedWrapper,
  FamilyDrawerButton,
  FamilyDrawerClose,
  FamilyDrawerContent,
  FamilyDrawerHeader,
  FamilyDrawerOverlay,
  FamilyDrawerPortal,
  FamilyDrawerRoot,
  FamilyDrawerTrigger,
  FamilyDrawerViewContent,
  useFamilyDrawer,
} from "@/components/ui/family-drawer"
import { HaloBadge } from "@/components/ui/halo-badge"
import { HaloButton } from "@/components/ui/halo-button"
import { HaloProgress } from "@/components/ui/halo-progress"
import NeumorphButton from "@/components/ui/neumorph-button"
import { Skeleton } from "@/components/ui/skeleton"
import { Timer } from "@/components/ui/timer"
import type { Dependency } from "@/lib/types"
import { cn } from "@/lib/utils"
import { isActive, useApp } from "@/store"
import { TOOLS } from "@/tools/registry"

const GLOW: Record<Dependency["name"], string> = {
  ffmpeg: "rgba(0, 200, 120, 0.18)",
  ffprobe: "rgba(80, 140, 255, 0.18)",
  magick: "rgba(255, 135, 0, 0.18)",
}

/** Installable formulas; ffprobe ships inside ffmpeg. */
const FORMULAS = ["ffmpeg", "imagemagick"] as const

function useInstalling(formula: string) {
  return useApp((s) =>
    s.jobOrder.some((id) => s.jobs[id].kind === "install" && s.jobs[id].subject === formula && isActive(s.jobs[id])),
  )
}

function DependencyCard({ dep, index, brewAvailable }: { dep: Dependency; index: number; brewAvailable: boolean }) {
  const installDependency = useApp((s) => s.installDependency)
  const installing = useInstalling(dep.formula)
  const usedBy = TOOLS.filter((t) => t.requires === dep.name)
  const installed = !!dep.path
  // ffprobe comes with ffmpeg; upgrades only make sense for Homebrew installs that have a newer version.
  const canInstall = brewAvailable && dep.name !== "ffprobe" && (!installed || (dep.source === "homebrew" && !!dep.latest))

  return (
    <CircuitBoardCard glowColor={GLOW[dep.name]} glowDelay={index * 0.8} dim={!installed}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-card-foreground font-mono text-lg font-semibold">{dep.name}</h3>
        {installed ? (
          <HaloBadge variant="secondary" tabularNums>
            {dep.version}
            {dep.latest && ` → ${dep.latest}`}
          </HaloBadge>
        ) : (
          <HaloBadge variant="destructive">Missing</HaloBadge>
        )}
      </div>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{dep.description}</p>

      {dep.path && (
        <div className="bg-muted mt-4 flex items-center gap-1 rounded-lg py-1 pr-1 pl-3">
          <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs" title={dep.path}>
            {dep.path}
          </span>
          <CopyButton value={dep.path} className="size-7" tooltip="Copy path" />
        </div>
      )}

      {dep.capabilities.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {dep.capabilities.map((cap) => (
            <span
              key={cap.id}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]",
                cap.available ? "text-foreground" : "text-muted-foreground border-dashed line-through decoration-1",
              )}
            >
              {cap.available ? <Check className="size-3 text-emerald-500" /> : <X className="size-3" />}
              {cap.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-end justify-between gap-2 pt-5">
        <p className="text-muted-foreground text-xs">
          {usedBy.length > 0 ? `Used by ${usedBy.map((t) => t.name).join(", ")}` : "Reads file details for every tool"}
          {dep.source && ` · ${dep.source === "homebrew" ? "Homebrew" : "System"}`}
        </p>
        {canInstall ? (
          <HaloButton
            isLoading={installing}
            loadingText="Working…"
            onClick={() => void installDependency(dep.formula, installed)}
          >
            {installed ? `Upgrade to ${dep.latest}` : "Install"}
          </HaloButton>
        ) : (
          installed &&
          dep.source === "homebrew" && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CircleCheck className="size-3.5" /> Up to date
            </span>
          )
        )}
      </div>
    </CircuitBoardCard>
  )
}

// ---------------------------------------------------------------------------
// Setup assistant (drawer)

function SetupOverview() {
  const { setView } = useFamilyDrawer()
  const deps = useApp((s) => s.deps)
  const installDependency = useApp((s) => s.installDependency)
  if (!deps) return null

  const missing = FORMULAS.filter((f) => deps.dependencies.some((d) => d.formula === f && !d.path))
  const outdated = FORMULAS.filter((f) => deps.dependencies.some((d) => d.formula === f && d.path && d.latest))
  const run = (upgrade: boolean) => {
    const formulas = upgrade ? outdated : missing
    for (const f of formulas) void installDependency(f, upgrade)
    setView("progress")
  }

  if (!deps.brewPath) {
    return (
      <div>
        <FamilyDrawerHeader
          icon={<TriangleAlert className="size-8 text-amber-500" />}
          title="Homebrew is needed"
          description="Pyx installs ffmpeg and ImageMagick through Homebrew, the macOS package manager. Install it first, then come back."
        />
        <div className="mt-6">
          <FamilyDrawerButton onClick={() => void openUrl("https://brew.sh")}>Open brew.sh</FamilyDrawerButton>
        </div>
      </div>
    )
  }

  return (
    <div>
      <FamilyDrawerHeader
        icon={<Wand2 className="size-8" />}
        title={missing.length ? "Finish setting up" : outdated.length ? "Updates available" : "Everything's up to date"}
        description={
          missing.length
            ? `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} missing. Install ${missing.length === 1 ? "it" : "them"} with Homebrew; you can watch it in the terminal.`
            : outdated.length
              ? `Homebrew has newer versions of ${outdated.join(" and ")}.`
              : "All the programs Pyx uses are installed and on their latest Homebrew versions."
        }
      />
      <ul className="mt-6 space-y-2">
        {deps.dependencies.map((d) => (
          <li key={d.name} className="flex items-center justify-between text-sm">
            <span className="font-mono">{d.name}</span>
            {d.path ? (
              <span className="text-muted-foreground font-mono text-xs">
                {d.version}
                {d.latest && ` → ${d.latest}`}
              </span>
            ) : (
              <span className="text-destructive text-xs">Missing</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-6 space-y-2">
        {missing.length > 0 ? (
          <FamilyDrawerButton onClick={() => run(false)}>
            <Download className="size-5" /> Install missing
          </FamilyDrawerButton>
        ) : (
          outdated.length > 0 && (
            <FamilyDrawerButton onClick={() => run(true)}>
              <RefreshCw className="size-5" /> Upgrade {outdated.length === 1 ? outdated[0] : "all"}
            </FamilyDrawerButton>
          )
        )}
      </div>
    </div>
  )
}

function SetupProgress() {
  const { setView } = useFamilyDrawer()
  const installs = useApp(
    useShallow((s) => s.jobOrder.map((id) => s.jobs[id]).filter((j) => j.kind === "install").slice(-FORMULAS.length)),
  )
  const finished = installs.length > 0 && !installs.some(isActive)
  const failed = installs.filter((j) => j.status === "error")

  return (
    <div>
      <FamilyDrawerHeader
        icon={
          finished ? (
            failed.length ? (
              <TriangleAlert className="text-destructive size-8" />
            ) : (
              <PackageCheck className="size-8 text-emerald-500" />
            )
          ) : (
            <RefreshCw className="size-8 animate-spin" />
          )
        }
        title={finished ? (failed.length ? "Some installs failed" : "All set") : "Installing…"}
        description={
          finished
            ? failed.length
              ? "Open the terminal for Homebrew's output."
              : "The new versions are in use right away."
            : "Homebrew can take a few minutes, especially for ffmpeg."
        }
      />
      <div className="mt-6 space-y-4">
        {installs.map((job) => (
          <div key={job.id} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{job.label}</span>
              {isActive(job) ? (
                <Timer loading startedAt={job.startedAt ?? undefined} format="MM:SS" size="sm" variant="ghost" />
              ) : job.status === "done" ? (
                <CircleCheck className="size-4 text-emerald-500" />
              ) : (
                <X className="text-destructive size-4" />
              )}
            </div>
            <HaloProgress value={isActive(job) ? null : 100} />
          </div>
        ))}
      </div>
      {finished && (
        <div className="mt-6">
          <FamilyDrawerButton onClick={() => setView("default")}>Back</FamilyDrawerButton>
        </div>
      )}
    </div>
  )
}

const SETUP_VIEWS = { default: SetupOverview, progress: SetupProgress }

function SetupAssistant() {
  return (
    <FamilyDrawerRoot views={SETUP_VIEWS}>
      <FamilyDrawerTrigger asChild>
        <NeumorphButton size="small">
          <span className="flex items-center gap-1.5">
            <Wand2 className="size-3.5" /> Setup assistant
          </span>
        </NeumorphButton>
      </FamilyDrawerTrigger>
      <FamilyDrawerPortal>
        <FamilyDrawerOverlay />
        <FamilyDrawerContent>
          <FamilyDrawerClose />
          <FamilyDrawerAnimatedWrapper>
            <FamilyDrawerAnimatedContent>
              <FamilyDrawerViewContent />
            </FamilyDrawerAnimatedContent>
          </FamilyDrawerAnimatedWrapper>
        </FamilyDrawerContent>
      </FamilyDrawerPortal>
    </FamilyDrawerRoot>
  )
}

// ---------------------------------------------------------------------------

export function DependenciesPage() {
  const deps = useApp((s) => s.deps)
  const refreshDeps = useApp((s) => s.refreshDeps)
  const [refreshing, setRefreshing] = useState(false)
  const missing = deps?.dependencies.filter((d) => !d.path).length ?? 0

  const refresh = async () => {
    setRefreshing(true)
    await refreshDeps().finally(() => setRefreshing(false))
  }

  return (
    <Page>
      <PageHeader
        title="Dependencies"
        description="The command-line programs Pyx drives. Installs and upgrades run through Homebrew and show in the terminal."
        actions={
          <>
            <SetupAssistant />
            <NeumorphButton size="small" loading={refreshing} onClick={refresh}>
              Check again
            </NeumorphButton>
          </>
        }
      />

      {deps ? (
        <CircuitBoard label={missing ? `${missing} missing` : "Powered By"}>
          {deps.dependencies.map((dep, i) => (
            <DependencyCard key={dep.name} dep={dep} index={i} brewAvailable={!!deps.brewPath} />
          ))}
        </CircuitBoard>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      )}
    </Page>
  )
}
