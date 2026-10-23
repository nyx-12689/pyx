//! Preferences, saved as JSON next to the history database. The WebView's own
//! storage is keyed by the app's identifier, so a file here is what survives a
//! rename; localStorage is only a fast cache in front of it.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

const FILE: &str = "settings.json";

/// Identifiers the app has shipped under before. Their data folders are moved
/// to the current one on first launch.
const PREVIOUS_IDENTIFIERS: &[&str] = &["com.nyx.master-gui"];

fn path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join(FILE))
}

#[tauri::command]
pub fn settings_load(app: AppHandle) -> Option<String> {
    std::fs::read_to_string(path(&app)?).ok()
}

#[tauri::command]
pub fn settings_save(app: AppHandle, json: String) -> Result<(), String> {
    let path = path(&app).ok_or("No app data folder")?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    // Write then rename, so a crash mid-write can't leave half a file.
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

/// Moves the data folder of a previous identifier into place, if this
/// identifier doesn't have one yet. Returns where it came from.
pub fn migrate_data_dir(data_dir: &Path) -> Option<PathBuf> {
    if data_dir.exists() {
        return None;
    }
    let parent = data_dir.parent()?;
    let old = PREVIOUS_IDENTIFIERS.iter().map(|id| parent.join(id)).find(|dir| dir.is_dir())?;
    std::fs::rename(&old, data_dir).ok()?;
    Some(old)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moves_the_old_data_folder_once() {
        let root = std::env::temp_dir().join(format!("pyx-migrate-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let old = root.join("com.nyx.master-gui");
        std::fs::create_dir_all(&old).unwrap();
        std::fs::write(old.join("history.sqlite"), b"data").unwrap();

        let new = root.join("com.nyx.pyx");
        assert_eq!(migrate_data_dir(&new), Some(old.clone()));
        assert_eq!(std::fs::read(new.join("history.sqlite")).unwrap(), b"data");
        assert!(!old.exists());

        // Once the new folder exists, nothing moves again.
        std::fs::create_dir_all(&old).unwrap();
        assert_eq!(migrate_data_dir(&new), None);
        std::fs::remove_dir_all(&root).unwrap();
    }
}
