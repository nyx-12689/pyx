import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

import { showPolishedToast } from "@/components/ui/halo-toast"
import { api } from "@/lib/api"
import { basename, formatBytes } from "@/lib/format"
import type {
  AudioOptions,
  DependencyName,
  DependencyReport,
  GifOptions,
  HistoryRecord,
  ImageOptions,
  JobEvent,
  MediaInfo,
  Operation,
  OperationType,
  StripOptions,
  VideoOptions,
} from "@/lib/types"
import { toolById } from "@/tools/registry"

// ---------------------------------------------------------------------------
// Types

/** A file added to a tool's workspace. */
export interface InputFile {
  id: string
  path: string
  name: string
  info: MediaInfo | null
  probeError: string | null
  /** The most recent job run on this file from this tool. */
  lastJobId: string | null
}

export type JobState = "queued" | "running" | "done" | "error" | "cancelled"

export interface Job {
  id: string
  kind: "tool" | "install"
  /** Tool id for tool jobs; the Homebrew formula for installs. */
  subject: string
  label: string
  input: string | null
  inputInfo: MediaInfo | null
  status: JobState
  progress: number | null
  command: string | null
  displayCommand: string | null
  output: string | null
  outputSize: number | null
  error: string | null
  elapsedMs: number | null
  createdAt: number
  /** When it left the queue (Unix ms). */
  startedAt: number | null
  /** Jobs started by the same Run click share this; the terminal groups by it. */
  runId: string
}

export type Theme = "system" | "light" | "dark"

export interface Settings {
  /** null = next to the original file */
  outputDir: string | null
  theme: Theme
  /** Terminal height in px, set by dragging its top edge; null = the default. */
  terminalHeight: number | null
  /** Whether a click outside the terminal closes it. */
  terminalClosesOnOutsideClick: boolean
  /** Tool ids pinned to the sidebar, in the order they were pinned. */
  pinnedTools: string[]
}

interface Options {
  image: ImageOptions
  video: VideoOptions
  audio: AudioOptions
  gif: GifOptions
  strip: StripOptions
}

/** How far back history is loaded: enough for the Dashboard's 90-day comparison and calendar. */
export const HISTORY_DAYS = 182

interface AppState {
  inputs: Record<string, InputFile[]>
  jobs: Record<string, Job>
  /** Job ids, oldest first. */
  jobOrder: string[]
  /** Saved jobs from the last HISTORY_DAYS days, newest first; null until loaded. */
  history: HistoryRecord[] | null
  /** Job ids of each tool's latest run, for the summary toast when it finishes. */
  batches: Record<string, string[]>
  options: Options
  settings: Settings
  deps: DependencyReport | null
  terminal: {
    open: boolean
    /** The job the terminal scrolls to and highlights. */
    activeJobId: string | null
    /** Finished jobs cleared from the terminal; Activity still lists them. */
    hiddenIds: string[]
  }

  addInputs: (toolId: string, paths: string[]) => Promise<void>
  removeInput: (toolId: string, id: string) => void
  clearFinishedInputs: (toolId: string) => void
  setOptions: <T extends OperationType>(type: T, patch: Partial<Options[T]>) => void
  runTool: (toolId: string) => Promise<number>
  cancelJob: (jobId: string) => void
  clearFinishedJobs: () => void
  applyJobEvent: (event: JobEvent) => void
  refreshDeps: () => Promise<void>
  refreshHistory: () => Promise<void>
  clearHistory: () => Promise<void>
  installDependency: (formula: string, upgrade: boolean) => Promise<void>
  updateSettings: (patch: Partial<Settings>) => void
  /** Pins a tool to the sidebar, or unpins it. */
  togglePinnedTool: (toolId: string) => void
  setTerminal: (patch: Partial<AppState["terminal"]>) => void
  showJobInTerminal: (jobId: string) => void
  /** Hides finished jobs from the terminal. */
  clearTerminal: () => void
}

export const ACTIVE_STATES: JobState[] = ["queued", "running"]
export const isActive = (job: Job | undefined) => !!job && ACTIVE_STATES.includes(job.status)

const newJob = (fields: Pick<Job, "id" | "kind" | "subject" | "label"> & Partial<Job>): Job => ({
  input: null,
  inputInfo: null,
  status: "queued",
  progress: null,
  command: null,
  displayCommand: null,
  output: null,
  outputSize: null,
  error: null,
  elapsedMs: null,
  createdAt: Date.now(),
  startedAt: null,
  runId: fields.id,
  ...fields,
})

// ---------------------------------------------------------------------------
// Preferences storage

/** localStorage key used before the app was renamed to Pyx. */
const LEGACY_KEY = "master-gui"

/**
 * Preferences live in settings.json in the app's data folder, which carries over
 * when the app's identifier changes; the WebView's localStorage does not. It's
 * still kept as a cache so they load before the first paint.
 */
const settingsStorage: StateStorage = {
  getItem: (name) => {
    const cached = localStorage.getItem(name)
    if (cached !== null) return cached
    return api
      .settingsLoad()
      .catch(() => null)
      .then((saved) => {
        const value = saved ?? localStorage.getItem(LEGACY_KEY)
        if (value !== null) {
          localStorage.setItem(name, value)
          // Preferences that were only in the old localStorage go to the file now.
          if (saved === null) void api.settingsSave(value).catch(() => {})
        }
        return value
      })
  },
  setItem: (name, value) => {
    localStorage.setItem(name, value)
    void api.settingsSave(value).catch(() => {})
  },
  removeItem: (name) => localStorage.removeItem(name),
}

// ---------------------------------------------------------------------------
// Store

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const patchInputs = (toolId: string, fn: (files: InputFile[]) => InputFile[]) =>
        set((s) => ({ inputs: { ...s.inputs, [toolId]: fn(s.inputs[toolId] ?? []) } }))

      const patchJob = (id: string, patch: Partial<Job>) =>
        set((s) => (s.jobs[id] ? { jobs: { ...s.jobs, [id]: { ...s.jobs[id], ...patch } } } : {}))

      const addJob = (job: Job) => {
        set((s) => ({ jobs: { ...s.jobs, [job.id]: job }, jobOrder: [...s.jobOrder, job.id] }))
      }

      // Several jobs often finish together; reload history once they settle.
      let historyTimer: ReturnType<typeof setTimeout> | undefined
      const scheduleHistoryRefresh = () => {
        clearTimeout(historyTimer)
        historyTimer = setTimeout(() => void get().refreshHistory(), 600)
      }

      /** When the last job of a tool's run finishes, sum the run up in a toast. */
      const maybeAnnounceBatch = (jobId: string) => {
        const { jobs, batches } = get()
        const job = jobs[jobId]
        const batch = job ? batches[job.subject] : undefined
        if (!job || job.kind !== "tool" || !batch?.includes(jobId)) return
        const batchJobs = batch.map((id) => jobs[id]).filter(Boolean)
        if (batchJobs.some(isActive)) return

        const done = batchJobs.filter((j) => j.status === "done")
        const failed = batchJobs.filter((j) => j.status === "error").length
        const saved = done.reduce((sum, j) => sum + ((j.inputInfo?.size ?? 0) - (j.outputSize ?? 0)), 0)
        const tool = toolById(job.subject)
        if (done.length === 0 && failed === 0) return
        showPolishedToast({
          title:
            failed === 0
              ? `${tool?.name ?? "Tool"}: ${done.length} file${done.length === 1 ? "" : "s"} done`
              : `${tool?.name ?? "Tool"}: ${failed} of ${batchJobs.length} failed`,
          description:
            done.length > 0
              ? saved >= 0
                ? `Saved ${formatBytes(saved)} in total.`
                : `Output is ${formatBytes(-saved)} larger in total.`
              : "Open the terminal to see why.",
          rimVariant: failed === 0 ? "success" : "destructive",
        })
      }

      /** Points the terminal at a job without opening it; it only opens when you click. */
      const focusTerminalOn = (jobId: string) => {
        set((s) => ({ terminal: { ...s.terminal, activeJobId: jobId } }))
      }

      return {
        inputs: {},
        jobs: {},
        jobOrder: [],
        history: null,
        batches: {},
        options: {
          image: { format: "webp", quality: 80, lossless: false, maxWidth: null, stripMetadata: true },
          video: { container: "mp4", codec: "h264Hw", quality: 60, maxHeight: null, fps: null, removeAudio: false },
          audio: { format: "mp3", bitrate: 192, normalize: false },
          gif: { fps: 12, width: 480 },
          strip: { keepColorProfile: true },
        },
        settings: {
          outputDir: null,
          theme: "system",
          terminalHeight: null,
          terminalClosesOnOutsideClick: true,
          pinnedTools: [],
        },
        deps: null,
        terminal: { open: false, activeJobId: null, hiddenIds: [] },

        addInputs: async (toolId, paths) => {
          const expanded = await api.expandPaths(paths)
          const known = new Set((get().inputs[toolId] ?? []).map((f) => f.path))
          const added: InputFile[] = expanded
            .filter((path) => !known.has(path))
            .map((path) => ({ id: crypto.randomUUID(), path, name: basename(path), info: null, probeError: null, lastJobId: null }))
          if (added.length === 0) return
          patchInputs(toolId, (files) => [...files, ...added])

          await Promise.all(
            added.map(async (file) => {
              const patch: Partial<InputFile> = await api
                .probeFile(file.path)
                .then((info) => ({ info }))
                .catch((e) => ({ probeError: String(e) }))
              patchInputs(toolId, (files) => files.map((f) => (f.id === file.id ? { ...f, ...patch } : f)))
            }),
          )
        },

        removeInput: (toolId, id) => {
          const file = get().inputs[toolId]?.find((f) => f.id === id)
          if (file?.lastJobId && isActive(get().jobs[file.lastJobId])) get().cancelJob(file.lastJobId)
          patchInputs(toolId, (files) => files.filter((f) => f.id !== id))
        },

        clearFinishedInputs: (toolId) => {
          const { jobs } = get()
          patchInputs(toolId, (files) => files.filter((f) => !f.lastJobId || jobs[f.lastJobId]?.status !== "done"))
        },

        setOptions: (type, patch) =>
          set((s) => ({ options: { ...s.options, [type]: { ...s.options[type], ...patch } } })),

        runTool: async (toolId) => {
          const tool = toolById(toolId)
          if (!tool) return 0
          const { inputs, jobs, options, settings } = get()
          const operation = { type: tool.operation, ...options[tool.operation] } as Operation
          const targets = (inputs[toolId] ?? []).filter(
            (f) => f.info && tool.accepts.includes(f.info.kind) && !isActive(f.lastJobId ? jobs[f.lastJobId] : undefined),
          )

          const jobIds = targets.map(() => crypto.randomUUID())
          const runId = crypto.randomUUID()
          set((s) => ({ batches: { ...s.batches, [toolId]: jobIds } }))
          for (const [i, file] of targets.entries()) {
            const jobId = jobIds[i]
            addJob(newJob({ id: jobId, runId, kind: "tool", subject: toolId, label: tool.name, input: file.path, inputInfo: file.info }))
            patchInputs(toolId, (files) => files.map((f) => (f.id === file.id ? { ...f, lastJobId: jobId } : f)))
            if (i === 0) focusTerminalOn(jobId)
            try {
              await api.startJob({
                id: jobId,
                toolId,
                label: tool.name,
                input: file.path,
                outputDir: settings.outputDir,
                operation,
              })
            } catch (e) {
              patchJob(jobId, { status: "error", error: String(e) })
            }
          }
          return targets.length
        },

        cancelJob: (jobId) => void api.cancelJob(jobId),

        clearFinishedJobs: () =>
          set((s) => {
            const keep = s.jobOrder.filter((id) => isActive(s.jobs[id]))
            return { jobOrder: keep, jobs: Object.fromEntries(keep.map((id) => [id, s.jobs[id]])) }
          }),

        applyJobEvent: (event) => {
          if (event.status === "done" || event.status === "error" || event.status === "cancelled") {
            // Runs after the status below is applied.
            queueMicrotask(() => {
              maybeAnnounceBatch(event.id)
              scheduleHistoryRefresh()
            })
          }
          switch (event.status) {
            case "queued":
              return patchJob(event.id, { status: "queued", command: event.command, displayCommand: event.displayCommand })
            case "running":
              return patchJob(event.id, { status: "running", startedAt: Date.now() })
            case "progress":
              return patchJob(event.id, {
                status: "running",
                progress: event.progress,
                startedAt: get().jobs[event.id]?.startedAt ?? Date.now(),
              })
            case "done":
              patchJob(event.id, {
                status: "done",
                progress: 1,
                output: event.output,
                outputSize: event.outputSize,
                elapsedMs: event.elapsedMs,
              })
              // An install changes what's available.
              if (get().jobs[event.id]?.kind === "install") void get().refreshDeps()
              return
            case "error":
              return patchJob(event.id, { status: "error", error: event.error, elapsedMs: event.elapsedMs })
            case "cancelled":
              return patchJob(event.id, { status: "cancelled", elapsedMs: event.elapsedMs })
          }
        },

        refreshDeps: async () => {
          set({ deps: await api.dependencyReport() })
        },

        refreshHistory: async () => {
          const since = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000
          set({ history: await api.historyList(since, 20_000) })
        },

        clearHistory: async () => {
          await api.historyClear()
          get().clearFinishedJobs()
          set({ history: [] })
        },

        installDependency: async (formula, upgrade) => {
          const jobId = crypto.randomUUID()
          addJob(newJob({ id: jobId, kind: "install", subject: formula, label: `${upgrade ? "Upgrade" : "Install"} ${formula}` }))
          focusTerminalOn(jobId)
          try {
            await api.installDependency(jobId, formula, upgrade)
          } catch (e) {
            patchJob(jobId, { status: "error", error: String(e) })
          }
        },

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        togglePinnedTool: (toolId) =>
          set((s) => {
            const pinned = s.settings.pinnedTools
            const next = pinned.includes(toolId) ? pinned.filter((id) => id !== toolId) : [...pinned, toolId]
            return { settings: { ...s.settings, pinnedTools: next } }
          }),

        setTerminal: (patch) => set((s) => ({ terminal: { ...s.terminal, ...patch } })),

        showJobInTerminal: (jobId) => set((s) => ({ terminal: { ...s.terminal, open: true, activeJobId: jobId } })),

        clearTerminal: () =>
          set((s) => ({
            terminal: {
              ...s.terminal,
              activeJobId: null,
              hiddenIds: [...s.terminal.hiddenIds, ...s.jobOrder.filter((id) => !isActive(s.jobs[id]))],
            },
          })),
      }
    },
    {
      name: "pyx",
      version: 1,
      storage: createJSONStorage(() => settingsStorage),
      // Only preferences survive a restart; jobs and inputs are per session until history lands in v0.3.
      partialize: (s) => ({ settings: s.settings, options: s.options }),
      // Fill in defaults for fields added since the preferences were saved, instead of dropping them.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Pick<AppState, "settings" | "options">>
        const options = { ...current.options }
        for (const key of Object.keys(options) as (keyof Options)[]) {
          options[key] = { ...current.options[key], ...saved.options?.[key] } as never
        }
        return { ...current, settings: { ...current.settings, ...saved.settings }, options }
      },
    },
  ),
)

/** Whether a dependency is installed, or null while the report is loading. */
export function useDependencyAvailable(name: DependencyName): boolean | null {
  return useApp((s) => (s.deps ? !!s.deps.dependencies.find((d) => d.name === name)?.path : null))
}

/** A saved job, shaped like a live one so lists can show both. */
export function recordToJob(r: HistoryRecord): Job {
  return {
    id: r.id,
    kind: r.kind,
    subject: r.subject,
    label: r.label,
    input: r.input,
    inputInfo:
      r.input && r.inputSize !== null
        ? {
            path: r.input,
            kind: r.inputKind ?? "unknown",
            size: r.inputSize,
            duration: r.inputDuration,
            width: null,
            height: null,
            videoCodec: null,
            audioCodec: null,
            fps: null,
          }
        : null,
    status: r.status,
    progress: r.status === "done" ? 1 : null,
    command: r.command,
    displayCommand: r.displayCommand,
    output: r.output,
    outputSize: r.outputSize,
    error: r.error,
    elapsedMs: r.elapsedMs,
    createdAt: r.createdAt,
    startedAt: r.elapsedMs === null ? null : r.finishedAt - r.elapsedMs,
    runId: r.id,
  }
}
