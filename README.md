<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/svg/pyx-horizontal-reversed.svg">
  <img src="docs/brand/svg/pyx-horizontal.svg" alt="Pyx" height="80">
</picture>

### A media workbench for your Mac

Drop in images, video or audio, pick a tool, and Pyx does the rest.

[![Latest release](https://img.shields.io/github/v/release/nyx-12689/pyx?label=release&color=2A78D6)](https://github.com/nyx-12689/pyx/releases/latest)
[![macOS 13+](https://img.shields.io/badge/macOS-13%2B-171717)](#install)
[![MIT License](https://img.shields.io/badge/license-MIT-171717)](LICENSE)

[**⬇ Download for macOS**](https://github.com/nyx-12689/pyx/releases/latest)
&nbsp;·&nbsp; [What's new](CHANGELOG.md)
&nbsp;·&nbsp; [Roadmap](#roadmap)
&nbsp;·&nbsp; [Report a bug](https://github.com/nyx-12689/pyx/issues)

</div>

<!-- Add a screenshot here, e.g. ![Pyx](docs/screenshot.png) -->

---

## Why Pyx

Tools like `ffmpeg` and ImageMagick can do almost anything with media files, but they live in the terminal and take years to learn.

Pyx puts them behind a simple window:

- **No commands to learn.** Pick a tool, choose a few options, and press run.
- **Nothing hidden.** Every job shows the exact command Pyx ran, so you can learn from it or reuse it.
- **Fast.** Video uses your Mac's built-in hardware encoders, and many files run at once.

> [!NOTE]
> Pyx is early (v0.1.0). It works, but expect rough edges and changes.

---

## What it does

### Tools

| Tool | What it does |
|---|---|
| **Image format** | Convert to WebP, AVIF, HEIC, JPEG or PNG, and resize |
| **Video format** | Convert to MP4, MOV, MKV or WebM, with H.264, HEVC, VP9 or AV1 |
| **Audio format** | Convert to MP3, AAC, Opus, FLAC or WAV, or pull the sound out of a video |
| **Video to GIF** | Turn short clips into GIFs, with colours picked from each clip |
| **Strip metadata** | Remove the camera details, date and GPS location from photos before sharing |

Drag files or whole folders anywhere onto the window.

### Also inside

- **Terminal**: watch each job's command and progress live.
- **Formats wiki**: a page for every format, explaining what it is, when to use it and where it opens.
- **Dashboard**: what you've processed, space saved, and what failed and why.
- **Activity**: a searchable history of every job.
- **Dependencies**: installs or updates ffmpeg and ImageMagick in one click.
- **Shortcuts**: ⌘K to jump anywhere, ⌘J to open the terminal, and pinned tools in the sidebar.
- Light and dark themes.

---

## Install

Pyx needs **macOS 13 (Ventura) or later**.

**1. Download** the disk image for your Mac from the [latest release](https://github.com/nyx-12689/pyx/releases/latest):

| Your Mac | Download |
|---|---|
| Apple Silicon (M1 and later) | `Pyx_<version>_aarch64.dmg` |
| Intel | `Pyx_<version>_x64.dmg` |
| Not sure | `Pyx_<version>_universal.dmg` (works on both, about twice the size) |

**2. Install.** Open the disk image and drag **Pyx** into **Applications**.

**3. Open it for the first time.** Pyx isn't signed with a paid Apple Developer certificate, so macOS blocks it at first:

1. Open Pyx once, and close the warning.
2. Go to **System Settings → Privacy & Security**.
3. Scroll down and click **Open Anyway**.

You only need to do this once.

**4. Add ffmpeg and ImageMagick.** If they're missing, Pyx offers to install them through [Homebrew](https://brew.sh). Or run this yourself:

```bash
brew install ffmpeg imagemagick
```

---

## Roadmap

Pyx starts as a media workbench and is growing into a general toolbox for your files. Here's the plan, in order.

| Stage | Focus |
|---|---|
| **1. Next** | More formats: SVG, PDF, subtitles and containers |
| **2. Then** | New ways to work: downloads, before and after, shortcuts, updates |
| **3. Later** | Custom tools you build yourself |
| **4. Toward 1.0** | Windows and Linux |

Ideas are welcome in [Issues](https://github.com/nyx-12689/pyx/issues).

### 1. Next: more formats

- **SVG**\
  Render vector graphics to PNG, WebP or AVIF at any size.

- **PDF**\
  Turn pages into images, combine images into a PDF, and shrink large PDFs.

- **Subtitles**\
  Convert between SRT, VTT and ASS. Pull subtitles out of a video, add them as a track, or burn them into the picture.

- **Containers**\
  Switch a video's container, such as MKV to MP4, in seconds and without losing quality. See, keep or remove its audio and subtitle tracks.

- **Video frames and edits**\
  Grab the last frame, or every frame from the last few seconds, and trim clips.

### 2. Then: new ways to work

- **Download from a link**\
  Paste a video or audio link, and Pyx downloads it with [yt-dlp](https://github.com/yt-dlp/yt-dlp) and hands it to any tool.

- **Before and after**\
  Compare the original and the result side by side or with a slider, with the size and quality difference.

- **Keyboard shortcuts**\
  A shortcut for every tool and action, a cheat sheet, and your own key choices.

- **Presets**\
  Save the settings you use often and run them in one click.

- **Updates inside the app**\
  Pyx checks for new versions, shows what's new and installs them itself. You only download it from GitHub once.

### 3. Later: make your own tools

- **Custom tools**\
  Build a tool from your own command, with its options as sliders, switches and menus. It runs, shows progress and keeps history like the built-in tools, and you can share it with others.

### 4. Toward 1.0: Windows and Linux

Pyx is built with [Tauri](https://tauri.app), which already runs on all three systems. A cross-platform Pyx is the goal for version 1.0. It needs:

- **Dependencies without Homebrew**\
  winget or Scoop on Windows, the system's package manager on Linux, or Pyx bundling them itself.

- **Hardware encoding everywhere**\
  NVIDIA, Intel and AMD encoders on Windows and Linux, alongside Apple's on the Mac.

- **Windows that feel native**\
  The right window controls and layout on each system.

- **Installers**\
  Windows and Linux installers, built on GitHub alongside the Mac ones.

---

## Build from source

You'll need:

- macOS 13 or later
- [bun](https://bun.sh)
- [Rust](https://rustup.rs) (stable)
- the Xcode command line tools

Then run:

```bash
bun install
bun run tauri dev
```

### Tests

The backend tests run real conversions on generated clips, so they need ffmpeg and ImageMagick installed:

```bash
cd src-tauri && cargo test
```

### Working on the layout

While `bun run dev` is running, open http://localhost:1420 in a normal browser. It loads a stand-in backend (`src/dev/mock-tauri.ts`) that's handy for layout work and never ships in the app.

<details>
<summary><b>Project layout</b></summary>

<br>

**Backend** (`src-tauri/src/`)

- `tools.rs`: finds ffmpeg, ffprobe, magick and brew (Homebrew paths first, then `PATH`)
- `probe.rs`: media details through ffprobe, and expanding dropped folders
- `jobs.rs`: turns tool options into commands; the job queue and progress
- `logs.rs`: each job's output, and the tidy commands the terminal shows
- `deps.rs`: dependency checks, Homebrew installs and upgrades
- `history.rs`, `settings.rs`: saved job history and preferences

**Frontend** (`src/`)

- `router.tsx`: the pages
- `components/shell/`: sidebar, title bar, ⌘K palette and terminal
- `tools/registry.ts`: the tool catalog
- `store.ts`: app state
- `lib/format-wiki/`: the Formats wiki articles, one file per section

**Other**

- `docs/brand/`: the logo, app icon and usage notes
- `CHANGELOG.md`: every release; the release notes on GitHub are built from it

</details>

---

## License

Pyx is released under the [MIT License](LICENSE).

It builds on Cult UI, shadcn/ui and the Geist fonts, and runs FFmpeg and ImageMagick as separate programs. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
