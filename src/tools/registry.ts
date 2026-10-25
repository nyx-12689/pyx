import type { ComponentType } from "react"
import { AudioLines, Clapperboard, EyeOff, Film, ImageIcon, type LucideIcon, Repeat, Tags } from "lucide-react"

import type { DependencyName, MediaKind, OperationType } from "@/lib/types"
import { AudioOptionsForm, GifOptionsForm, ImageOptionsForm, StripOptionsForm, VideoOptionsForm } from "@/tools/options"

// v0.1 keeps tool definitions in the frontend. In v0.2 they move to a Rust
// registry with parameter schemas, and this file shrinks to icons and forms.

export type ToolCategory = "convert" | "frames" | "edit" | "audio" | "metadata" | "inspect"

export const CATEGORIES: { id: ToolCategory; label: string; icon: LucideIcon }[] = [
  { id: "convert", label: "Convert", icon: Repeat },
  { id: "frames", label: "Frames", icon: Clapperboard },
  { id: "edit", label: "Edit", icon: Film },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "metadata", label: "Metadata", icon: Tags },
]

export interface ToolDef {
  id: string
  name: string
  description: string
  category: ToolCategory
  icon: LucideIcon
  accepts: MediaKind[]
  operation: OperationType
  requires: DependencyName
  Options: ComponentType
}

export const TOOLS: ToolDef[] = [
  {
    id: "convert.image",
    name: "Image format",
    description: "Convert images to WebP, AVIF, HEIC, JPEG or PNG, optionally resized.",
    category: "convert",
    icon: ImageIcon,
    accepts: ["image"],
    operation: "image",
    requires: "magick",
    Options: ImageOptionsForm,
  },
  {
    id: "convert.video",
    name: "Video format",
    description: "Re-encode video to MP4, MOV, MKV or WebM with hardware or software codecs.",
    category: "convert",
    icon: Film,
    accepts: ["video"],
    operation: "video",
    requires: "ffmpeg",
    Options: VideoOptionsForm,
  },
  {
    id: "convert.audio",
    name: "Audio format",
    description: "Convert audio, or pull the soundtrack out of a video, with optional loudness normalizing.",
    category: "convert",
    icon: AudioLines,
    accepts: ["audio", "video"],
    operation: "audio",
    requires: "ffmpeg",
    Options: AudioOptionsForm,
  },
  {
    id: "convert.gif",
    name: "Video to GIF",
    description: "Turn a short clip into a GIF with a palette built from the clip itself.",
    category: "convert",
    icon: Repeat,
    accepts: ["video"],
    operation: "gif",
    requires: "ffmpeg",
    Options: GifOptionsForm,
  },
  {
    id: "metadata.strip",
    name: "Strip metadata",
    description: "Remove EXIF, GPS location and other hidden details from photos before you share them.",
    category: "metadata",
    icon: EyeOff,
    accepts: ["image"],
    operation: "strip",
    requires: "magick",
    Options: StripOptionsForm,
  },
]

export const toolById = (id: string) => TOOLS.find((t) => t.id === id)

/** Categories that have at least one tool, for navigation. */
export const activeCategories = () => CATEGORIES.filter((c) => TOOLS.some((t) => t.category === c.id))
