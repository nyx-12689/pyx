//! Per-job raw output from ffmpeg/magick/brew, kept in a capped buffer. The
//! terminal panel shows a tidy summary; this is what "View full log" opens,
//! mostly for working out why a job failed.

use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, State};

/// Logs kept in memory; older ones are dropped first.
const MAX_JOBS: usize = 200;
/// Per-job cap. ffmpeg's stats line rewrites itself with `\r`, so even long
/// encodes stay well under this; it's a guard against runaway output.
const MAX_BYTES_PER_JOB: usize = 256 * 1024;

#[derive(Default)]
pub struct JobLogs(Mutex<Inner>);

#[derive(Default)]
struct Inner {
    logs: HashMap<String, String>,
    order: VecDeque<String>,
}

/// Appends to a job's log.
pub fn append(app: &AppHandle, id: &str, data: &str) {
    if data.is_empty() {
        return;
    }
    {
        let state = app.state::<JobLogs>();
        let mut inner = state.0.lock().unwrap();
        if !inner.logs.contains_key(id) {
            if inner.order.len() == MAX_JOBS
                && let Some(oldest) = inner.order.pop_front()
            {
                inner.logs.remove(&oldest);
            }
            inner.order.push_back(id.to_string());
        }
        let log = inner.logs.entry(id.to_string()).or_default();
        log.push_str(data);
        if log.len() > MAX_BYTES_PER_JOB {
            // Drop from the front, at a line boundary.
            let excess = log.len() - MAX_BYTES_PER_JOB;
            let cut = log[excess..].find('\n').map_or(excess, |i| excess + i + 1);
            let cut = (cut..log.len()).find(|&i| log.is_char_boundary(i)).unwrap_or(log.len());
            log.replace_range(..cut, "");
        }
    }
}

#[tauri::command]
pub fn job_log(logs: State<'_, JobLogs>, id: String) -> Option<String> {
    logs.0.lock().unwrap().logs.get(&id).cloned()
}

/// Splits a byte stream into UTF-8 text without breaking multi-byte characters
/// that straddle two reads.
#[derive(Default)]
pub struct Utf8Chunker {
    pending: Vec<u8>,
}

impl Utf8Chunker {
    pub fn push(&mut self, bytes: &[u8]) -> String {
        self.pending.extend_from_slice(bytes);
        let valid = match std::str::from_utf8(&self.pending) {
            Ok(_) => self.pending.len(),
            // An incomplete character at the end: keep it for the next read.
            Err(e) if e.error_len().is_none() => e.valid_up_to(),
            // Genuinely invalid bytes: give up on exactness.
            Err(_) => self.pending.len(),
        };
        let rest = self.pending.split_off(valid);
        let text = String::from_utf8_lossy(&self.pending).into_owned();
        self.pending = rest;
        text
    }
}

/// Keeps the last few meaningful lines of output, for error messages.
pub struct Tail {
    lines: VecDeque<String>,
    current: String,
    max: usize,
}

impl Tail {
    pub fn new(max: usize) -> Self {
        Self { lines: VecDeque::with_capacity(max), current: String::new(), max }
    }

    pub fn push(&mut self, text: &str) {
        for ch in text.chars() {
            if ch == '\n' || ch == '\r' {
                self.flush();
            } else {
                self.current.push(ch);
            }
        }
    }

    fn flush(&mut self) {
        let line = std::mem::take(&mut self.current);
        let trimmed = line.trim();
        // ffmpeg's rolling stats line isn't useful in an error message.
        if trimmed.is_empty() || trimmed.starts_with("frame=") || trimmed.starts_with("size=") {
            return;
        }
        if self.lines.len() == self.max {
            self.lines.pop_front();
        }
        self.lines.push_back(trimmed.to_string());
    }

    pub fn finish(mut self) -> String {
        self.flush();
        Vec::from(self.lines).join("\n")
    }
}

/// Flags that are plumbing rather than intent; hidden from the terminal panel.
const NOISE_FLAGS: &[&str] = &["-hide_banner", "-nostdin", "-y", "-stats", "-verbose"];
/// Flags whose value is plumbing too.
const NOISE_FLAGS_WITH_VALUE: &[&str] = &["-loglevel", "-progress"];

/// A readable version of the command for the terminal panel: no plumbing
/// flags, and file names instead of full paths.
pub fn display_command(program: &str, args: &[String]) -> String {
    let mut shown = Vec::new();
    let mut iter = args.iter();
    while let Some(arg) = iter.next() {
        if NOISE_FLAGS.contains(&arg.as_str()) {
            continue;
        }
        if NOISE_FLAGS_WITH_VALUE.contains(&arg.as_str()) {
            iter.next();
            continue;
        }
        let path = std::path::Path::new(arg);
        let shortened = match path.file_name() {
            Some(name) if path.is_absolute() => name.to_string_lossy().into_owned(),
            _ => arg.clone(),
        };
        shown.push(shortened);
    }
    shell_command(program, &shown)
}

/// Renders argv as a copy-pasteable shell command.
pub fn shell_command(program: &str, args: &[String]) -> String {
    std::iter::once(program)
        .chain(args.iter().map(String::as_str))
        .map(shell_quote)
        .collect::<Vec<_>>()
        .join(" ")
}

fn shell_quote(arg: &str) -> String {
    let safe = !arg.is_empty()
        && arg.chars().all(|c| c.is_ascii_alphanumeric() || "_-./:=,+%@".contains(c));
    if safe { arg.to_string() } else { format!("'{}'", arg.replace('\'', r"'\''")) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_only_when_needed() {
        let args = vec!["-i".to_string(), "My Clip's.mov".to_string(), "scale=-2:'min(720,ih)'".to_string()];
        assert_eq!(
            shell_command("ffmpeg", &args),
            r#"ffmpeg -i 'My Clip'\''s.mov' 'scale=-2:'\''min(720,ih)'\'''"#
        );
    }

    #[test]
    fn display_command_hides_plumbing_and_paths() {
        let args: Vec<String> = ["-hide_banner", "-loglevel", "info", "-progress", "pipe:1", "-i", "/Users/me/My Clip.mov", "-c:v", "libx264", "/Users/me/out.mp4"]
            .map(String::from)
            .to_vec();
        assert_eq!(display_command("ffmpeg", &args), "ffmpeg -i 'My Clip.mov' -c:v libx264 out.mp4");
    }

    #[test]
    fn chunker_keeps_split_characters_together() {
        let mut c = Utf8Chunker::default();
        let bytes = "é".as_bytes();
        assert_eq!(c.push(&bytes[..1]), "");
        assert_eq!(c.push(&bytes[1..]), "é");
    }

    #[test]
    fn tail_skips_progress_lines() {
        let mut t = Tail::new(2);
        t.push("a\nframe= 1 fps=0\rframe= 2 fps=0\rb\nc\n");
        assert_eq!(t.finish(), "b\nc");
    }
}
