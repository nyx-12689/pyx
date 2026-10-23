//! Finished jobs, saved to SQLite in the app's data folder so the Dashboard's
//! charts and the Activity page survive restarts.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

/// Rows returned in one go; the Dashboard asks for at most a few months.
const MAX_ROWS: i64 = 20_000;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Record {
    pub id: String,
    /// "tool" or "install"
    pub kind: String,
    /// Tool id, or the Homebrew formula for installs.
    pub subject: String,
    pub label: String,
    pub input: Option<String>,
    pub input_size: Option<i64>,
    /// "image" | "video" | "audio" | "unknown"
    pub input_kind: Option<String>,
    /// Seconds, for video and audio inputs.
    pub input_duration: Option<f64>,
    pub output: Option<String>,
    pub output_size: Option<i64>,
    /// "done" | "error" | "cancelled"
    pub status: String,
    pub error: Option<String>,
    pub elapsed_ms: Option<i64>,
    /// Unix milliseconds.
    pub created_at: i64,
    pub finished_at: i64,
    pub command: Option<String>,
    pub display_command: Option<String>,
}

pub struct History(Mutex<Connection>);

impl History {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        Self::with_connection(Connection::open(path)?)
    }

    fn with_connection(conn: Connection) -> rusqlite::Result<Self> {
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS jobs (
                 id TEXT PRIMARY KEY,
                 kind TEXT NOT NULL,
                 subject TEXT NOT NULL,
                 label TEXT NOT NULL,
                 input TEXT,
                 input_size INTEGER,
                 input_kind TEXT,
                 input_duration REAL,
                 output TEXT,
                 output_size INTEGER,
                 status TEXT NOT NULL,
                 error TEXT,
                 elapsed_ms INTEGER,
                 created_at INTEGER NOT NULL,
                 finished_at INTEGER NOT NULL,
                 command TEXT,
                 display_command TEXT
             );
             CREATE INDEX IF NOT EXISTS jobs_finished_at ON jobs (finished_at);",
        )?;
        Ok(Self(Mutex::new(conn)))
    }

    pub fn insert(&self, r: &Record) -> rusqlite::Result<()> {
        self.0.lock().unwrap().execute(
            "INSERT OR REPLACE INTO jobs VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                r.id,
                r.kind,
                r.subject,
                r.label,
                r.input,
                r.input_size,
                r.input_kind,
                r.input_duration,
                r.output,
                r.output_size,
                r.status,
                r.error,
                r.elapsed_ms,
                r.created_at,
                r.finished_at,
                r.command,
                r.display_command
            ],
        )?;
        Ok(())
    }

    /// Newest first.
    pub fn since(&self, since_ms: i64, limit: i64) -> rusqlite::Result<Vec<Record>> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, kind, subject, label, input, input_size, input_kind, input_duration, output, output_size,
                    status, error, elapsed_ms, created_at, finished_at, command, display_command
             FROM jobs WHERE finished_at >= ?1 ORDER BY finished_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![since_ms, limit.clamp(1, MAX_ROWS)], |row| {
            Ok(Record {
                id: row.get(0)?,
                kind: row.get(1)?,
                subject: row.get(2)?,
                label: row.get(3)?,
                input: row.get(4)?,
                input_size: row.get(5)?,
                input_kind: row.get(6)?,
                input_duration: row.get(7)?,
                output: row.get(8)?,
                output_size: row.get(9)?,
                status: row.get(10)?,
                error: row.get(11)?,
                elapsed_ms: row.get(12)?,
                created_at: row.get(13)?,
                finished_at: row.get(14)?,
                command: row.get(15)?,
                display_command: row.get(16)?,
            })
        })?;
        rows.collect()
    }

    pub fn clear(&self) -> rusqlite::Result<()> {
        self.0.lock().unwrap().execute("DELETE FROM jobs", [])?;
        Ok(())
    }
}

#[tauri::command]
pub fn history_list(history: State<'_, History>, since: i64, limit: i64) -> Result<Vec<Record>, String> {
    history.since(since, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn history_clear(history: State<'_, History>) -> Result<(), String> {
    history.clear().map_err(|e| e.to_string())
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(id: &str, finished_at: i64) -> Record {
        Record {
            id: id.into(),
            kind: "tool".into(),
            subject: "convert.image".into(),
            label: "Image format".into(),
            input: Some("/tmp/a.png".into()),
            input_size: Some(1000),
            input_kind: Some("image".into()),
            input_duration: None,
            output: Some("/tmp/a.webp".into()),
            output_size: Some(300),
            status: "done".into(),
            error: None,
            elapsed_ms: Some(120),
            created_at: finished_at - 120,
            finished_at,
            command: Some("magick a.png a.webp".into()),
            display_command: Some("magick a.png a.webp".into()),
        }
    }

    #[test]
    fn round_trips_and_filters_by_time() {
        let history = History::with_connection(Connection::open_in_memory().unwrap()).unwrap();
        history.insert(&record("old", 1_000)).unwrap();
        history.insert(&record("new", 5_000)).unwrap();

        let recent = history.since(2_000, 100).unwrap();
        assert_eq!(recent, vec![record("new", 5_000)]);
        assert_eq!(history.since(0, 100).unwrap().len(), 2);

        history.clear().unwrap();
        assert!(history.since(0, 100).unwrap().is_empty());
    }
}
