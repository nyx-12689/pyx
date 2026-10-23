use tauri::Manager;

mod deps;
mod history;
mod jobs;
mod logs;
mod probe;
mod settings;
mod tools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(jobs::Jobs::default())
        .manage(logs::JobLogs::default())

        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            // Before anything opens files there: bring over data saved under an earlier app identifier.
            if let Some(old) = settings::migrate_data_dir(&data_dir) {
                eprintln!("Moved app data from {} to {}", old.display(), data_dir.display());
            }
            app.manage(history::History::open(&data_dir.join("history.sqlite"))?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            deps::dependency_report,
            deps::install_dependency,
            probe::expand_paths,
            probe::probe_file,
            jobs::start_job,
            jobs::preview_command,
            history::history_list,
            history::history_clear,
            jobs::cancel_job,
            logs::job_log,
            settings::settings_load,
            settings::settings_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
