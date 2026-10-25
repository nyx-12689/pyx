# Changelog

Pyx follows [semantic versioning](https://semver.org), starting from 0.0.1. Until 1.0,
expect changes between versions.

## 0.1.0

### New

- **Strip metadata**: a new tool that removes EXIF (camera, date), GPS location, XMP,
  IPTC and comments from photos before you share them. It saves a "(clean)" copy in the
  same format, turns photos upright, keeps JPEG quality, and can keep the colour profile
  so colours don't shift.
- **Formats wiki**: a new Formats page (sidebar or ⌘K) with an article for each of 19
  formats: JPEG, PNG, WebP, AVIF, HEIC, H.264, HEVC, VP9, AV1, MP4, MOV, MKV, WebM, MP3,
  AAC, Opus, FLAC, WAV and GIF. Every article has the same parts: overview, when to use
  it, how it works, a history timeline, who uses it, tips, related formats, a facts box,
  ratings at a glance and where it opens.
- **New logo and app icon**: the Pyx mark, a P whose bowl holds a star. The app icon
  has a heavier version for small sizes, and the mark appears in the sidebar. Logo
  files and usage notes are in `docs/brand`.

### Improved

- The sidebar shows the open tool apart from your pinned tools when it isn't pinned,
  under "Open, not pinned", so the two can't be confused.
- A rewritten README with a clearer roadmap: SVG, PDF, subtitle and container tools
  next, then downloads from a link, before-and-after comparison, keyboard shortcuts and
  updates inside the app, then custom tools, and Windows and Linux on the way to 1.0.

### Fixed

- After pinning a tool from the sidebar, its unpin button no longer stays visible.

## 0.0.1

The first public release: image, video, audio and GIF conversion with ffmpeg and
ImageMagick, a built-in terminal, the Dashboard, Activity history, dependency checks
with one-click Homebrew installs, pinned tools, light and dark themes and the ⌘K
command palette.
