//! Reads media metadata with ffprobe (falling back to `magick identify` for
//! image formats ffprobe can't open, such as HEIC).

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::tools::{self, Tool};

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Image,
    Video,
    Audio,
    #[default]
    Unknown,
}

const IMAGE_EXTS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "avif", "heic", "heif", "tif", "tiff", "bmp", "gif", "psd", "svg",
];
const VIDEO_EXTS: &[&str] = &["mp4", "mov", "m4v", "mkv", "webm", "avi", "mts", "m2ts", "flv", "wmv"];
const AUDIO_EXTS: &[&str] = &["mp3", "wav", "flac", "aac", "m4a", "ogg", "opus", "aiff", "aif", "wma"];

pub fn kind_from_path(path: &Path) -> MediaKind {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if IMAGE_EXTS.contains(&ext.as_str()) {
        MediaKind::Image
    } else if VIDEO_EXTS.contains(&ext.as_str()) {
        MediaKind::Video
    } else if AUDIO_EXTS.contains(&ext.as_str()) {
        MediaKind::Audio
    } else {
        MediaKind::Unknown
    }
}

/// Expands dropped folders into the media files inside them (up to a few levels deep).
#[tauri::command]
pub fn expand_paths(paths: Vec<String>) -> Vec<String> {
    const MAX_DEPTH: usize = 4;
    fn walk(dir: &Path, depth: usize, out: &mut Vec<String>) {
        let Ok(entries) = std::fs::read_dir(dir) else { return };
        let mut entries: Vec<_> = entries.flatten().map(|e| e.path()).collect();
        entries.sort();
        for path in entries {
            let hidden = path.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.starts_with('.'));
            if hidden {
                continue;
            }
            if path.is_dir() && depth < MAX_DEPTH {
                walk(&path, depth + 1, out);
            } else if path.is_file() && kind_from_path(&path) != MediaKind::Unknown {
                out.push(path.display().to_string());
            }
        }
    }

    let mut out = Vec::new();
    for path in paths.iter().map(Path::new) {
        if path.is_dir() {
            walk(path, 1, &mut out);
        } else if kind_from_path(path) != MediaKind::Unknown {
            out.push(path.display().to_string());
        }
    }
    out
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub path: String,
    pub kind: MediaKind,
    pub size: u64,
    pub duration: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub fps: Option<f64>,
}

#[derive(Deserialize)]
struct FfprobeOutput {
    #[serde(default)]
    streams: Vec<FfprobeStream>,
    format: Option<FfprobeFormat>,
}

#[derive(Deserialize)]
struct FfprobeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    avg_frame_rate: Option<String>,
}

#[derive(Deserialize)]
struct FfprobeFormat {
    duration: Option<String>,
}

#[tauri::command]
pub async fn probe_file(path: String) -> Result<MediaInfo, String> {
    let p = Path::new(&path);
    let size = std::fs::metadata(p).map_err(|e| format!("Can't read {path}: {e}"))?.len();
    let kind = kind_from_path(p);
    let mut info = MediaInfo { path: path.clone(), kind, size, ..Default::default() };

    match ffprobe(p).await {
        Ok(out) => {
            if let Some(v) = out.streams.iter().find(|s| s.codec_type.as_deref() == Some("video")) {
                info.width = v.width;
                info.height = v.height;
                info.video_codec = v.codec_name.clone();
                info.fps = v.avg_frame_rate.as_deref().and_then(parse_rate);
            }
            if let Some(a) = out.streams.iter().find(|s| s.codec_type.as_deref() == Some("audio")) {
                info.audio_codec = a.codec_name.clone();
            }
            if kind != MediaKind::Image {
                info.duration = out.format.and_then(|f| f.duration).and_then(|d| d.parse().ok());
            }
        }
        Err(_) if kind == MediaKind::Image => {
            if let Some((w, h)) = magick_dimensions(p).await {
                info.width = Some(w);
                info.height = Some(h);
            }
        }
        Err(e) => return Err(e),
    }
    Ok(info)
}

/// Duration in seconds, used by the job runner to turn ffmpeg's progress into a percentage.
pub async fn duration_of(path: &Path) -> Option<f64> {
    ffprobe(path).await.ok()?.format?.duration?.parse().ok()
}

async fn ffprobe(path: &Path) -> Result<FfprobeOutput, String> {
    let output = tools::command(Tool::Ffprobe)?
        .args(["-v", "error", "-print_format", "json", "-show_format", "-show_streams"])
        .arg(path)
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())
}

async fn magick_dimensions(path: &Path) -> Option<(u32, u32)> {
    // `[0]` reads only the first frame/layer, which keeps this fast for multi-page files.
    let output = tools::command(Tool::Magick)
        .ok()?
        .args(["identify", "-format", "%w %h"])
        .arg(format!("{}[0]", path.display()))
        .output()
        .await
        .ok()?;
    let text = String::from_utf8(output.stdout).ok()?;
    let mut parts = text.split_whitespace().map(|n| n.parse().ok());
    Some((parts.next()??, parts.next()??))
}

/// "30000/1001" -> 29.97
fn parse_rate(rate: &str) -> Option<f64> {
    let (num, den) = rate.split_once('/')?;
    let (num, den): (f64, f64) = (num.parse().ok()?, den.parse().ok()?);
    (den > 0.0 && num > 0.0).then(|| num / den)
}
