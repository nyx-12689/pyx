//! The Dependencies page: which binaries are installed, where from, what they
//! can do, and installing or upgrading them through Homebrew.

use std::collections::HashMap;
use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::jobs::{self, JobMeta, Jobs, Plan};
use crate::tools::{self, Tool};

/// ffmpeg encoders the tools care about, with a readable label.
const FFMPEG_ENCODERS: &[(&str, &str)] = &[
    ("h264_videotoolbox", "H.264 (Apple hardware)"),
    ("hevc_videotoolbox", "HEVC (Apple hardware)"),
    ("prores_videotoolbox", "ProRes (Apple hardware)"),
    ("libx264", "H.264 (x264)"),
    ("libx265", "HEVC (x265)"),
    ("libvpx-vp9", "VP9"),
    ("libsvtav1", "AV1 (SVT)"),
    ("libaom-av1", "AV1 (libaom)"),
    ("libwebp", "WebP"),
    ("libopus", "Opus"),
    ("libmp3lame", "MP3"),
    ("aac", "AAC"),
    ("flac", "FLAC"),
];

/// ImageMagick formats the tools care about.
const MAGICK_FORMATS: &[(&str, &str)] = &[
    ("WEBP", "WebP"),
    ("AVIF", "AVIF"),
    ("HEIC", "HEIC"),
    ("JXL", "JPEG XL"),
    ("PNG", "PNG"),
    ("JPEG", "JPEG"),
    ("TIFF", "TIFF"),
    ("SVG", "SVG"),
    ("PDF", "PDF"),
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capability {
    id: String,
    label: &'static str,
    available: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Dependency {
    name: &'static str,
    formula: &'static str,
    description: &'static str,
    path: Option<String>,
    version: Option<String>,
    /// "homebrew" or "system"
    source: Option<&'static str>,
    /// A newer Homebrew version, when there is one; None when up to date.
    latest: Option<String>,
    capabilities: Vec<Capability>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyReport {
    dependencies: Vec<Dependency>,
    brew_path: Option<String>,
}

#[tauri::command]
pub async fn dependency_report() -> DependencyReport {
    let (ffmpeg, ffprobe, magick) = tokio::join!(
        describe(Tool::Ffmpeg, "Encodes and decodes video and audio; runs most tools."),
        describe(Tool::Ffprobe, "Reads media details: duration, codecs, resolution."),
        describe(Tool::Magick, "ImageMagick: converts and edits images."),
    );
    let mut dependencies = vec![ffmpeg, ffprobe, magick];

    // Only Homebrew installs can be upgraded from here.
    let mut formulas: Vec<&str> =
        dependencies.iter().filter(|d| d.source == Some("homebrew")).map(|d| d.formula).collect();
    formulas.dedup();
    let newer = outdated(&formulas).await;
    for dep in &mut dependencies {
        dep.latest = newer.get(dep.formula).cloned();
    }

    DependencyReport { dependencies, brew_path: tools::resolve(Tool::Brew).map(|p| p.display().to_string()) }
}

/// Formulas with a newer version, mapped to that version. Reads Homebrew's
/// local index without updating it, so it's quick and works offline; it's as
/// fresh as Homebrew's last update.
async fn outdated(formulas: &[&str]) -> HashMap<String, String> {
    if formulas.is_empty() {
        return HashMap::new();
    }
    let Ok(mut cmd) = tools::command(Tool::Brew) else { return HashMap::new() };
    cmd.env("HOMEBREW_NO_AUTO_UPDATE", "1").args(["outdated", "--json=v2", "--formula"]).args(formulas);
    match cmd.output().await {
        Ok(out) => parse_outdated(&String::from_utf8_lossy(&out.stdout)),
        Err(_) => HashMap::new(),
    }
}

fn parse_outdated(json: &str) -> HashMap<String, String> {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(json) else { return HashMap::new() };
    value["formulae"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|f| Some((f["name"].as_str()?.to_string(), f["current_version"].as_str()?.to_string())))
        .collect()
}

async fn describe(tool: Tool, description: &'static str) -> Dependency {
    let path = tools::resolve(tool);
    let mut dep = Dependency {
        name: tool.binary_name(),
        formula: tool.formula(),
        description,
        path: path.as_ref().map(|p| p.display().to_string()),
        version: None,
        source: path.as_deref().map(source_of),
        latest: None,
        capabilities: Vec::new(),
    };
    if path.is_none() {
        return dep;
    }
    dep.version = output_of(tool, &["-version"]).await.and_then(|s| s.lines().next().map(tools::parse_version));
    dep.capabilities = match tool {
        Tool::Ffmpeg => ffmpeg_capabilities().await,
        Tool::Magick => magick_capabilities().await,
        _ => Vec::new(),
    };
    dep
}

fn source_of(path: &Path) -> &'static str {
    // Homebrew binaries are symlinks into its Cellar.
    let real = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let real = real.to_string_lossy();
    if real.contains("/Cellar/") || real.starts_with("/opt/homebrew/") { "homebrew" } else { "system" }
}

async fn output_of(tool: Tool, args: &[&str]) -> Option<String> {
    let output = tools::command(tool).ok()?.args(args).output().await.ok()?;
    String::from_utf8(output.stdout).ok()
}

async fn ffmpeg_capabilities() -> Vec<Capability> {
    let (encoders, hwaccels) = tokio::join!(
        output_of(Tool::Ffmpeg, &["-hide_banner", "-encoders"]),
        output_of(Tool::Ffmpeg, &["-hide_banner", "-hwaccels"]),
    );
    let encoders = encoders.unwrap_or_default();
    // Encoder lines look like " V....D libx264   libx264 H.264 ..."; the name is the second column.
    let names: Vec<&str> = encoders.lines().filter_map(|l| l.split_whitespace().nth(1)).collect();
    let mut caps: Vec<Capability> = FFMPEG_ENCODERS
        .iter()
        .map(|(id, label)| Capability { id: format!("encoder:{id}"), label, available: names.contains(id) })
        .collect();
    caps.push(Capability {
        id: "hwaccel:videotoolbox".into(),
        label: "VideoToolbox decoding",
        available: hwaccels.unwrap_or_default().lines().any(|l| l.trim() == "videotoolbox"),
    });
    caps
}

async fn magick_capabilities() -> Vec<Capability> {
    let list = output_of(Tool::Magick, &["-list", "format"]).await.unwrap_or_default();
    // Lines look like "     WEBP* WEBP      rw+   WebP Image Format"; the mode column says whether it can write.
    let writable: Vec<String> = list
        .lines()
        .filter_map(|l| {
            let mut cols = l.split_whitespace();
            let name = cols.next()?.trim_end_matches('*');
            let _module = cols.next()?;
            let mode = cols.next()?;
            mode.contains('w').then(|| name.to_string())
        })
        .collect();
    MAGICK_FORMATS
        .iter()
        .map(|(id, label)| Capability {
            id: format!("format:{}", id.to_lowercase()),
            label,
            available: writable.iter().any(|w| w == id),
        })
        .collect()
}

/// Runs `brew install` (or `brew upgrade`) as a job, so its output shows in the terminal.
#[tauri::command]
pub fn install_dependency(app: AppHandle, jobs: State<'_, Jobs>, id: String, formula: String, upgrade: bool) -> Result<(), String> {
    if !matches!(formula.as_str(), "ffmpeg" | "imagemagick") {
        return Err(format!("Unknown dependency: {formula}"));
    }
    let verb = if upgrade { "upgrade" } else { "install" };
    let label = format!("{} {formula}", if upgrade { "Upgrade" } else { "Install" });
    let meta = JobMeta { kind: "install", subject: formula.clone(), label, input: None };
    let plan = Plan { tool: Tool::Brew, args: vec![verb.into(), formula], output: None, progress_input: None };
    jobs::spawn_job(app, &jobs, id, plan, meta);
    Ok(())
}

#[cfg(test)]
mod tests {
    //! Runs against the installed binaries (needs ffmpeg and magick).

    use super::*;

    #[test]
    fn reads_brew_outdated_json() {
        let json = r#"{"formulae":[{"name":"ffmpeg","installed_versions":["8.0"],"current_version":"8.0.1","pinned":false}],"casks":[]}"#;
        assert_eq!(parse_outdated(json), HashMap::from([("ffmpeg".to_string(), "8.0.1".to_string())]));
        assert!(parse_outdated(r#"{"formulae":[],"casks":[]}"#).is_empty());
        assert!(parse_outdated("Error: something").is_empty());
    }

    #[tokio::test]
    async fn detects_installed_tools_and_capabilities() {
        let report = dependency_report().await;
        let by_name = |name: &str| report.dependencies.iter().find(|d| d.name == name).unwrap();
        let has = |dep: &Dependency, id: &str| dep.capabilities.iter().any(|c| c.id == id && c.available);

        let ffmpeg = by_name("ffmpeg");
        assert!(ffmpeg.path.is_some() && ffmpeg.version.is_some());
        assert!(has(ffmpeg, "encoder:libx264"), "encoder list should parse");
        assert!(has(ffmpeg, "hwaccel:videotoolbox"), "hwaccel list should parse");

        let magick = by_name("magick");
        assert!(magick.version.as_deref().is_some_and(|v| v.starts_with('7')));
        assert!(has(magick, "format:webp"), "format list should parse");

        assert!(by_name("ffprobe").capabilities.is_empty());
    }
}
