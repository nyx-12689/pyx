<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/svg/pyx-horizontal-reversed.svg">
    <img src="docs/brand/svg/pyx-horizontal.svg" alt="Pyx" height="72">
  </picture>
</h1>

**A media workbench for your Mac.** Drop in images, video or audio, pick a tool, and Pyx
runs the right `ffmpeg` or ImageMagick command for you, showing exactly what it ran.
No command line to learn, nothing hidden.

<!-- Add a screenshot here, e.g. ![Pyx](docs/screenshot.png) -->

[**Download for macOS**](https://github.com/nyx-12689/pyx/releases/latest) ·
[What's new](CHANGELOG.md) · [Roadmap](#roadmap) · [Report a bug](../../issues)

> Pyx is early (v0.1.0). It works, but expect rough edges and changes.

## What it does

| Tool | What it does |
|---|---|
| **Convert images** | WebP, AVIF, HEIC, JPEG and PNG, with resizing |
| **Convert video** | MP4, MOV, MKV and WebM, with H.264, HEVC, VP9 or AV1, using your Mac's hardware encoders |
| **Convert audio** | MP3, AAC, Opus, FLAC and WAV, or pull the soundtrack out of a video, with loudness normalizing |
| **Make GIFs** | from short clips, with a colour palette built from each clip |
| **Strip metadata** | remove EXIF, GPS location and other hidden details from photos before you share them |

Drag files or whole folders anywhere onto the window, and run as many as you like at once.

**Also inside:**

- **See every command.** Each job shows the real command it runs, with live progress, in
  a built-in terminal.
- **Formats wiki.** An article for every format Pyx works with: what it is, when to use
  it, how it works, its history and where it opens.
- **Dashboard.** What you've processed, space saved, how long jobs take, what failed and
  why, and a calendar of your activity.
- **Activity.** A searchable history of every job, with its command and files.
- **Dependencies.** Checks for ffmpeg and ImageMagick, and installs or updates them with
  Homebrew in one click.
- **Made for speed.** Pin the tools you use most, jump anywhere with ⌘K, open the
  terminal with ⌘J. Light and dark themes.

## Install

Download the latest version from the
[Releases page](https://github.com/nyx-12689/pyx/releases/latest). It needs macOS 13
or later.

| Your Mac | Download |
|---|---|
| Apple Silicon (M1 and later) | `Pyx_<version>_aarch64.dmg` |
| Intel | `Pyx_<version>_x64.dmg` |
| Not sure | `Pyx_<version>_universal.dmg` (works on both, about twice the size) |

Open the disk image and drag Pyx into Applications.

**First launch:** Pyx isn't signed with a paid Apple Developer certificate, so macOS
blocks it the first time. Open it once, then go to **System Settings → Privacy &
Security** and click **Open Anyway**. You only need to do this once.

**ffmpeg and ImageMagick:** if they're missing, Pyx offers to install them through
[Homebrew](https://brew.sh). Or run:

```bash
brew install ffmpeg imagemagick
```

## Roadmap

Pyx starts as a media workbench and is growing into a general toolbox for working with
files. Here's the plan, in order. Ideas are welcome in [Issues](../../issues).

### Next: more formats

- **SVG**: render vector graphics to PNG, WebP or AVIF at any size.
- **PDF**: turn pages into images, combine images into a PDF, and shrink large PDFs.
- **Subtitles**: convert between SRT, VTT and ASS, pull subtitles out of a video, add them
  as a track, or burn them into the picture.
- **Containers**: switch a video's container (MKV to MP4, for example) in seconds without
  re-encoding, and see, keep or remove its audio and subtitle tracks.
- **Video frames and edits**: grab the last frame, or every frame from the last few
  seconds; trim clips.

### Then: new ways to work

- **Download from a link**: paste a video or audio link and Pyx downloads it with
  [yt-dlp](https://github.com/yt-dlp/yt-dlp), then hands it to any tool.
- **Before and after**: compare the original and the result side by side or with a
  slider, with the size and quality difference.
- **Keyboard shortcuts**: a shortcut for every tool and action, a cheat sheet, and your
  own key choices.
- **Presets**: save the settings you use often and run them in one click.
- **Updates inside the app**: Pyx checks for new versions, shows what's new, and installs
  them itself, so you only download it from GitHub once.

### Later: make your own tools

- **Custom tools**: build a tool from your own command, with its options as sliders,
  switches and menus. It runs, shows progress and keeps history like the built-in ones,
  and you can share it with others.

### Toward 1.0: Windows and Linux

Pyx is built with [Tauri](https://tauri.app), which runs on all three systems, so a
cross-platform Pyx is the goal for 1.0, not a someday. What it takes:

- **Installing dependencies without Homebrew**: winget or Scoop on Windows, the system
  package manager on Linux, or Pyx bundling them itself.
- **Hardware encoding everywhere**: NVIDIA, Intel and AMD encoders on Windows and Linux,
  alongside Apple's on the Mac.
- **Native-feeling windows** on each system, rather than macOS controls everywhere.
- **Installers for Windows and Linux**, built on GitHub alongside the Mac ones.

## Build from source

You'll need macOS 13 or later, [bun](https://bun.sh), [Rust](https://rustup.rs)
(stable) and the Xcode command line tools.

```bash
bun install
bun run tauri dev
```

The backend tests run real conversions on generated clips, so they need ffmpeg and
ImageMagick installed:

```bash
cd src-tauri && cargo test
```

While `bun run dev` is running, opening http://localhost:1420 in a normal browser loads a
mock backend (`src/dev/mock-tauri.ts`), which is handy for layout work. It's never part
of the real app.

<details>
<summary>Project layout</summary>

- `src-tauri/src/tools.rs`: finds ffmpeg, ffprobe, magick and brew (Homebrew paths first, then `PATH`)
- `src-tauri/src/probe.rs`: media details via ffprobe, folder expansion
- `src-tauri/src/jobs.rs`: tool options turned into commands; the job queue and progress events
- `src-tauri/src/logs.rs`: each job's raw output, and the tidy commands the terminal shows
- `src-tauri/src/deps.rs`: dependency checks (versions, encoders, formats), Homebrew installs and upgrades
- `src-tauri/src/history.rs`, `settings.rs`: saved job history and preferences
- `src/router.tsx`: pages (Dashboard, Tools, tool pages, Activity, Formats, Dependencies, Settings)
- `src/components/shell/`: sidebar, title bar, ⌘K palette, terminal
- `src/tools/registry.ts`: the tool catalog; `src/store.ts`: app state
- `src/lib/format-wiki/`: the Formats wiki articles, one file per section
- `docs/brand/`: the logo, app icon and usage notes (`build_kit.py` regenerates them)

</details>

## License

Pyx is released under the [MIT License](LICENSE). It builds on Cult UI, shadcn/ui
and the Geist fonts, and runs FFmpeg and ImageMagick as separate programs; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
