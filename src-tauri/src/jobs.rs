//! Conversion jobs: turns a typed [`Operation`] into an ffmpeg or magick
//! command, runs it with a concurrency limit, and reports progress to the UI
//! through the `job` event. Raw output is kept in [`logs`].

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, BufReader};
use tokio::sync::{oneshot, Semaphore};

use crate::history::{self, History, Record};
use crate::logs;
use crate::probe;
use crate::tools::{self, Tool};

/// How many conversions run at once. ffmpeg already uses every core per job,
/// so going higher mostly adds memory pressure.
const MAX_CONCURRENT_JOBS: usize = 3;
const STDERR_TAIL_LINES: usize = 12;

// ---------------------------------------------------------------------------
// Options sent from the UI

#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Operation {
    Image(ImageOptions),
    Video(VideoOptions),
    Audio(AudioOptions),
    Gif(GifOptions),
}

#[derive(Deserialize, Debug, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum ImageFormat {
    Webp,
    Avif,
    Heic,
    Png,
    Jpg,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageOptions {
    format: ImageFormat,
    /// 1–100
    quality: u8,
    lossless: bool,
    max_width: Option<u32>,
    strip_metadata: bool,
}

#[derive(Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Container {
    Mp4,
    Mov,
    Mkv,
    Webm,
}

#[derive(Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum VideoCodec {
    /// Apple VideoToolbox hardware encoders
    H264Hw,
    HevcHw,
    /// Software encoders
    H264,
    Vp9,
    Av1,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoOptions {
    container: Container,
    codec: VideoCodec,
    /// 1–100, mapped onto each encoder's own quality scale
    quality: u8,
    max_height: Option<u32>,
    fps: Option<f64>,
    remove_audio: bool,
}

#[derive(Deserialize, Debug, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum AudioFormat {
    Mp3,
    Aac,
    Opus,
    Flac,
    Wav,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AudioOptions {
    format: AudioFormat,
    /// kbps, ignored for lossless formats
    bitrate: u32,
    normalize: bool,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GifOptions {
    fps: u32,
    width: u32,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct JobRequest {
    id: String,
    tool_id: String,
    label: String,
    input: String,
    output_dir: Option<String>,
    operation: Operation,
}

// ---------------------------------------------------------------------------
// Events sent to the UI

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct JobEvent {
    id: String,
    status: &'static str,
    progress: Option<f64>,
    /// The full command line and a tidied one for display, sent with `queued`.
    command: Option<String>,
    display_command: Option<String>,
    output: Option<String>,
    output_size: Option<u64>,
    error: Option<String>,
    elapsed_ms: Option<u64>,
}

impl JobEvent {
    fn new(id: &str, status: &'static str) -> Self {
        Self { id: id.to_string(), status, ..Default::default() }
    }
}

// ---------------------------------------------------------------------------
// State

pub struct Jobs {
    limit: Arc<Semaphore>,
    cancels: Mutex<HashMap<String, oneshot::Sender<()>>>,
    /// Output paths claimed by queued/running jobs, so two inputs with the same
    /// stem (photo.png, photo.jpg → photo.webp) don't write over each other.
    reserved: Arc<Mutex<HashSet<PathBuf>>>,
}

impl Default for Jobs {
    fn default() -> Self {
        Self {
            limit: Arc::new(Semaphore::new(MAX_CONCURRENT_JOBS)),
            cancels: Mutex::new(HashMap::new()),
            reserved: Arc::new(Mutex::new(HashSet::new())),
        }
    }
}

pub struct Plan {
    pub tool: Tool,
    pub args: Vec<String>,
    /// The file the job writes; removed again if the job doesn't succeed.
    pub output: Option<PathBuf>,
    /// For ffmpeg: the input whose duration turns `-progress` output into a percentage.
    /// stdout carries progress data then, so it isn't shown in the terminal.
    pub progress_input: Option<PathBuf>,
}

// ---------------------------------------------------------------------------
// Commands

#[tauri::command]
pub async fn start_job(app: AppHandle, jobs: State<'_, Jobs>, request: JobRequest) -> Result<(), String> {
    let input = PathBuf::from(&request.input);
    if !input.is_file() {
        return Err(format!("{} no longer exists", request.input));
    }
    let plan = {
        let mut reserved = jobs.reserved.lock().unwrap();
        let output = unique_output(&input, request.output_dir.as_deref(), extension(&request.operation), &reserved);
        let plan = build_plan(&input, output.clone(), &request.operation)?;
        reserved.insert(output);
        plan
    };
    let meta = JobMeta { kind: "tool", subject: request.tool_id, label: request.label, input: Some(input) };
    spawn_job(app, &jobs, request.id, plan, meta);
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandPreview {
    command: String,
    display_command: String,
}

/// The command a tool would run for `input` with these options, for the
/// workspace's command preview. Nothing is reserved or run.
#[tauri::command]
pub fn preview_command(input: String, output_dir: Option<String>, operation: Operation) -> Result<CommandPreview, String> {
    let input = PathBuf::from(input);
    let output = unique_output(&input, output_dir.as_deref(), extension(&operation), &HashSet::new());
    let plan = build_plan(&input, output, &operation)?;
    Ok(CommandPreview {
        command: logs::shell_command(plan.tool.binary_name(), &plan.args),
        display_command: logs::display_command(plan.tool.binary_name(), &plan.args),
    })
}

/// What a job is, for its history record.
pub struct JobMeta {
    pub kind: &'static str,
    pub subject: String,
    pub label: String,
    pub input: Option<PathBuf>,
}

#[tauri::command]
pub fn cancel_job(jobs: State<'_, Jobs>, id: String) {
    if let Some(tx) = jobs.cancels.lock().unwrap().remove(&id) {
        let _ = tx.send(());
    }
}

/// Queues a plan; progress, log output and the result arrive as events, and
/// the finished job is saved to history.
pub fn spawn_job(app: AppHandle, jobs: &Jobs, id: String, plan: Plan, meta: JobMeta) {
    let created_at = history::now_ms();
    let (cancel_tx, cancel_rx) = oneshot::channel();
    jobs.cancels.lock().unwrap().insert(id.clone(), cancel_tx);

    let command = logs::shell_command(plan.tool.binary_name(), &plan.args);
    let display_command = logs::display_command(plan.tool.binary_name(), &plan.args);
    logs::append(&app, &id, &format!("$ {command}\n\n"));
    let _ = app.emit(
        "job",
        JobEvent {
            command: Some(command.clone()),
            display_command: Some(display_command.clone()),
            ..JobEvent::new(&id, "queued")
        },
    );

    let limit = jobs.limit.clone();
    let reserved = jobs.reserved.clone();
    tauri::async_runtime::spawn(async move {
        let output = plan.output.clone();
        let duration = match &plan.progress_input {
            Some(input) => probe::duration_of(input).await,
            None => None,
        };
        let event = run(&app, &id, plan, duration, limit, cancel_rx).await;
        if let Some(output) = output {
            if event.status != "done" {
                let _ = std::fs::remove_file(&output);
            }
            reserved.lock().unwrap().remove(&output);
        }
        if let Some(jobs) = app.try_state::<Jobs>() {
            jobs.cancels.lock().unwrap().remove(&id);
        }
        logs::append(&app, &id, &footer(&event));

        let record = Record {
            id: id.clone(),
            kind: meta.kind.to_string(),
            subject: meta.subject,
            label: meta.label,
            input_size: meta.input.as_ref().and_then(|p| std::fs::metadata(p).ok()).map(|m| m.len() as i64),
            input_kind: meta.input.as_deref().map(|p| format!("{:?}", probe::kind_from_path(p)).to_lowercase()),
            input: meta.input.map(|p| p.display().to_string()),
            input_duration: duration,
            output: event.output.clone(),
            output_size: event.output_size.map(|n| n as i64),
            status: event.status.to_string(),
            error: event.error.clone(),
            elapsed_ms: event.elapsed_ms.map(|n| n as i64),
            created_at,
            finished_at: history::now_ms(),
            command: Some(command),
            display_command: Some(display_command),
        };
        if let Some(history) = app.try_state::<History>()
            && let Err(e) = history.insert(&record)
        {
            eprintln!("couldn't save job {id} to history: {e}");
        }
        let _ = app.emit("job", event);
    });
}

fn footer(event: &JobEvent) -> String {
    let secs = event.elapsed_ms.unwrap_or(0) as f64 / 1000.0;
    match event.status {
        "done" => format!("\n✓ Finished in {secs:.1}s\n"),
        "cancelled" => "\n■ Cancelled\n".to_string(),
        _ => format!(
            "\n✗ Failed after {secs:.1}s: {}\n",
            event.error.as_deref().and_then(|e| e.lines().last()).unwrap_or("unknown error"),
        ),
    }
}

// ---------------------------------------------------------------------------
// Running

async fn run(
    app: &AppHandle,
    id: &str,
    plan: Plan,
    duration: Option<f64>,
    limit: Arc<Semaphore>,
    mut cancel: oneshot::Receiver<()>,
) -> JobEvent {
    let _permit = tokio::select! {
        permit = limit.acquire_owned() => permit.expect("semaphore never closes"),
        _ = &mut cancel => return JobEvent::new(id, "cancelled"),
    };

    let started = Instant::now();
    let elapsed = || Some(started.elapsed().as_millis() as u64);
    let fail = |error: String| JobEvent { error: Some(error), elapsed_ms: elapsed(), ..JobEvent::new(id, "error") };

    let _ = app.emit("job", JobEvent::new(id, "running"));

    let mut cmd = match tools::command(plan.tool) {
        Ok(cmd) => cmd,
        Err(e) => return fail(e),
    };
    let mut child = match cmd
        .args(&plan.args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => return fail(format!("Couldn't start {}: {e}", plan.tool.binary_name())),
    };

    // stderr always goes to the terminal; its last lines become the error message.
    let stderr = child.stderr.take().expect("stderr is piped");
    let stderr_task = tokio::spawn(stream_to_log(app.clone(), id.to_string(), stderr));

    let stdout = child.stdout.take().expect("stdout is piped");
    let stdout_task = if plan.progress_input.is_some() {
        tokio::spawn(report_progress(app.clone(), id.to_string(), stdout, duration))
    } else {
        // Tools without progress output (magick, brew) print useful things on stdout.
        let (app, id) = (app.clone(), id.to_string());
        tokio::spawn(async move {
            stream_to_log(app, id, stdout).await;
        })
    };

    let status = tokio::select! {
        status = child.wait() => Some(status),
        _ = &mut cancel => None,
    };
    let Some(status) = status else {
        let _ = child.kill().await;
        stdout_task.abort();
        return JobEvent { elapsed_ms: elapsed(), ..JobEvent::new(id, "cancelled") };
    };
    let _ = stdout_task.await;
    let stderr_tail = stderr_task.await.unwrap_or_default();

    match status {
        Ok(s) if s.success() => JobEvent {
            progress: Some(1.0),
            output: plan.output.as_ref().map(|p| p.display().to_string()),
            output_size: plan.output.as_ref().and_then(|p| std::fs::metadata(p).ok()).map(|m| m.len()),
            elapsed_ms: elapsed(),
            ..JobEvent::new(id, "done")
        },
        Ok(s) => fail(if stderr_tail.is_empty() { format!("Exited with {s}") } else { stderr_tail }),
        Err(e) => fail(e.to_string()),
    }
}

/// Copies a pipe into the job's log as it arrives; returns the last few lines.
async fn stream_to_log(app: AppHandle, id: String, mut pipe: impl AsyncRead + Unpin) -> String {
    let mut buf = [0u8; 8192];
    let mut chunker = logs::Utf8Chunker::default();
    let mut tail = logs::Tail::new(STDERR_TAIL_LINES);
    while let Ok(n) = pipe.read(&mut buf).await {
        if n == 0 {
            break;
        }
        let text = chunker.push(&buf[..n]);
        tail.push(&text);
        logs::append(&app, &id, &text);
    }
    tail.finish()
}

/// ffmpeg's `-progress pipe:1` writes key=value lines to stdout.
async fn report_progress(app: AppHandle, id: String, stdout: impl AsyncRead + Unpin, duration: Option<f64>) {
    let mut lines = BufReader::new(stdout).lines();
    let total = duration.filter(|d| *d > 0.0);
    let mut last_sent = -1.0;
    while let Ok(Some(line)) = lines.next_line().await {
        let Some(total) = total else { continue };
        let Some(us) = line.strip_prefix("out_time_us=").and_then(|v| v.parse::<f64>().ok()) else {
            continue;
        };
        let progress = (us / 1_000_000.0 / total).clamp(0.0, 1.0);
        // Throttle to whole-percent steps so we don't flood the webview.
        if progress - last_sent >= 0.01 {
            last_sent = progress;
            let _ = app.emit("job", JobEvent { progress: Some(progress), ..JobEvent::new(&id, "progress") });
        }
    }
}

// ---------------------------------------------------------------------------
// Building commands

fn extension(op: &Operation) -> &'static str {
    match op {
        Operation::Image(o) => match o.format {
            ImageFormat::Webp => "webp",
            ImageFormat::Avif => "avif",
            ImageFormat::Heic => "heic",
            ImageFormat::Png => "png",
            ImageFormat::Jpg => "jpg",
        },
        Operation::Video(o) => match o.container {
            Container::Mp4 => "mp4",
            Container::Mov => "mov",
            Container::Mkv => "mkv",
            Container::Webm => "webm",
        },
        Operation::Audio(o) => match o.format {
            AudioFormat::Mp3 => "mp3",
            AudioFormat::Aac => "m4a",
            AudioFormat::Opus => "opus",
            AudioFormat::Flac => "flac",
            AudioFormat::Wav => "wav",
        },
        Operation::Gif(_) => "gif",
    }
}

/// `<dir>/<stem>.<ext>`, or `<stem> (2).<ext>` etc. if that's taken.
fn unique_output(input: &Path, output_dir: Option<&str>, ext: &str, reserved: &HashSet<PathBuf>) -> PathBuf {
    let dir = output_dir
        .map(PathBuf::from)
        .or_else(|| input.parent().map(Path::to_path_buf))
        .unwrap_or_default();
    let stem = input.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
    (1..)
        .map(|n| match n {
            1 => dir.join(format!("{stem}.{ext}")),
            n => dir.join(format!("{stem} ({n}).{ext}")),
        })
        .find(|p| p != input && !p.exists() && !reserved.contains(p))
        .expect("infinite iterator")
}

fn build_plan(input: &Path, output: PathBuf, op: &Operation) -> Result<Plan, String> {
    let input_str = input.display().to_string();
    let output_str = output.display().to_string();

    if let Operation::Image(o) = op {
        let args = magick_image_args(&input_str, &output_str, o);
        return Ok(Plan { tool: Tool::Magick, args, output: Some(output), progress_input: None });
    }

    let mut args: Vec<String> =
        ["-hide_banner", "-nostdin", "-y", "-loglevel", "info", "-stats", "-progress", "pipe:1", "-i"]
            .iter()
            .map(|s| s.to_string())
            .collect();
    args.push(input_str);
    match op {
        Operation::Video(o) => args.extend(ffmpeg_video_args(o)?),
        Operation::Audio(o) => args.extend(ffmpeg_audio_args(o)),
        Operation::Gif(o) => args.extend(ffmpeg_gif_args(o)),
        Operation::Image(_) => unreachable!(),
    }
    args.push(output_str);
    Ok(Plan { tool: Tool::Ffmpeg, args, output: Some(output), progress_input: Some(input.to_path_buf()) })
}

fn magick_image_args(input: &str, output: &str, o: &ImageOptions) -> Vec<String> {
    // A leading -verbose makes magick print a read and a write summary line for the terminal.
    let mut args = vec!["-verbose".into(), input.to_string(), "-auto-orient".into()];
    if let Some(w) = o.max_width {
        // `>` only shrinks; smaller images are left alone.
        args.extend(["-resize".into(), format!("{w}x>")]);
    }
    if o.strip_metadata {
        args.push("-strip".into());
    }
    match o.format {
        ImageFormat::Jpg => {
            // JPEG has no alpha; flatten onto white instead of black.
            args.extend(["-background", "white", "-alpha", "remove", "-alpha", "off"].map(String::from));
            args.extend(["-quality".into(), o.quality.to_string()]);
        }
        ImageFormat::Png => {
            args.extend(["-define", "png:compression-level=9"].map(String::from));
        }
        ImageFormat::Webp if o.lossless => {
            args.extend(["-define", "webp:lossless=true", "-define", "webp:method=6"].map(String::from));
        }
        ImageFormat::Webp | ImageFormat::Avif | ImageFormat::Heic => {
            let quality = if o.lossless { 100 } else { o.quality };
            args.extend(["-quality".into(), quality.to_string()]);
        }
    }
    args.push(output.to_string());
    args
}

fn ffmpeg_video_args(o: &VideoOptions) -> Result<Vec<String>, String> {
    use VideoCodec::*;
    if o.container == Container::Webm && !matches!(o.codec, Vp9 | Av1) {
        return Err("WebM only supports VP9 or AV1 video.".into());
    }
    let q = o.quality.clamp(1, 100) as f64;
    let mut args: Vec<String> = Vec::new();
    let mut push = |items: &[&str]| args.extend(items.iter().map(|s| s.to_string()));

    match o.codec {
        H264Hw => push(&["-c:v", "h264_videotoolbox", "-q:v", &q.to_string(), "-pix_fmt", "yuv420p"]),
        HevcHw => push(&["-c:v", "hevc_videotoolbox", "-q:v", &q.to_string(), "-tag:v", "hvc1"]),
        // CRF 35 (q=1) → 17 (q=100)
        H264 => push(&["-c:v", "libx264", "-preset", "medium", "-crf", &crf(q, 35.0, 17.0), "-pix_fmt", "yuv420p"]),
        // CRF 50 (q=1) → 20 (q=100)
        Vp9 => push(&["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", &crf(q, 50.0, 20.0), "-row-mt", "1"]),
        Av1 => push(&["-c:v", "libsvtav1", "-preset", "8", "-crf", &crf(q, 50.0, 20.0)]),
    }

    let mut filters = Vec::new();
    if let Some(h) = o.max_height {
        // -2 keeps the width even, which most encoders require.
        filters.push(format!("scale=-2:'min({h},ih)'"));
    }
    if !filters.is_empty() {
        push(&["-vf", &filters.join(",")]);
    }
    if let Some(fps) = o.fps {
        push(&["-r", &fps.to_string()]);
    }

    if o.remove_audio {
        push(&["-an"]);
    } else if o.container == Container::Webm {
        push(&["-c:a", "libopus", "-b:a", "128k"]);
    } else {
        push(&["-c:a", "aac", "-b:a", "160k"]);
    }
    if matches!(o.container, Container::Mp4 | Container::Mov) {
        // Put the index at the front so the file can start playing before it's fully loaded.
        push(&["-movflags", "+faststart"]);
    }
    Ok(args)
}

fn crf(quality: f64, worst: f64, best: f64) -> String {
    let crf = worst + (best - worst) * (quality - 1.0) / 99.0;
    format!("{}", crf.round() as i64)
}

fn ffmpeg_audio_args(o: &AudioOptions) -> Vec<String> {
    let mut args = vec!["-vn".to_string()];
    let bitrate = format!("{}k", o.bitrate.clamp(32, 320));
    let codec = match o.format {
        AudioFormat::Mp3 => vec!["-c:a", "libmp3lame", "-b:a", &bitrate],
        AudioFormat::Aac => vec!["-c:a", "aac", "-b:a", &bitrate],
        AudioFormat::Opus => vec!["-c:a", "libopus", "-b:a", &bitrate],
        AudioFormat::Flac => vec!["-c:a", "flac"],
        AudioFormat::Wav => vec!["-c:a", "pcm_s16le"],
    };
    args.extend(codec.iter().map(|s| s.to_string()));
    if o.normalize {
        // EBU R128 loudness: -16 LUFS is the common streaming/podcast target.
        // loudnorm upsamples to 192 kHz and emits oversized frames (FLAC caps them at
        // 65535 samples), so resample to 48 kHz and re-chunk afterwards.
        args.extend(
            ["-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,asetnsamples=n=4096:p=0"].map(String::from),
        );
    }
    args
}

fn ffmpeg_gif_args(o: &GifOptions) -> Vec<String> {
    // Build a palette from the clip itself; much better colour than the default 256-colour web palette.
    let filter = format!(
        "fps={fps},scale={w}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5",
        fps = o.fps.clamp(1, 50),
        w = o.width.clamp(16, 1920),
    );
    vec!["-filter_complex".into(), filter, "-an".into(), "-loop".into(), "0".into()]
}

#[cfg(test)]
mod tests {
    //! Runs every preset against small generated clips, so a bad flag fails here
    //! instead of in the UI. Needs ffmpeg and magick installed.

    use super::*;
    use std::process::Command as StdCommand;

    fn fixtures() -> (PathBuf, PathBuf, PathBuf) {
        let dir = std::env::temp_dir().join(format!("pyx-tests-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let video = dir.join("clip.mov");
        let image = dir.join("photo.png");
        let ffmpeg = tools::resolve(Tool::Ffmpeg).expect("ffmpeg installed");
        let ok = StdCommand::new(&ffmpeg)
            .args(["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=2"])
            .args(["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-shortest", "-pix_fmt", "yuv420p"])
            .arg(&video)
            .status()
            .unwrap()
            .success();
        assert!(ok, "fixture video");
        let magick = tools::resolve(Tool::Magick).expect("magick installed");
        let ok = StdCommand::new(magick)
            .args(["-size", "800x600", "gradient:#4f46e5-#f43f5e"])
            .arg(&image)
            .status()
            .unwrap()
            .success();
        assert!(ok, "fixture image");
        (dir, video, image)
    }

    fn run_plan(input: &Path, op: Operation) -> PathBuf {
        let output = unique_output(input, None, extension(&op), &HashSet::new());
        let plan = build_plan(input, output, &op).unwrap();
        let out = StdCommand::new(tools::resolve(plan.tool).unwrap()).args(&plan.args).output().unwrap();
        assert!(out.status.success(), "{op:?} failed:\n{}", String::from_utf8_lossy(&out.stderr));
        let output = plan.output.unwrap();
        let size = std::fs::metadata(&output).unwrap().len();
        assert!(size > 0, "{op:?} produced an empty file");
        output
    }

    #[test]
    fn every_preset_produces_a_file() {
        let (dir, video, image) = fixtures();

        for format in [ImageFormat::Webp, ImageFormat::Avif, ImageFormat::Heic, ImageFormat::Png, ImageFormat::Jpg] {
            for lossless in [false, true] {
                run_plan(&image, Operation::Image(ImageOptions { format, quality: 75, lossless, max_width: Some(400), strip_metadata: true }));
            }
        }

        let video_cases = [
            (Container::Mp4, VideoCodec::H264Hw),
            (Container::Mov, VideoCodec::HevcHw),
            (Container::Mp4, VideoCodec::H264),
            (Container::Mkv, VideoCodec::Av1),
            (Container::Webm, VideoCodec::Vp9),
            (Container::Webm, VideoCodec::Av1),
        ];
        for (container, codec) in video_cases {
            for remove_audio in [false, true] {
                run_plan(&video, Operation::Video(VideoOptions { container, codec, quality: 50, max_height: Some(240), fps: Some(24.0), remove_audio }));
            }
        }

        for format in [AudioFormat::Mp3, AudioFormat::Aac, AudioFormat::Opus, AudioFormat::Flac, AudioFormat::Wav] {
            run_plan(&video, Operation::Audio(AudioOptions { format, bitrate: 128, normalize: true }));
        }

        run_plan(&video, Operation::Gif(GifOptions { fps: 10, width: 320 }));

        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn webm_rejects_h264() {
        let op = Operation::Video(VideoOptions { container: Container::Webm, codec: VideoCodec::H264, quality: 50, max_height: None, fps: None, remove_audio: false });
        assert!(build_plan(Path::new("in.mov"), PathBuf::from("out.webm"), &op).is_err());
    }

    #[test]
    fn output_names_avoid_collisions() {
        let dir = std::env::temp_dir();
        let input = dir.join("does-not-exist.png");
        let first = unique_output(&input, None, "webp", &HashSet::new());
        let second = unique_output(&input, None, "webp", &HashSet::from([first.clone()]));
        assert_eq!(first.file_name().unwrap(), "does-not-exist.webp");
        assert_eq!(second.file_name().unwrap(), "does-not-exist (2).webp");
    }

    #[test]
    fn quality_maps_onto_crf_range() {
        assert_eq!(crf(1.0, 35.0, 17.0), "35");
        assert_eq!(crf(100.0, 35.0, 17.0), "17");
    }
}
