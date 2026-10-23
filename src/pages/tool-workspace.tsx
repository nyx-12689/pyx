import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "@tanstack/react-router"
import { convertFileSrc } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { revealItemInDir } from "@tauri-apps/plugin-opener"
import { AnimatePresence, motion } from "motion/react"
import { CircleAlert, FolderOpen, FolderOutput, Music, SquareTerminal, X } from "lucide-react"
import { useShallow } from "zustand/react/shallow"

import { Page, PageHeader } from "@/components/page"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import {
  FloatingPanelBody,
  FloatingPanelContent,
  FloatingPanelRoot,
  FloatingPanelTrigger,
} from "@/components/ui/floating-panel"
import { GridBeam } from "@/components/ui/grid-beam"
import { HaloBadge } from "@/components/ui/halo-badge"
import { HaloButton } from "@/components/ui/halo-button"
import { HoverVideoPlayer } from "@/components/ui/hover-video-player"
import { TextureCard, TextureCardContent, TextureSeparator } from "@/components/ui/texture-card"
import { MissingDependencyNotice } from "@/components/install-dependency"
import { PinToolButton } from "@/components/pin-tool-button"
import { JobProgress } from "@/components/job-progress"
import { JobTimer } from "@/components/job-timer"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useWindowDrop } from "@/components/drop-zone"
import { api } from "@/lib/api"
import { basename, formatBytes, formatDuration } from "@/lib/format"
import { sizeChange } from "@/lib/jobs"
import { useResolvedTheme } from "@/lib/theme"
import type { CommandPreview, Operation } from "@/lib/types"
import { cn } from "@/lib/utils"
import { type InputFile, isActive, useApp, useDependencyAvailable } from "@/store"
import { toolById, type ToolDef } from "@/tools/registry"

const EMPTY: InputFile[] = []

function describe(file: InputFile): string {
  const info = file.info
  if (!info) return file.probeError ? "Couldn't read this file" : "Reading…"
  const parts: string[] = []
  if (info.width && info.height) parts.push(`${info.width}×${info.height}`)
  if (info.duration) parts.push(formatDuration(info.duration))
  if (info.videoCodec && info.kind === "video") parts.push(info.videoCodec)
  parts.push(formatBytes(info.size))
  return parts.join(" · ")
}

/** Small preview: plays videos on hover, shows images, an icon for audio. */
function Thumbnail({ file }: { file: InputFile }) {
  const kind = file.info?.kind
  const src = convertFileSrc(file.path)
  return (
    <div className="bg-muted text-muted-foreground relative flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg">
      {kind === "video" ? (
        <HoverVideoPlayer videoSrc={src} muted loop preload="metadata" className="h-full w-full object-cover" />
      ) : kind === "image" ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          // Formats the webview can't show (e.g. PSD) fall back to the empty tile.
          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
        />
      ) : (
        <Music className="size-5" />
      )}
    </div>
  )
}

function InputRow({ tool, file }: { tool: ToolDef; file: InputFile }) {
  const job = useApp((s) => (file.lastJobId ? s.jobs[file.lastJobId] : undefined))
  const removeInput = useApp((s) => s.removeInput)
  const cancelJob = useApp((s) => s.cancelJob)
  const showJobInTerminal = useApp((s) => s.showJobInTerminal)
  const active = isActive(job)
  const unsupported = file.info && !tool.accepts.includes(file.info.kind)
  const change = job ? sizeChange(job) : null

  return (
    <motion.li
      // Position only: animating size would squash the row while its progress bar opens.
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: unsupported ? 0.45 : 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
      className="group bg-card relative overflow-hidden rounded-xl border p-2 pr-3"
    >
      <div className="flex items-center gap-3">
        <Thumbnail file={file} />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{file.name}</p>
            {unsupported && <HaloBadge variant="outline">Not supported here</HaloBadge>}
            {job?.status === "queued" && <HaloBadge variant="secondary">Queued</HaloBadge>}
            {job?.status === "cancelled" && <HaloBadge variant="outline">Cancelled</HaloBadge>}
            {job?.status === "done" && (
              <HaloBadge variant="default" tabularNums>
                {formatBytes(job.outputSize ?? 0)}
                {change && ` · ${change.text}`}
              </HaloBadge>
            )}
            {job?.status === "error" && <HaloBadge variant="destructive">Failed</HaloBadge>}
          </div>
          <p className="text-muted-foreground truncate text-xs tabular-nums">{describe(file)}</p>
          {job?.status === "error" && (
            <p className="text-destructive flex items-center gap-1 truncate text-xs">
              <CircleAlert className="size-3.5 shrink-0" />
              <span className="truncate">{job.error?.split("\n").filter(Boolean).pop()}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {job && <JobTimer job={job} className="mr-1" />}
          {job && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={() => showJobInTerminal(job.id)} aria-label="Show in terminal">
                  <SquareTerminal />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Show in terminal</TooltipContent>
            </Tooltip>
          )}
          {job?.output && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={() => revealItemInDir(job.output!)} aria-label="Show in Finder">
                  <FolderOpen />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Show in Finder</TooltipContent>
            </Tooltip>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => (active ? cancelJob(job!.id) : removeInput(tool.id, file.id))}
            aria-label={active ? "Cancel" : "Remove"}
            className={cn(!active && "opacity-0 group-hover:opacity-100")}
          >
            <X />
          </Button>
        </div>
      </div>
      {/* Full width under the row, so it reads well however narrow the window is. */}
      {job && <JobProgress key={job.id} job={job} className="px-1" />}
    </motion.li>
  )
}

/** Drop target; the beams light up while files are dragged over the window. */
/** Where files go: drag them in (anywhere on the window works). The beams light up while dragging. */
function DropArea({ tool, hovering }: { tool: ToolDef; hovering: boolean }) {
  const theme = useResolvedTheme()

  return (
    <GridBeam
      rows={2}
      cols={6}
      active={hovering}
      theme={theme}
      colorVariant="ocean"
      className={cn("rounded-2xl border transition-colors", hovering ? "border-primary" : "border-border")}
    >
      <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
        <p className="text-foreground text-sm font-medium">
          {hovering ? "Drop to add" : `Drop ${tool.accepts.join(" or ")} files or folders`}
        </p>
        <p className="text-muted-foreground text-xs">Drag them anywhere onto the window.</p>
      </div>
    </GridBeam>
  )
}

/** The exact command the tool will run, for the first file it would process. */
function CommandPreviewBody({ input, operation }: { input: string; operation: Operation }) {
  const outputDir = useApp((s) => s.settings.outputDir)
  const [preview, setPreview] = useState<CommandPreview | { error: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    api
      .previewCommand(input, outputDir, operation)
      .then((p) => !cancelled && setPreview(p))
      .catch((e) => !cancelled && setPreview({ error: String(e) }))
    return () => {
      cancelled = true
    }
  }, [input, outputDir, operation])

  if (!preview) return <p className="text-muted-foreground text-xs">Building…</p>
  if ("error" in preview) return <p className="text-destructive text-xs">{preview.error}</p>
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground truncate text-xs">For {basename(input)}</p>
        <CopyButton value={preview.command} tooltip="Copy full command" className="size-7 shrink-0" />
      </div>
      <pre className="rounded-lg bg-neutral-950 px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-neutral-200 select-text [overflow-wrap:anywhere]">
        {/* One argument per line reads better than wrapping mid-flag. */}
        {preview.displayCommand.replace(/ (?=-)/g, "\n  ")}
      </pre>
    </div>
  )
}

function Workspace({ tool }: { tool: ToolDef }) {
  const files = useApp((s) => s.inputs[tool.id] ?? EMPTY)
  const jobs = useApp(useShallow((s) => files.map((f) => (f.lastJobId ? s.jobs[f.lastJobId] : undefined))))
  const options = useApp((s) => s.options[tool.operation])
  const addInputs = useApp((s) => s.addInputs)
  const runTool = useApp((s) => s.runTool)
  const clearFinishedInputs = useApp((s) => s.clearFinishedInputs)
  const outputDir = useApp((s) => s.settings.outputDir)
  const updateSettings = useApp((s) => s.updateSettings)
  const available = useDependencyAvailable(tool.requires)

  const add = useCallback((paths: string[]) => void addInputs(tool.id, paths), [addInputs, tool.id])
  const hovering = useWindowDrop(add)

  const eligibleFiles = files.filter((f, i) => f.info && tool.accepts.includes(f.info.kind) && !isActive(jobs[i]))
  const activeCount = jobs.filter(isActive).length
  const hasFinished = jobs.some((j) => j?.status === "done")
  // Stable identity, so the command preview only refetches when an option changes.
  const operation = useMemo(() => ({ type: tool.operation, ...options }) as Operation, [tool.operation, options])

  const chooseOutputDir = async () => {
    const dir = await open({ directory: true, title: "Save results to" })
    if (typeof dir === "string") updateSettings({ outputDir: dir })
  }

  return (
    <Page className="max-w-none">
      <PageHeader
        title={tool.name}
        description={tool.description}
        actions={<PinToolButton toolId={tool.id} />}
        icon={
          <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
            <tool.icon className="size-5" />
          </div>
        }
      />

      <div className="flex gap-6">
        {/* The docked terminal sits over this column, leaving the options and Run button uncovered. */}
        <section data-terminal-area className="flex min-w-0 flex-1 flex-col gap-3">
          <DropArea tool={tool} hovering={hovering} />
          {files.length > 0 && (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-muted-foreground text-xs">
                  {files.length} file{files.length === 1 ? "" : "s"}
                </span>
                {hasFinished && (
                  <Button variant="ghost" size="xs" onClick={() => clearFinishedInputs(tool.id)}>
                    Clear finished
                  </Button>
                )}
              </div>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {files.map((file) => (
                    <InputRow key={file.id} tool={tool} file={file} />
                  ))}
                </AnimatePresence>
              </ul>
            </>
          )}
        </section>

        <aside className="w-80 shrink-0">
          <TextureCard className="sticky top-0">
            <TextureCardContent className="space-y-3 p-2">
              <tool.Options />
              <TextureSeparator />
              <div className="space-y-2 px-3">
                <span className="text-xs font-medium">Save to</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="min-w-0 flex-1 justify-start" onClick={chooseOutputDir}>
                    <FolderOutput />
                    <span className="truncate">{outputDir ? basename(outputDir) : "Same folder as original"}</span>
                  </Button>
                  {outputDir && (
                    <Button variant="ghost" size="sm" onClick={() => updateSettings({ outputDir: null })}>
                      Reset
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-2 px-3 pb-3">
                {available === false && <MissingDependencyNotice name={tool.requires} toolName={tool.name} />}
                <HaloButton
                  className="w-full"
                  onClick={() => void runTool(tool.id)}
                  disabled={eligibleFiles.length === 0 || available === false}
                  isLoading={activeCount > 0 && eligibleFiles.length === 0}
                  loadingText={`Running ${activeCount} file${activeCount === 1 ? "" : "s"}`}
                >
                  {available === false
                    ? `${tool.requires} not installed`
                    : eligibleFiles.length === 0
                      ? "Add files to run"
                      : `Run on ${eligibleFiles.length} file${eligibleFiles.length === 1 ? "" : "s"}`}
                </HaloButton>
                {eligibleFiles.length > 0 && (
                  <FloatingPanelRoot className="w-full">
                    <FloatingPanelTrigger title="Command preview" className="h-8 w-full justify-center rounded-lg text-xs">
                      Preview command
                    </FloatingPanelTrigger>
                    <FloatingPanelContent className="w-[420px]">
                      <FloatingPanelBody>
                        <CommandPreviewBody input={eligibleFiles[0].path} operation={operation} />
                      </FloatingPanelBody>
                    </FloatingPanelContent>
                  </FloatingPanelRoot>
                )}
              </div>
            </TextureCardContent>
          </TextureCard>
        </aside>
      </div>
    </Page>
  )
}

export function ToolWorkspacePage() {
  const { toolId } = useParams({ from: "/tools/$toolId" })
  const tool = toolById(toolId)
  if (!tool) {
    return (
      <Page>
        <PageHeader title="Tool not found" description={`There's no tool called "${toolId}".`} />
      </Page>
    )
  }
  // Keyed so each tool gets a fresh drop listener and state.
  return <Workspace key={tool.id} tool={tool} />
}
