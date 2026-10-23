import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

import type {
  CommandPreview,
  DependencyReport,
  HistoryRecord,
  JobEvent,
  JobRequest,
  MediaInfo,
  Operation,
} from "@/lib/types"

export const api = {
  dependencyReport: () => invoke<DependencyReport>("dependency_report"),
  installDependency: (id: string, formula: string, upgrade: boolean) =>
    invoke<void>("install_dependency", { id, formula, upgrade }),
  expandPaths: (paths: string[]) => invoke<string[]>("expand_paths", { paths }),
  probeFile: (path: string) => invoke<MediaInfo>("probe_file", { path }),
  startJob: (request: JobRequest) => invoke<void>("start_job", { request }),
  cancelJob: (id: string) => invoke<void>("cancel_job", { id }),
  jobLog: (id: string) => invoke<string | null>("job_log", { id }),
  previewCommand: (input: string, outputDir: string | null, operation: Operation) =>
    invoke<CommandPreview>("preview_command", { input, outputDir, operation }),
  historyList: (since: number, limit: number) => invoke<HistoryRecord[]>("history_list", { since, limit }),
  historyClear: () => invoke<void>("history_clear"),
  settingsLoad: () => invoke<string | null>("settings_load"),
  settingsSave: (json: string) => invoke<void>("settings_save", { json }),
  onJobEvent: (handler: (event: JobEvent) => void) =>
    listen<JobEvent>("job", (e) => handler(e.payload)),
}
