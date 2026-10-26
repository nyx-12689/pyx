# Changelog

Every Pyx release, newest first.

Pyx uses [semantic versioning](https://semver.org), starting from 0.0.1. Until version 1.0, things may still change between releases.

---

## 0.1.0

*Released October 25, 2026*

### ✨ New

#### Strip metadata

A new tool that removes hidden details from photos before you share them.

- Removes **EXIF** data: the camera, its settings, and when the photo was taken.
- Removes the **GPS location**.
- Removes **XMP, IPTC** and **comments** added by editing apps.
- Saves a copy named **"name (clean)"** in the same format. Your original isn't touched.
- Turns photos upright and keeps JPEG quality.
- Can keep the **colour profile**, so colours don't shift.

#### Formats wiki

A new **Formats** page, in the sidebar or through ⌘K, explaining every format Pyx works with.

- **19 articles**, in four sections:
  - **Images**: JPEG, PNG, WebP, AVIF, HEIC
  - **Video**: H.264, HEVC, VP9, AV1, MP4, MOV, MKV, WebM
  - **Audio**: MP3, AAC, Opus, FLAC, WAV
  - **GIF**
- Every article follows the same layout:
  - overview
  - when to use it
  - how it works
  - a history timeline
  - who uses it
  - tips
  - related formats
- A side panel with the key facts, ratings at a glance, and where the format opens.

#### New logo and app icon

- The Pyx mark: a **P** whose bowl holds a star.
- A new app icon, with a heavier version so it stays clear at small sizes.
- The mark now appears in the sidebar.
- Logo files and usage notes are in [`docs/brand`](docs/brand/README.md).

### 🛠 Improved

- **Sidebar:** an open tool that isn't pinned now sits apart from your pinned tools, under "Open, not pinned".
- **README:** rewritten, with a clearer roadmap.

### 🐞 Fixed

- After you pin a tool from the sidebar, its unpin button no longer stays visible.

---

## 0.0.1

*Released October 23, 2026*

The first public release.

- **Tools:** convert images, video and audio, and make GIFs, with ffmpeg and ImageMagick.
- **Terminal:** see the real command behind every job, with live progress.
- **Dashboard** and **Activity** history.
- **Dependencies:** checks for ffmpeg and ImageMagick, with one-click Homebrew installs.
- **Pinned tools**, light and dark themes, and the ⌘K command palette.
