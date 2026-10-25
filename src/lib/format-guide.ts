// The Formats section pages: an intro and quick picks, plus each format's ratings and
// features, shown in its article's "At a glance" box. The articles themselves live in
// format-wiki/, under the same id as their row here.
// Ratings run 1–5 where more is always better (5 = smallest files, fastest, most compatible).

export type Rating = 1 | 2 | 3 | 4 | 5
/** true / false, or a short note when the answer is "partly" (e.g. "Safari only"). */
export type Mark = boolean | string

export type Column =
  | { key: string; label: string; kind: "rating" }
  | { key: string; label: string; kind: "mark" }
  | { key: string; label: string; kind: "text" }

export interface FormatRow {
  id: string
  name: string
  /** File extension, shown as a chip. */
  ext: string
  summary: string
  values: Record<string, Rating | Mark | string>
}

export interface ComparisonTable {
  title?: string
  intro?: string
  columns: Column[]
  rows: FormatRow[]
  footnote?: string
}

export interface GuideSection {
  id: "images" | "video" | "audio" | "gif"
  label: string
  intro: string
  /** Quick answers: a use and the format to pick for it. */
  picks: { use: string; pick: string }[]
  tables: ComparisonTable[]
  /** Short practical tips, shown instead of format cards when set. */
  tips?: string[]
  /** Tools that make these formats. */
  toolIds: string[]
}

const IMAGE_COLUMNS: Column[] = [
  { key: "size", label: "Small files", kind: "rating" },
  { key: "compat", label: "Opens anywhere", kind: "rating" },
  { key: "speed", label: "Fast to save", kind: "rating" },
  { key: "alpha", label: "Transparency", kind: "mark" },
  { key: "anim", label: "Animation", kind: "mark" },
  { key: "hdr", label: "HDR & wide colour", kind: "mark" },
  { key: "lossless", label: "Lossless", kind: "mark" },
]

const IMAGES: GuideSection = {
  id: "images",
  label: "Images",
  intro:
    "Most image formats trade file size for compatibility. Older formats open everywhere but make bigger files; newer ones are much smaller but some apps can't open them yet.",
  picks: [
    { use: "Sharing a photo with anyone", pick: "JPEG" },
    { use: "Images for a website", pick: "WebP" },
    { use: "Screenshots, logos, text", pick: "PNG" },
    { use: "The smallest possible file", pick: "AVIF" },
  ],
  toolIds: ["convert.image", "metadata.strip"],
  tables: [
    {
      columns: IMAGE_COLUMNS,
      rows: [
        {
          id: "jpg",
          name: "JPEG",
          ext: ".jpg",
          summary: "The universal photo format",
          values: { size: 2, compat: 5, speed: 5, alpha: false, anim: false, hdr: false, lossless: false },
        },
        {
          id: "png",
          name: "PNG",
          ext: ".png",
          summary: "Every pixel kept exactly",
          values: { size: 1, compat: 5, speed: 4, alpha: true, anim: "Rarely", hdr: "16-bit", lossless: true },
        },
        {
          id: "webp",
          name: "WebP",
          ext: ".webp",
          summary: "Google's format for the web",
          values: { size: 4, compat: 4, speed: 4, alpha: true, anim: true, hdr: false, lossless: true },
        },
        {
          id: "avif",
          name: "AVIF",
          ext: ".avif",
          summary: "The smallest, newest web format",
          values: { size: 5, compat: 3, speed: 2, alpha: true, anim: true, hdr: true, lossless: true },
        },
        {
          id: "heic",
          name: "HEIC",
          ext: ".heic",
          summary: "What iPhones shoot",
          values: { size: 4, compat: 2, speed: 3, alpha: true, anim: "Rarely", hdr: true, lossless: false },
        },
      ],
    },
  ],
}

const VIDEO: GuideSection = {
  id: "video",
  label: "Video",
  intro:
    "A video file has two layers. The container is the file itself, like a box (MP4, MOV). The codec is how the picture inside is compressed (H.264, HEVC). The codec decides size and quality; the container decides where it plays.",
  picks: [
    { use: "Plays on everything", pick: "MP4 · H.264" },
    { use: "Small, for Apple devices", pick: "MP4 · HEVC" },
    { use: "Video on a web page", pick: "WebM · VP9" },
    { use: "Smallest for archiving", pick: "MKV · AV1" },
  ],
  toolIds: ["convert.video"],
  tables: [
    {
      title: "Codecs",
      intro: "How the picture is compressed.",
      columns: [
        { key: "size", label: "Small files", kind: "rating" },
        { key: "speed", label: "Fast to make", kind: "rating" },
        { key: "compat", label: "Plays anywhere", kind: "rating" },
        { key: "hdr", label: "HDR", kind: "mark" },
        { key: "hw", label: "Mac hardware encoding", kind: "mark" },
        { key: "containers", label: "Goes in", kind: "text" },
      ],
      footnote:
        "Speed is for this Mac's media engine where it can encode the codec. Pyx also offers H.264 in software (x264): slower, but smaller files.",
      rows: [
        {
          id: "h264",
          name: "H.264",
          ext: "AVC",
          summary: "The most compatible codec",
          values: { size: 2, speed: 5, compat: 5, hdr: false, hw: true, containers: "MP4, MOV, MKV" },
        },
        {
          id: "hevc",
          name: "HEVC",
          ext: "H.265",
          summary: "Half the size of H.264",
          values: { size: 4, speed: 5, compat: 4, hdr: true, hw: true, containers: "MP4, MOV, MKV" },
        },
        {
          id: "vp9",
          name: "VP9",
          ext: "VP9",
          summary: "Google's open codec",
          values: { size: 4, speed: 2, compat: 3, hdr: true, hw: false, containers: "WebM, MKV" },
        },
        {
          id: "av1",
          name: "AV1",
          ext: "AV1",
          summary: "The smallest files",
          values: { size: 5, speed: 2, compat: 3, hdr: true, hw: false, containers: "MKV, WebM, MP4" },
        },
      ],
    },
    {
      title: "Containers",
      intro: "The file that holds the video, its sound and any subtitles.",
      columns: [
        { key: "apple", label: "Apple apps", kind: "mark" },
        { key: "web", label: "Browsers", kind: "mark" },
        { key: "other", label: "Windows & Android", kind: "mark" },
        { key: "tracks", label: "Subtitles & extra tracks", kind: "mark" },
        { key: "codecs", label: "Holds", kind: "text" },
      ],
      rows: [
        {
          id: "mp4",
          name: "MP4",
          ext: ".mp4",
          summary: "The standard video file",
          values: { apple: true, web: true, other: true, tracks: "Basic", codecs: "H.264, HEVC, AV1" },
        },
        {
          id: "mov",
          name: "MOV",
          ext: ".mov",
          summary: "Apple's QuickTime file",
          values: { apple: true, web: "Safari", other: "Partly", tracks: true, codecs: "H.264, HEVC, ProRes" },
        },
        {
          id: "mkv",
          name: "MKV",
          ext: ".mkv",
          summary: "Holds almost anything",
          values: { apple: "VLC, IINA", web: "Partly", other: true, tracks: true, codecs: "Almost any codec" },
        },
        {
          id: "webm",
          name: "WebM",
          ext: ".webm",
          summary: "Open video for the web",
          values: { apple: "Safari", web: true, other: true, tracks: "Basic", codecs: "VP9, AV1 + Opus" },
        },
      ],
    },
  ],
}

const AUDIO: GuideSection = {
  id: "audio",
  label: "Audio",
  intro:
    "Lossy formats (MP3, AAC, Opus) throw away sounds you're unlikely to hear, to make small files. Lossless formats (FLAC, WAV) keep everything, at five to ten times the size.",
  picks: [
    { use: "Plays on everything", pick: "MP3" },
    { use: "Voice and podcasts, tiny", pick: "Opus" },
    { use: "Keep music without loss", pick: "FLAC" },
    { use: "Editing and mixing", pick: "WAV" },
  ],
  toolIds: ["convert.audio"],
  tables: [
    {
      columns: [
        { key: "perMinute", label: "One minute is about", kind: "text" },
        { key: "size", label: "Small files", kind: "rating" },
        { key: "compat", label: "Plays anywhere", kind: "rating" },
        { key: "lossless", label: "Lossless", kind: "mark" },
        { key: "editing", label: "Good for editing", kind: "mark" },
      ],
      footnote: "Sizes are for stereo at settings that sound clean to most people (MP3 192 kbps, AAC 160 kbps, Opus 128 kbps).",
      rows: [
        {
          id: "mp3",
          name: "MP3",
          ext: ".mp3",
          summary: "The universal audio format",
          values: { perMinute: "1.4 MB", size: 3, compat: 5, lossless: false, editing: false },
        },
        {
          id: "aac",
          name: "AAC",
          ext: ".m4a",
          summary: "Better than MP3 at the same size",
          values: { perMinute: "1.2 MB", size: 4, compat: 5, lossless: false, editing: false },
        },
        {
          id: "opus",
          name: "Opus",
          ext: ".opus",
          summary: "Best quality at small sizes",
          values: { perMinute: "1.0 MB", size: 5, compat: 3, lossless: false, editing: false },
        },
        {
          id: "flac",
          name: "FLAC",
          ext: ".flac",
          summary: "Lossless, half the size of WAV",
          values: { perMinute: "5 MB", size: 2, compat: 3, lossless: true, editing: "Most apps" },
        },
        {
          id: "wav",
          name: "WAV",
          ext: ".wav",
          summary: "Raw, uncompressed audio",
          values: { perMinute: "10 MB", size: 1, compat: 5, lossless: true, editing: true },
        },
      ],
    },
  ],
}

const GIF: GuideSection = {
  id: "gif",
  label: "GIF",
  intro:
    "GIF dates from 1987 and is still the easiest way to share a short loop: it plays by itself, everywhere, even in email. But it has only 256 colours per frame and no sound, and files grow fast. Where a site accepts video, a short MP4 is usually five to ten times smaller.",
  picks: [
    { use: "Email and chat, plays anywhere", pick: "GIF" },
    { use: "Smallest file, with sound", pick: "MP4" },
    { use: "Loop with transparency, web", pick: "Animated WebP" },
  ],
  toolIds: ["convert.gif", "convert.video"],
  tips: [
    "Keep it short: a few seconds is plenty for a loop.",
    "480 px wide is enough for chat; every step up in width adds a lot of size.",
    "10–15 frames per second still looks smooth and makes a much smaller file.",
    "Pyx builds a palette from each clip, so its 256 colours are the right ones.",
  ],
  tables: [
    {
      columns: [
        { key: "colours", label: "Colours", kind: "text" },
        { key: "size", label: "Small files", kind: "rating" },
        { key: "compat", label: "Plays anywhere", kind: "rating" },
        { key: "loops", label: "Loops by itself", kind: "mark" },
        { key: "sound", label: "Sound", kind: "mark" },
        { key: "alpha", label: "Transparency", kind: "mark" },
      ],
      rows: [
        {
          id: "gif",
          name: "GIF",
          ext: ".gif",
          summary: "The classic loop",
          values: { colours: "256 per frame", size: 1, compat: 5, loops: true, sound: false, alpha: "On or off" },
        },
      ],
    },
  ],
}

export const GUIDE: GuideSection[] = [IMAGES, VIDEO, AUDIO, GIF]
export type GuideSectionId = GuideSection["id"]
