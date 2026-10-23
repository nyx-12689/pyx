# Pyx

A media workbench for macOS. Drop in images, video or audio, pick a tool, and Pyx
runs the right `ffmpeg` or ImageMagick command for you, showing exactly what it ran
in a built-in terminal.

<!-- Add a screenshot here, e.g. ![Pyx](docs/screenshot.png) -->

> Pyx is early (v0.0.1). It works, but expect rough edges and changes.

## Features

- **Tools**: convert images (WebP, AVIF, HEIC, JPEG, PNG), re-encode video (with
  Apple hardware encoders), convert or extract audio, and turn clips into GIFs.
  Drag files or whole folders anywhere onto the window.
- **See the command**: every job shows the real command it runs, with live progress,
  in a terminal you can open from the corner button.
- **Dashboard**: what you've processed, space saved, how long jobs take, what failed
  and why, and a calendar of your activity.
- **Activity**: the history of every job, searchable, with its command and files.
- **Dependencies**: checks which tools are installed and can install or update them
  with Homebrew in one click.
- Pinned tools, light and dark themes, and a ⌘K command palette.

## Install

There's no packaged download yet. To run Pyx, build it from source (below).

Pyx needs **ffmpeg** and **ImageMagick**. If they're missing, Pyx offers to install
them through [Homebrew](https://brew.sh), or you can run:

```bash
brew install ffmpeg imagemagick
```

## Build from source

You'll need macOS 13 or later, [bun](https://bun.sh), [Rust](https://rustup.rs)
(stable) and the Xcode command line tools.

```bash
bun install
bun run tauri dev
```

Backend tests run real conversions against generated clips (they need ffmpeg and
ImageMagick installed):

```bash
cd src-tauri && cargo test
```

Opening http://localhost:1420 in a normal browser while `bun run dev` is running
loads a mock backend (`src/dev/mock-tauri.ts`), which is handy for layout work. It's
never part of the real app.

## Roadmap

- **More tools**: extract the last frame of a video, or every frame from its last
  few seconds; trimming and other edits; more audio tools.
- **Windows and Linux**: find and install ffmpeg and ImageMagick without Homebrew,
  and adapt the window chrome for each platform.
- **Downloads**: signed, notarized macOS builds, then installers for the other
  platforms, with automatic updates.
- Real progress for image jobs, and saved presets for tools you use often.

Ideas and bug reports are welcome in [Issues](../../issues).

## Project layout

- `src-tauri/src/tools.rs`: finds ffmpeg, ffprobe, magick and brew (Homebrew paths first, then `PATH`)
- `src-tauri/src/probe.rs`: media details via ffprobe, folder expansion
- `src-tauri/src/jobs.rs`: tool options turned into commands; the job queue and progress events
- `src-tauri/src/logs.rs`: each job's raw output, and the tidy commands the terminal shows
- `src-tauri/src/deps.rs`: dependency checks (versions, encoders, formats), Homebrew installs and upgrades
- `src-tauri/src/history.rs`, `settings.rs`: saved job history and preferences
- `src/router.tsx`: pages (Dashboard, Tools, tool pages, Activity, Dependencies, Settings)
- `src/components/shell/`: sidebar, title bar, ⌘K palette, terminal
- `src/tools/registry.ts`: the tool catalog; `src/store.ts`: app state

## License

Pyx is released under the [MIT License](LICENSE). It builds on Cult UI, shadcn/ui
and the Geist fonts, and runs FFmpeg and ImageMagick as separate programs; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
