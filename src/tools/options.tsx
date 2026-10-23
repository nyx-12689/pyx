import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import type { AudioFormat, Container, ImageFormat, VideoCodec } from "@/lib/types"
import { useApp } from "@/store"

// ---------------------------------------------------------------------------
// Small form building blocks

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-foreground text-xs font-medium">{label}</Label>
        {hint && <span className="text-muted-foreground text-xs tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Choice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Select for an optional number, where "original" means null. */
function NumberChoice({
  value,
  onChange,
  options,
  originalLabel = "Original",
}: {
  value: number | null
  onChange: (value: number | null) => void
  options: { value: number; label: string }[]
  originalLabel?: string
}) {
  return (
    <Choice
      value={value === null ? "original" : String(value)}
      onChange={(v) => onChange(v === "original" ? null : Number(v))}
      options={[
        { value: "original", label: originalLabel },
        ...options.map((o) => ({ value: String(o.value), label: o.label })),
      ]}
    />
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-foreground text-xs font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

function QualitySlider({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <Field label="Quality" hint={disabled ? "Lossless" : String(value)}>
      <Slider min={1} max={100} step={1} value={[value]} onValueChange={([v]) => onChange(v)} disabled={disabled} />
    </Field>
  )
}

// ---------------------------------------------------------------------------
// Panels

export function ImageOptionsForm() {
  const o = useApp((s) => s.options.image)
  const set = useApp((s) => s.setOptions)
  const update = (patch: Partial<typeof o>) => set("image", patch)
  const supportsLossless = o.format === "webp"

  return (
    <div className="space-y-4 p-3">
      <Field label="Format">
        <Choice<ImageFormat>
          value={o.format}
          onChange={(format) => update({ format })}
          options={[
            { value: "webp", label: "WebP" },
            { value: "avif", label: "AVIF" },
            { value: "heic", label: "HEIC" },
            { value: "jpg", label: "JPEG" },
            { value: "png", label: "PNG (lossless)" },
          ]}
        />
      </Field>
      {o.format !== "png" && (
        <QualitySlider
          value={o.quality}
          onChange={(quality) => update({ quality })}
          disabled={supportsLossless && o.lossless}
        />
      )}
      <Field label="Max width">
        <NumberChoice
          value={o.maxWidth}
          onChange={(maxWidth) => update({ maxWidth })}
          options={[3840, 2560, 1920, 1280, 1024, 800, 512].map((w) => ({ value: w, label: `${w}px` }))}
        />
      </Field>
      {supportsLossless && <Toggle label="Lossless" checked={o.lossless} onChange={(lossless) => update({ lossless })} />}
      <Toggle
        label="Strip metadata (EXIF, GPS)"
        checked={o.stripMetadata}
        onChange={(stripMetadata) => update({ stripMetadata })}
      />
    </div>
  )
}

const CODECS: { value: VideoCodec; label: string; webm: boolean }[] = [
  { value: "h264Hw", label: "H.264 · Apple hardware (fast)", webm: false },
  { value: "hevcHw", label: "HEVC · Apple hardware (fast)", webm: false },
  { value: "h264", label: "H.264 · x264 (best compatibility)", webm: false },
  { value: "vp9", label: "VP9", webm: true },
  { value: "av1", label: "AV1 · SVT (smallest, slow)", webm: true },
]

export function VideoOptionsForm() {
  const o = useApp((s) => s.options.video)
  const set = useApp((s) => s.setOptions)
  const update = (patch: Partial<typeof o>) => set("video", patch)
  const codecs = o.container === "webm" ? CODECS.filter((c) => c.webm) : CODECS

  const setContainer = (container: Container) => {
    const valid = container !== "webm" || CODECS.find((c) => c.value === o.codec)?.webm
    update({ container, codec: valid ? o.codec : "vp9" })
  }

  return (
    <div className="space-y-4 p-3">
      <Field label="Container">
        <Choice<Container>
          value={o.container}
          onChange={setContainer}
          options={[
            { value: "mp4", label: "MP4" },
            { value: "mov", label: "MOV" },
            { value: "mkv", label: "MKV" },
            { value: "webm", label: "WebM" },
          ]}
        />
      </Field>
      <Field label="Codec">
        <Choice<VideoCodec> value={o.codec} onChange={(codec) => update({ codec })} options={codecs} />
      </Field>
      <QualitySlider value={o.quality} onChange={(quality) => update({ quality })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Max height">
          <NumberChoice
            value={o.maxHeight}
            onChange={(maxHeight) => update({ maxHeight })}
            options={[2160, 1440, 1080, 720, 480].map((h) => ({ value: h, label: `${h}p` }))}
          />
        </Field>
        <Field label="Frame rate">
          <NumberChoice
            value={o.fps}
            onChange={(fps) => update({ fps })}
            options={[60, 30, 24].map((f) => ({ value: f, label: `${f} fps` }))}
          />
        </Field>
      </div>
      <Toggle label="Remove audio" checked={o.removeAudio} onChange={(removeAudio) => update({ removeAudio })} />
    </div>
  )
}

export function AudioOptionsForm() {
  const o = useApp((s) => s.options.audio)
  const set = useApp((s) => s.setOptions)
  const update = (patch: Partial<typeof o>) => set("audio", patch)
  const lossless = o.format === "flac" || o.format === "wav"

  return (
    <div className="space-y-4 p-3">
      <Field label="Format">
        <Choice<AudioFormat>
          value={o.format}
          onChange={(format) => update({ format })}
          options={[
            { value: "mp3", label: "MP3" },
            { value: "aac", label: "AAC (.m4a)" },
            { value: "opus", label: "Opus" },
            { value: "flac", label: "FLAC (lossless)" },
            { value: "wav", label: "WAV (uncompressed)" },
          ]}
        />
      </Field>
      {!lossless && (
        <Field label="Bitrate" hint={`${o.bitrate} kbps`}>
          <Slider min={64} max={320} step={32} value={[o.bitrate]} onValueChange={([bitrate]) => update({ bitrate })} />
        </Field>
      )}
      <Toggle label="Normalize loudness (−16 LUFS)" checked={o.normalize} onChange={(normalize) => update({ normalize })} />
      <p className="text-muted-foreground text-xs">Video files are accepted too; their audio track is extracted.</p>
    </div>
  )
}

export function GifOptionsForm() {
  const o = useApp((s) => s.options.gif)
  const set = useApp((s) => s.setOptions)
  const update = (patch: Partial<typeof o>) => set("gif", patch)

  return (
    <div className="space-y-4 p-3">
      <Field label="Width" hint={`${o.width}px`}>
        <Slider min={160} max={1280} step={16} value={[o.width]} onValueChange={([width]) => update({ width })} />
      </Field>
      <Field label="Frame rate" hint={`${o.fps} fps`}>
        <Slider min={5} max={30} step={1} value={[o.fps]} onValueChange={([fps]) => update({ fps })} />
      </Field>
      <p className="text-muted-foreground text-xs">
        Converts video files to GIF using a palette built from each clip. Keep clips short — GIFs get large fast.
      </p>
    </div>
  )
}
