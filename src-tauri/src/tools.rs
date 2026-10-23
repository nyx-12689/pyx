//! Locates the external binaries (ffmpeg, ffprobe, magick, brew) the app drives.
//!
//! Apps launched from Finder don't inherit the shell's PATH, so we check the
//! usual Homebrew locations explicitly before falling back to PATH.

use std::path::PathBuf;

use tokio::process::Command;

const SEARCH_DIRS: &[&str] = &["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

#[derive(Clone, Copy, Debug)]
pub enum Tool {
    Ffmpeg,
    Ffprobe,
    Magick,
    Brew,
}

impl Tool {
    pub fn binary_name(self) -> &'static str {
        match self {
            Tool::Ffmpeg => "ffmpeg",
            Tool::Ffprobe => "ffprobe",
            Tool::Magick => "magick",
            Tool::Brew => "brew",
        }
    }

    /// The Homebrew formula that provides this binary.
    pub fn formula(self) -> &'static str {
        match self {
            Tool::Ffmpeg | Tool::Ffprobe => "ffmpeg",
            Tool::Magick => "imagemagick",
            Tool::Brew => "brew",
        }
    }
}

pub fn resolve(tool: Tool) -> Option<PathBuf> {
    let name = tool.binary_name();
    let from_dirs = SEARCH_DIRS.iter().map(|dir| PathBuf::from(dir).join(name));
    let from_path = std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).map(|dir| dir.join(name)).collect::<Vec<_>>())
        .unwrap_or_default();
    from_dirs.chain(from_path).find(|candidate| candidate.is_file())
}

pub fn command(tool: Tool) -> Result<Command, String> {
    let path = resolve(tool).ok_or_else(|| match tool {
        Tool::Brew => "Homebrew not found. Install it from https://brew.sh".to_string(),
        _ => format!("{} not found. Install it with `brew install {}`.", tool.binary_name(), tool.formula()),
    })?;
    let mut cmd = Command::new(path);
    cmd.kill_on_drop(true);
    if matches!(tool, Tool::Brew) {
        // brew shells out to git, curl etc. and needs a normal PATH, which Finder-launched apps lack.
        let path = std::env::var("PATH").unwrap_or_default();
        cmd.env("PATH", format!("{}:{path}", SEARCH_DIRS.join(":")));
        cmd.env("HOMEBREW_NO_COLOR", "1").env("HOMEBREW_NO_ENV_HINTS", "1");
    }
    Ok(cmd)
}

/// "ffmpeg version 8.0 Copyright ..." -> "8.0"; "Version: ImageMagick 7.1.2-34 Q16..." -> "7.1.2-34"
pub fn parse_version(first_line: &str) -> String {
    let words: Vec<&str> = first_line.split_whitespace().collect();
    words
        .iter()
        .position(|w| w.eq_ignore_ascii_case("version") || *w == "ImageMagick")
        .and_then(|i| words.get(i + 1))
        .map(|v| v.to_string())
        .unwrap_or_else(|| first_line.to_string())
}
