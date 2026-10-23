// Dev-only stand-in for the Rust backend, so the UI can be opened in a plain
// browser (http://localhost:1420) while iterating on layout. Loaded from
// main.tsx only when the page isn't running inside Tauri.

import { emit } from "@tauri-apps/api/event"
import { mockConvertFileSrc, mockIPC, mockWindows } from "@tauri-apps/api/mocks"

import type { DependencyReport, HistoryRecord, JobEvent, MediaInfo } from "@/lib/types"

const report: DependencyReport = {
  brewPath: "/opt/homebrew/bin/brew",
  dependencies: [
    {
      name: "ffmpeg",
      formula: "ffmpeg",
      description: "Encodes and decodes video and audio; runs most tools.",
      path: "/opt/homebrew/bin/ffmpeg",
      version: "8.0",
      source: "homebrew",
      latest: null,
      capabilities: [
        { id: "encoder:h264_videotoolbox", label: "H.264 (Apple hardware)", available: true },
        { id: "encoder:hevc_videotoolbox", label: "HEVC (Apple hardware)", available: true },
        { id: "encoder:libx264", label: "H.264 (x264)", available: true },
        { id: "encoder:libx265", label: "HEVC (x265)", available: false },
        { id: "encoder:libsvtav1", label: "AV1 (SVT)", available: true },
        { id: "encoder:libwebp", label: "WebP", available: false },
        { id: "encoder:libopus", label: "Opus", available: true },
      ],
    },
    {
      name: "ffprobe",
      formula: "ffmpeg",
      description: "Reads media details: duration, codecs, resolution.",
      path: "/opt/homebrew/bin/ffprobe",
      version: "8.0",
      source: "homebrew",
      latest: null,
      capabilities: [],
    },
    {
      name: "magick",
      formula: "imagemagick",
      description: "ImageMagick: converts and edits images.",
      path: "/opt/homebrew/bin/magick",
      version: "7.1.2-34",
      source: "homebrew",
      // One outdated tool, so the browser preview shows the upgrade path.
      latest: "7.1.2-36",
      capabilities: [
        { id: "format:webp", label: "WebP", available: true },
        { id: "format:avif", label: "AVIF", available: true },
        { id: "format:heic", label: "HEIC", available: true },
        { id: "format:jxl", label: "JPEG XL", available: false },
      ],
    },
  ],
}

function fakeInfo(path: string): MediaInfo {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  const video = ["mov", "mp4", "mkv", "webm"].includes(ext)
  const audio = ["mp3", "wav", "flac", "m4a"].includes(ext)
  return {
    path,
    kind: video ? "video" : audio ? "audio" : "image",
    size: video ? 48_300_000 : audio ? 7_200_000 : 2_400_000,
    duration: video || audio ? 42.5 : null,
    width: audio ? null : 1920,
    height: audio ? null : 1080,
    videoCodec: video ? "h264" : null,
    audioCodec: video || audio ? "aac" : null,
    fps: video ? 29.97 : null,
  }
}

const event = (id: string, status: JobEvent["status"], extra: Partial<JobEvent> = {}): JobEvent => ({
  id,
  status,
  progress: null,
  command: null,
  displayCommand: null,
  output: null,
  outputSize: null,
  error: null,
  elapsedMs: null,
  ...extra,
})

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function simulate(id: string, command: string, output: string | null, fail = false) {
  await emit("job", event(id, "queued", { command, displayCommand: command.replace(/\/Users\/demo\/[^ ]*\//g, "") }))
  await delay(400)
  await emit("job", event(id, "running"))
  // Like magick: done in a blink, with no progress reported along the way.
  if (output?.endsWith(".webp")) {
    await delay(150 + Math.random() * 200)
    await emit("job", event(id, "done", { progress: 1, output, outputSize: 3_100_000, elapsedMs: 310 }))
    return
  }
  for (let p = 0.05; p < 1; p += 0.07) {
    await delay(180)
    await emit("job", event(id, "progress", { progress: p }))
    if (fail && p > 0.5) {
      await emit("job", event(id, "error", { error: "Conversion failed!\nEncoder did not produce proper pts", elapsedMs: 2100 }))
      return
    }
  }
  await emit("job", event(id, "done", { progress: 1, output, outputSize: 3_100_000, elapsedMs: 3240 }))
}

/** Six months of plausible saved jobs, so the Dashboard has something to chart. */
function sampleHistory(): HistoryRecord[] {
  const tools = [
    { id: "convert.image", label: "Image format", input: "photo", ext: "png", out: ["webp", "avif", "jpg"], kind: "image" as const },
    { id: "convert.video", label: "Video format", input: "clip", ext: "mov", out: ["mp4", "webm"], kind: "video" as const },
    { id: "convert.audio", label: "Audio format", input: "interview", ext: "wav", out: ["mp3", "m4a"], kind: "audio" as const },
    { id: "convert.gif", label: "Video to GIF", input: "loop", ext: "mp4", out: ["gif"], kind: "video" as const },
  ]
  const errors = [
    "Conversion failed!\nInvalid data found when processing input",
    "Error opening output file /Users/demo/Media/out.webm.\nUnknown encoder 'libsvtav1'",
    "magick: no decode delegate for this image format `HEIC' @ error/constitute.c/ReadImage/746.",
  ]
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const records: HistoryRecord[] = []
  const now = Date.now()
  for (let day = 0; day < 182; day++) {
    const count = Math.floor(rand() * 9) + (day % 7 < 2 ? 0 : 2)
    for (let i = 0; i < count; i++) {
      const t = tools[Math.floor(rand() * (rand() < 0.5 ? 1.3 : tools.length)) % tools.length]
      const finishedAt = now - day * 86_400_000 - Math.floor(rand() * 80_000_000)
      const inputSize = t.kind === "video" ? 20e6 + rand() * 300e6 : t.kind === "audio" ? 5e6 + rand() * 60e6 : 1e6 + rand() * 8e6
      const status = rand() < 0.08 ? "error" : rand() < 0.04 ? "cancelled" : "done"
      const ext = t.out[Math.floor(rand() * t.out.length)]
      const elapsedMs = Math.round(t.kind === "image" ? 200 + rand() * 1500 : 4000 + rand() * 90_000)
      records.push({
        id: `h-${day}-${i}`,
        kind: "tool",
        subject: t.id,
        label: t.label,
        input: `/Users/demo/Media/${t.input}-${day}-${i}.${t.ext}`,
        inputSize: Math.round(inputSize),
        inputKind: t.kind,
        inputDuration: t.kind === "image" ? null : 20 + rand() * 300,
        output: status === "done" ? `/Users/demo/Media/${t.input}-${day}-${i}.${ext}` : null,
        outputSize: status === "done" ? Math.round(inputSize * (t.id === "convert.gif" ? 0.6 + rand() * 1.2 : 0.15 + rand() * 0.6)) : null,
        status,
        error: status === "error" ? errors[Math.floor(rand() * errors.length)] : null,
        elapsedMs,
        createdAt: finishedAt - elapsedMs,
        finishedAt,
        command: `ffmpeg -i ${t.input}.${t.ext} ${t.input}.${ext}`,
        displayCommand: `ffmpeg -i ${t.input}.${t.ext} ${t.input}.${ext}`,
      })
    }
  }
  return records.sort((a, b) => b.finishedAt - a.finishedAt)
}

export function installMocks() {
  mockWindows("main")
  mockConvertFileSrc("macos")
  let history = sampleHistory()
  mockIPC(
    async (cmd, args) => {
      const a = (args ?? {}) as Record<string, unknown>
      switch (cmd) {
        case "dependency_report":
          return report
        case "expand_paths":
          return a.paths
        case "probe_file":
          return fakeInfo(a.path as string)
        case "start_job": {
          const req = a.request as { id: string; input: string }
          const name = req.input.split("/").pop()!
          const stem = name.replace(/\.[^.]+$/, "")
          const image = /\.(png|jpe?g|heic|tiff?)$/i.test(name)
          const out = `/Users/demo/Movies/${stem}.${image ? "webp" : "mp4"}`
          const command = image
            ? `magick ${req.input} -quality 80 ${out}`
            : `ffmpeg -i ${req.input} -c:v libx264 -crf 23 -c:a aac -b:a 160k ${out}`
          void simulate(req.id, command, out, name.includes("broken"))
          return null
        }
        case "install_dependency":
          void simulate(a.id as string, `brew ${a.upgrade ? "upgrade" : "install"} ${a.formula}`, null)
          return null
        case "job_log":
          return "$ ffmpeg -i clip.mov out.mp4\n\nInput #0, mov, from 'clip.mov':\n  Duration: 00:00:42.50\nframe=  120 fps=60 q=23.0 size=  1024kB\rframe=  240 fps=60 q=23.0 size=  2048kB\n\n✓ Finished in 3.2s\n"
        case "cancel_job":
          return null
        case "history_list":
          return history.filter((r) => r.finishedAt >= (a.since as number))
        case "settings_load":
          return localStorage.getItem("mock-settings-file")
        case "settings_save":
          localStorage.setItem("mock-settings-file", a.json as string)
          return null
        case "history_clear":
          history = []
          return null
        case "preview_command": {
          const name = (a.input as string).split("/").pop()!
          const cmd = `ffmpeg -i ${name} -c:v h264_videotoolbox -q:v 60 -pix_fmt yuv420p -c:a aac -b:a 160k ${name.replace(/\.[^.]+$/, ".mp4")}`
          return { command: cmd, displayCommand: cmd }
        }
        case "plugin:dialog|open":
          return ["/Users/demo/Movies/clip.mov", "/Users/demo/Movies/broken.mp4", "/Users/demo/Pictures/photo.png"]
        default:
          return null
      }
    },
    { shouldMockEvents: true },
  )
}
