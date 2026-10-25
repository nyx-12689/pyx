// Mirrors the serde types in src-tauri/src/{probe,jobs}.rs

export type MediaKind = "image" | "video" | "audio" | "unknown"

export interface MediaInfo {
  path: string
  kind: MediaKind
  size: number
  duration: number | null
  width: number | null
  height: number | null
  videoCodec: string | null
  audioCodec: string | null
  fps: number | null
}

export type DependencyName = "ffmpeg" | "ffprobe" | "magick"

export interface Capability {
  id: string
  label: string
  available: boolean
}

export interface Dependency {
  name: DependencyName
  formula: string
  description: string
  path: string | null
  version: string | null
  source: "homebrew" | "system" | null
  /** A newer Homebrew version, when there is one; null when up to date. */
  latest: string | null
  capabilities: Capability[]
}

export interface DependencyReport {
  dependencies: Dependency[]
  brewPath: string | null
}

export type ImageFormat = "webp" | "avif" | "heic" | "png" | "jpg"
export interface ImageOptions {
  format: ImageFormat
  quality: number
  lossless: boolean
  maxWidth: number | null
  stripMetadata: boolean
}

export type Container = "mp4" | "mov" | "mkv" | "webm"
export type VideoCodec = "h264Hw" | "hevcHw" | "h264" | "vp9" | "av1"
export interface VideoOptions {
  container: Container
  codec: VideoCodec
  quality: number
  maxHeight: number | null
  fps: number | null
  removeAudio: boolean
}

export type AudioFormat = "mp3" | "aac" | "opus" | "flac" | "wav"
export interface AudioOptions {
  format: AudioFormat
  bitrate: number
  normalize: boolean
}

export interface GifOptions {
  fps: number
  width: number
}

export interface StripOptions {
  /** Keep the ICC colour profile, so colours don't shift. */
  keepColorProfile: boolean
}

export type Operation =
  | ({ type: "image" } & ImageOptions)
  | ({ type: "video" } & VideoOptions)
  | ({ type: "audio" } & AudioOptions)
  | ({ type: "gif" } & GifOptions)
  | ({ type: "strip" } & StripOptions)

export type OperationType = Operation["type"]

export interface JobRequest {
  id: string
  toolId: string
  label: string
  input: string
  outputDir: string | null
  operation: Operation
}

export type JobStatus = "queued" | "running" | "progress" | "done" | "error" | "cancelled"

export interface JobEvent {
  id: string
  status: JobStatus
  progress: number | null
  command: string | null
  displayCommand: string | null
  output: string | null
  outputSize: number | null
  error: string | null
  elapsedMs: number | null
}

export interface CommandPreview {
  command: string
  displayCommand: string
}

/** A finished job as saved in history (src-tauri/src/history.rs). */
export interface HistoryRecord {
  id: string
  kind: "tool" | "install"
  subject: string
  label: string
  input: string | null
  inputSize: number | null
  inputKind: MediaKind | null
  inputDuration: number | null
  output: string | null
  outputSize: number | null
  status: "done" | "error" | "cancelled"
  error: string | null
  elapsedMs: number | null
  createdAt: number
  finishedAt: number
  command: string | null
  displayCommand: string | null
}
